// ref: CLAUDE.md §6 — 에뮬레이터 상태
'use client';
import { create } from 'zustand';

interface EmulatorState {
  running: boolean;
  scenario_id: string | null;
  elapsed_sec: number;
  phase: string;
  speed: number;
  total_duration: number;

  setStatus: (status: Partial<EmulatorState>) => void;
  reset: () => void;
}

export const useEmulatorStore = create<EmulatorState>((set) => ({
  running: false,
  scenario_id: null,
  elapsed_sec: 0,
  phase: 'NORMAL',
  speed: 10,
  total_duration: 900,

  setStatus: (status) => set((state) => ({ ...state, ...status })),
  reset: () => set({ running: false, scenario_id: null, elapsed_sec: 0, phase: 'NORMAL', speed: 10, total_duration: 900 }),
}));
