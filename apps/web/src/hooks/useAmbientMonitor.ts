// ref: CLAUDE.md §6, §9.2 — 상시 모니터링 (시나리오 미실행 시 더미 센서 데이터 + 공정 애니메이션)
'use client';
import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { useAppStore } from '@/stores/appStore';
import { useEmulatorStore } from '@/stores/emulatorStore';

// 상시 모니터링 공정 단계 (애니메이션 상태머신)
export type AmbientPhase =
  | 'SHIP_APPROACH'       // 선박 진입 (0~15초)
  | 'ARM_CONNECT'         // 로딩암 연결 (15~20초)
  | 'UNLOADING'           // 하역 + 배관 흐름 (20~50초)
  | 'STORAGE_PROCESS'     // 저장+BOG 순환 (50~70초)
  | 'TRANSFER'            // 이송+기화 (70~90초)
  | 'IDLE';               // 짧은 대기 후 반복 (90~95초)

const PHASE_TIMELINE: { phase: AmbientPhase; startSec: number; endSec: number }[] = [
  { phase: 'SHIP_APPROACH',    startSec: 0,  endSec: 15 },
  { phase: 'ARM_CONNECT',      startSec: 15, endSec: 20 },
  { phase: 'UNLOADING',        startSec: 20, endSec: 50 },
  { phase: 'STORAGE_PROCESS',  startSec: 50, endSec: 70 },
  { phase: 'TRANSFER',         startSec: 70, endSec: 90 },
  { phase: 'IDLE',             startSec: 90, endSec: 95 },
];

const CYCLE_DURATION = 95; // 전체 1사이클 (초)

// 센서별 정상 범위 기준값 (seed_sensor_thresholds.json 기반)
const SENSOR_NORMALS: Record<string, { normal: number; jitter: number }> = {
  'TK-101-PRE-01': { normal: 4.2,    jitter: 0.15 },
  'TK-101-TEM-02': { normal: -253.0, jitter: 0.8 },
  'TK-101-LEV-03': { normal: 78,     jitter: 1.5 },
  'BOG-201-PRE-01': { normal: 6.5,   jitter: 0.2 },
  'BOG-201-TEM-02': { normal: -145.0,jitter: 1.0 },
  'BOG-201-FLO-03': { normal: 1800,  jitter: 30 },
  'BOG-201-VIB-04': { normal: 2.2,   jitter: 0.15 },
  'BOG-201-CUR-05': { normal: 86,    jitter: 2.0 },
  'PMP-301-PRE-01': { normal: 7.1,   jitter: 0.15 },
  'PMP-301-TEM-02': { normal: -248.0,jitter: 0.8 },
  'PMP-301-FLO-03': { normal: 3200,  jitter: 40 },
  'PMP-301-VIB-04': { normal: 2.8,   jitter: 0.2 },
  'PMP-301-CUR-05': { normal: 112,   jitter: 3.0 },
  'VAP-401-PRE-01': { normal: 6.8,   jitter: 0.15 },
  'VAP-401-TEM-02': { normal: -190.0,jitter: 1.0 },
  'VAP-401-FLO-03': { normal: 3100,  jitter: 35 },
  'PIP-501-PRE-01': { normal: 6.9,   jitter: 0.15 },
  'PIP-501-TEM-02': { normal: -240.0,jitter: 0.8 },
  'PIP-501-FLO-03': { normal: 3150,  jitter: 35 },
  'VAL-601-PRE-01': { normal: 6.8,   jitter: 0.15 },
  'VAL-601-TEM-02': { normal: -238.0,jitter: 0.8 },
  'VAL-601-FLO-03': { normal: 3120,  jitter: 30 },
  'VAL-602-PRE-01': { normal: 6.7,   jitter: 0.15 },
  'VAL-602-TEM-02': { normal: -237.0,jitter: 0.8 },
  'VAL-602-FLO-03': { normal: 3100,  jitter: 30 },
  'TK-102-PRE-01':  { normal: 4.1,   jitter: 0.15 },
  'TK-102-TEM-02':  { normal: -253.2,jitter: 0.8 },
  'TK-102-LEV-03':  { normal: 72,    jitter: 1.5 },
  'REL-701-PRE-01': { normal: 5.8,   jitter: 0.15 },
  'REL-701-TEM-02': { normal: -165.0,jitter: 1.0 },
  'REL-701-FLO-03': { normal: 900,   jitter: 15 },
  'REL-701-CUR-04': { normal: 64,    jitter: 2.0 },
  'SHP-001-PRE-01': { normal: 1.5,   jitter: 0.05 },
  'SHP-001-TMP-01': { normal: -253.0,jitter: 0.3 },
  'SHP-001-LVL-01': { normal: 85.0,  jitter: 0.5 },
  'SHP-001-FLO-01': { normal: 120.0, jitter: 5.0 },
  'ARM-101-PRE-01': { normal: 3.5,   jitter: 0.1 },
  'ARM-101-TMP-01': { normal: -252.0,jitter: 0.5 },
  'ARM-101-FLO-01': { normal: 120.0, jitter: 5.0 },
  'ARM-101-VIB-01': { normal: 1.5,   jitter: 0.1 },
};

// 공정 단계별 활성 센서 (해당 공정에 참여하는 설비 센서만 값 변동)
const PHASE_ACTIVE_PREFIXES: Record<AmbientPhase, string[]> = {
  SHIP_APPROACH:   ['SHP-001'],
  ARM_CONNECT:     ['SHP-001', 'ARM-101'],
  UNLOADING:       ['SHP-001', 'ARM-101', 'PIP-501', 'TK-101', 'TK-102'],
  STORAGE_PROCESS: ['TK-101', 'TK-102', 'BOG-201', 'REL-701'],
  TRANSFER:        ['TK-101', 'TK-102', 'PMP-301', 'VAL-601', 'VAL-602', 'VAP-401', 'PIP-501'],
  IDLE:            [],
};

