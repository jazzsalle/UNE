// ref: CLAUDE.md §4.1 — EventContext + AppStore
'use client';
import { create } from 'zustand';
import type { ModeCode } from '@/lib/constants';

export interface EventContext {
  event_id: string | null;
  scenario_id: string | null;
  trigger_equipment_id: string | null;
  affected_equipment_ids: string[];
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';
  current_phase: string;
  hazop_id: string | null;
  kogas_result?: any;
  kgs_results?: any[];
  keti_result?: any;
  safetia_history?: any[];
  recommended_sops?: any[];
}

interface SensorData {
  sensor_id: string;
  value: number;
  quality: string;
  label: string;
  elapsed_sec: number;
}

interface AlarmEntry {
  sensor_id: string;
  value: number;
  label: string;
  phase: string;
  timestamp: string;
  acknowledged: boolean;
  id: string;
}

interface AppState {
  currentMode: ModeCode;
  eventContext: EventContext | null;
  selectedEquipmentId: string | null;
  sensorData: Record<string, SensorData>;
  alarms: AlarmEntry[];
  showEventPopup: boolean;
  showSopPanel: boolean;

  setMode: (mode: ModeCode) => void;
  setEventContext: (ctx: EventContext | null) => void;
  switchModeWithContext: (mode: ModeCode) => void;
  setSelectedEquipment: (id: string | null) => void;
  updateSensorData: (data: SensorData[]) => void;
  addAlarm: (alarm: any) => void;
  acknowledgeAlarm: (id: string) => void;
  removeAlarm: (id: string) => void;
  clearAlarms: () => void;
  setShowEventPopup: (show: boolean) => void;
  setShowSopPanel: (show: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentMode: 'M-MON',
  eventContext: null,
  selectedEquipmentId: null,
  sensorData: {},
  alarms: [],
  showEventPopup: false,
  showSopPanel: false,

  setMode: (mode) => set({ currentMode: mode }),
  setEventContext: (ctx) => set({ eventContext: ctx }),
  switchModeWithContext: (mode) => set((state) => ({ ...state, currentMode: mode })),
  setSelectedEquipment: (id) => set({ selectedEquipmentId: id }),
  updateSensorData: (data) => set((state) => {
    const updated = { ...state.sensorData };
    for (const d of data) updated[d.sensor_id] = d;
    return { sensorData: updated };
  }),
  addAlarm: (alarm) => set((state) => ({
    alarms: [{ ...alarm, acknowledged: false, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }, ...state.alarms].slice(0, 100),
  })),
  acknowledgeAlarm: (id) => set((state) => ({
    alarms: state.alarms.map(a => a.id === id ? { ...a, acknowledged: true } : a),
  })),
  removeAlarm: (id) => set((state) => ({
    alarms: state.alarms.filter(a => a.id !== id),
  })),
  clearAlarms: () => set({ alarms: [] }),
  setShowEventPopup: (show) => set({ showEventPopup: show }),
  setShowSopPanel: (show) => set({ showSopPanel: show }),
}));
