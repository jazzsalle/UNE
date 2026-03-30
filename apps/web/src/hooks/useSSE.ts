// ref: CLAUDE.md §6.3 — SSE 연결 훅
'use client';
import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useEmulatorStore } from '@/stores/emulatorStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useSSE() {
  const esRef = useRef<EventSource | null>(null);
  const updateSensorData = useAppStore((s) => s.updateSensorData);
  const addAlarm = useAppStore((s) => s.addAlarm);
  const setEventContext = useAppStore((s) => s.setEventContext);
  const setShowEventPopup = useAppStore((s) => s.setShowEventPopup);
  const setEmulatorStatus = useEmulatorStore((s) => s.setStatus);

  useEffect(() => {
    const es = new EventSource(`${API_URL}/api/emulator/stream`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        switch (event.type) {
          case 'SENSOR_UPDATE':
            updateSensorData(event.data);
            setEmulatorStatus({ elapsed_sec: event.elapsed_sec, phase: event.phase });
            break;
          case 'PHASE_CHANGE':
            setEmulatorStatus({ phase: event.phase, elapsed_sec: event.elapsed_sec });
            break;
          case 'ALARM':
            for (const a of event.data) addAlarm({ ...a, timestamp: event.timestamp, phase: event.phase });
            break;
          case 'EVENT_CREATE':
            setEventContext({
              event_id: event.data.event_id,
              scenario_id: event.data.scenario_id,
              trigger_equipment_id: event.data.trigger_equipment_id,
              affected_equipment_ids: [],
              severity: event.data.severity,
              current_phase: event.phase,
              hazop_id: null,
            });
            setShowEventPopup(true);
            break;
          case 'SCENARIO_END':
            setEmulatorStatus({ running: false, phase: 'END', elapsed_sec: event.elapsed_sec });
            break;
        }
      } catch {}
    };

    es.onerror = () => {
      setTimeout(() => {
        if (esRef.current) esRef.current.close();
        esRef.current = new EventSource(`${API_URL}/api/emulator/stream`);
      }, 3000);
    };

    return () => { es.close(); };
  }, []);
}