function generateSensorValue(sensorId: string, elapsedSec: number, phase: AmbientPhase): number {
  const config = SENSOR_NORMALS[sensorId];
  if (!config) return 0;

  const prefix = sensorId.split('-').slice(0, 2).join('-');
  const activePrefixes = PHASE_ACTIVE_PREFIXES[phase];
  const isActive = activePrefixes.includes(prefix);

  const seed = hashString(sensorId);
  const t = elapsedSec * 0.1;
  const noise = Math.sin(t * 1.7 + seed) * 0.3 + Math.sin(t * 3.1 + seed * 2) * 0.2;

  if (isActive) {
    return config.normal + config.jitter * noise;
  } else {
    return config.normal + config.jitter * noise * 0.3;
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return (hash % 1000) / 1000;
}

// ─── Zustand store for ambient animation state ───

export interface AmbientState {
  active: boolean;
  phase: AmbientPhase;
  elapsedSec: number;
  cycleCount: number;
  shipProgress: number;
  armProgress: number;
  activeFlows: {
    shipToArm: boolean;
    armToPipe: boolean;
    pipeToTank: boolean;
    tankToBog: boolean;
    bogToRel: boolean;
    relToTank: boolean;
    tankToPump: boolean;
    pumpToValve: boolean;
    valveToVap: boolean;
  };
}

const INITIAL_FLOWS = {
  shipToArm: false, armToPipe: false, pipeToTank: false,
  tankToBog: false, bogToRel: false, relToTank: false,
  tankToPump: false, pumpToValve: false, valveToVap: false,
};

interface AmbientStore extends AmbientState {
  setState: (state: Partial<AmbientState>) => void;
}

export const useAmbientStore = create<AmbientStore>((set) => ({
  active: false,
  phase: 'SHIP_APPROACH' as AmbientPhase,
  elapsedSec: 0,
  cycleCount: 0,
  shipProgress: 0,
  armProgress: 0,
  activeFlows: { ...INITIAL_FLOWS },
  setState: (state) => set(state),
}));

function computeAmbientState(elapsedSec: number, cycleCount: number): Omit<AmbientState, 'active'> {
  const cycleTime = elapsedSec % CYCLE_DURATION;
  let phase: AmbientPhase = 'IDLE';
  for (const pt of PHASE_TIMELINE) {
    if (cycleTime >= pt.startSec && cycleTime < pt.endSec) {
      phase = pt.phase;
      break;
    }
  }

  let shipProgress = 0;
  if (phase === 'SHIP_APPROACH') {
    shipProgress = (cycleTime - 0) / 15;
  } else if (cycleTime >= 15) {
    shipProgress = 1;
  }

  let armProgress = 0;
  if (phase === 'ARM_CONNECT') {
    armProgress = (cycleTime - 15) / 5;
  } else if (cycleTime >= 20) {
    armProgress = 1;
  }

  const activeFlows = { ...INITIAL_FLOWS };
  if (phase === 'UNLOADING' || phase === 'STORAGE_PROCESS' || phase === 'TRANSFER') {
    if (cycleTime >= 20) {
      activeFlows.shipToArm = true;
      activeFlows.armToPipe = true;
      activeFlows.pipeToTank = true;
    }
  }
  if (phase === 'STORAGE_PROCESS' || phase === 'TRANSFER') {
    activeFlows.tankToBog = true;
    activeFlows.bogToRel = true;
    activeFlows.relToTank = true;
  }
  if (phase === 'TRANSFER') {
    activeFlows.tankToPump = true;
    activeFlows.pumpToValve = true;
    activeFlows.valveToVap = true;
  }

  return { phase, elapsedSec, cycleCount, shipProgress, armProgress, activeFlows };
}

/**
 * 상시 모니터링 훅 — layout에서 1회 호출.
 * 시나리오 미실행 시 더미 센서 데이터를 생성하고 AmbientStore를 업데이트.
 */
export function useAmbientMonitor() {
  const emulatorRunning = useEmulatorStore((s) => s.running);
  const updateSensorData = useAppStore((s) => s.updateSensorData);
  const setAmbientState = useAmbientStore((s) => s.setState);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const cycleRef = useRef(0);

  useEffect(() => {
    if (emulatorRunning) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setAmbientState({ active: false });
      return;
    }

    // 시나리오 미실행: 처음부터 시작
    elapsedRef.current = 0;
    cycleRef.current = 0;

    const tick = () => {
      elapsedRef.current += 1;
      const newCycle = Math.floor(elapsedRef.current / CYCLE_DURATION);
      if (newCycle > cycleRef.current) cycleRef.current = newCycle;

      const computed = computeAmbientState(elapsedRef.current, cycleRef.current);
      setAmbientState({ ...computed, active: true });

      const sensorBatch = Object.keys(SENSOR_NORMALS).map((sensorId) => ({
        sensor_id: sensorId,
        value: generateSensorValue(sensorId, elapsedRef.current, computed.phase),
        quality: 'GOOD',
        label: 'NORMAL',
        elapsed_sec: elapsedRef.current,
      }));
      updateSensorData(sensorBatch);
    };

    tick();
    timerRef.current = setInterval(tick, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [emulatorRunning, updateSensorData, setAmbientState]);
}
