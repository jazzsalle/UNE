// ref: CLAUDE.md §6.3 — SSE 연결 훅 + EventContext enrichment
'use client';
import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useEmulatorStore } from '@/stores/emulatorStore';
import { api } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useSSE() {
  const esRef = useRef<EventSource | null>(null);
  const updateSensorData = useAppStore((s) => s.updateSensorData);
  const addAlarm = useAppStore((s) => s.addAlarm);
  const clearAlarms = useAppStore((s) => s.clearAlarms);
  const setEventContext = useAppStore((s) => s.setEventContext);
  const setShowEventPopup = useAppStore((s) => s.setShowEventPopup);
  const setEmulatorStatus = useEmulatorStore((s) => s.setStatus);
  const resetEmulator = useEmulatorStore((s) => s.reset);

  useEffect(() => {
    // On mount: sync current emulator status so the bar reflects server state after page reload
    fetch(`${API_URL}/api/emulator/status`)
      .then((r) => r.json())
      .then((status) => {
        if (status.running) {
          setEmulatorStatus({
            running: true,
            paused: status.paused || false,
            scenario_id: status.scenario_id,
            elapsed_sec: status.elapsed_sec,
            phase: status.phase,
            speed: status.speed,
          });
        }
      })
      .catch(() => {});

    const es = new EventSource(`${API_URL}/api/emulator/stream`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        switch (event.type) {
          case 'SENSOR_UPDATE':
            updateSensorData(event.data);
            // running: true ensures the bar shows the live state after page reload
            setEmulatorStatus({ running: true, elapsed_sec: event.elapsed_sec, phase: event.phase });
            break;
          case 'PHASE_CHANGE':
            setEmulatorStatus({ running: true, phase: event.phase, elapsed_sec: event.elapsed_sec });
            break;
          case 'ALARM':
            for (const a of event.data) addAlarm({ ...a, timestamp: event.timestamp, phase: event.phase });
            break;
          case 'SYMPTOM_ENRICHMENT': {
            // SYMPTOM phase: 세이프티아 이력 + KOGAS 초기 진단
            const sd = event.data;
            const existingCtx = useAppStore.getState().eventContext;
            setEventContext({
              event_id: existingCtx?.event_id || null,
              scenario_id: sd.scenario_id,
              trigger_equipment_id: sd.trigger_equipment_id,
              affected_equipment_ids: existingCtx?.affected_equipment_ids || [],
              severity: existingCtx?.severity || 'WARNING',
              current_phase: 'SYMPTOM',
              hazop_id: existingCtx?.hazop_id || null,
              safetia_history: sd.safetia_history || undefined,
              kogas_result: sd.kogas_result || undefined,
            });
            setShowEventPopup(true);
            break;
          }
          case 'EVENT_CREATE': {
            const d = event.data;
            // Preserve SYMPTOM enrichment data (safetia, kogas) if already available
            const prevCtx = useAppStore.getState().eventContext;
            setEventContext({
              event_id: d.event_id,
              scenario_id: d.scenario_id,
              trigger_equipment_id: d.trigger_equipment_id,
              affected_equipment_ids: [],
              severity: d.severity,
              current_phase: event.phase,
              hazop_id: null,
              // Carry over SYMPTOM-phase data
              safetia_history: prevCtx?.safetia_history,
              kogas_result: prevCtx?.kogas_result,
            });
            setShowEventPopup(true);

            // Async enrichment: fetch provider data + SOP recommendations (now includes KETI at FAULT)
            enrichEventContext(d.event_id, d.scenario_id, d.trigger_equipment_id, d.severity, event.phase);
            break;
          }
          case 'EVENT_CLOSED': {
            const ctx = useAppStore.getState().eventContext;
            if (ctx && ctx.event_id === event.data.event_id) {
              setEventContext({ ...ctx, current_phase: 'RESPONSE' });
            }
            break;
          }
          case 'REPORT_GENERATED':
            // Could show a toast notification - for now just log
            console.log('[SSE] Report auto-generated:', event.data.report_id, event.data.title);
            break;
          case 'EMULATOR_PAUSED':
            setEmulatorStatus({ paused: true });
            break;
          case 'EMULATOR_RESUMED':
            setEmulatorStatus({ paused: false });
            break;
          case 'SCENARIO_END':
            setEmulatorStatus({ running: false, paused: false, phase: 'END', elapsed_sec: event.elapsed_sec });
            // 시나리오 자연 종료 시에도 앱 상태 초기화
            clearAlarms();
            setEventContext(null);
            setShowEventPopup(false);
            useAppStore.getState().clearSensorData();
            break;
          case 'SCENARIO_RESET':
            // 사용자가 중지 버튼 클릭 시: 에뮬레이터 + 앱 상태 전체 초기화
            resetEmulator();
            clearAlarms();
            setEventContext(null);
            setShowEventPopup(false);
            useAppStore.getState().clearSensorData();
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

async function enrichEventContext(
  eventId: string,
  scenarioId: string,
  triggerEquipmentId: string,
  severity: string,
  phase: string,
) {
  try {
    const [enrichedEvent, sopResult] = await Promise.all([
      api.getEventById(eventId),
      api.recommendSop({ event_id: eventId, equipment_id: triggerEquipmentId, severity }).catch(() => null),
    ]);

    const kgsResults = enrichedEvent.kgs_results || [];
    const affectedIds = kgsResults.map((k: any) => k.affected_equipment_id);

    const safetiaData = enrichedEvent.safetia_history || undefined;

    useAppStore.getState().setEventContext({
      event_id: eventId,
      scenario_id: scenarioId,
      trigger_equipment_id: triggerEquipmentId,
      affected_equipment_ids: affectedIds,
      severity: severity as any,
      current_phase: phase,
      hazop_id: enrichedEvent.hazop_id || null,
      kogas_result: enrichedEvent.kogas_result || undefined,
      kgs_results: kgsResults.length > 0 ? kgsResults : undefined,
      keti_result: enrichedEvent.keti_result || undefined,
      safetia_history: safetiaData,
      recommended_sops: sopResult ? (sopResult.all || [sopResult.primary]).filter(Boolean) : undefined,
    });
  } catch (err) {
    console.error('[SSE] Failed to enrich event context:', err);
  }
}
