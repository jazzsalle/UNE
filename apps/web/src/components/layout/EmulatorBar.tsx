// ref: CLAUDE.md §9.1 — 에뮬레이터 하단 바
'use client';
import { useEffect, useState } from 'react';
import { useEmulatorStore } from '@/stores/emulatorStore';
import { api } from '@/lib/api';

const SPEEDS = [1, 10, 30, 60];

export function EmulatorBar() {
  const { running, scenario_id, elapsed_sec, phase, speed, total_duration, setStatus } = useEmulatorStore();
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [selectedScenario, setSelectedScenario] = useState('SC-01');
  const [selectedSpeed, setSelectedSpeed] = useState(10);

  useEffect(() => {
    api.getScenarios().then(setScenarios).catch(() => {});
  }, []);

  const handleStart = async () => {
    try {
      await api.startEmulator(selectedScenario, selectedSpeed);
      setStatus({ running: true, scenario_id: selectedScenario, speed: selectedSpeed, elapsed_sec: 0, phase: 'NORMAL' });
    } catch (err: any) {
      console.error('Emulator start failed:', err);
    }
  };

  const handleStop = async () => {
    try {
      await api.stopEmulator();
      setStatus({ running: false, elapsed_sec: 0, phase: 'NORMAL' });
    } catch {}
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = total_duration > 0 ? (elapsed_sec / total_duration) * 100 : 0;

  const phaseColor: Record<string, string> = {
    NORMAL: 'text-green-400', SYMPTOM: 'text-yellow-400', FAULT: 'text-red-400',
    SECONDARY_IMPACT: 'text-orange-400', RESPONSE: 'text-blue-400', END: 'text-gray-400',
  };

  return (
    <div className="h-10 bg-bg-secondary border-t border-gray-700 flex items-center px-4 gap-3 text-xs">
      <span className="text-gray-500">시나리오:</span>
      <select
        value={selectedScenario}
        onChange={(e) => setSelectedScenario(e.target.value)}
        disabled={running}
        className="bg-bg-tertiary text-white border border-gray-600 rounded px-2 py-0.5 text-xs"
      >
        {scenarios.map((s) => (
          <option key={s.scenario_id} value={s.scenario_id}>{s.scenario_id} {s.scenario_name}</option>
        ))}
      </select>

      <select
        value={selectedSpeed}
        onChange={(e) => setSelectedSpeed(Number(e.target.value))}
        disabled={running}
        className="bg-bg-tertiary text-white border border-gray-600 rounded px-2 py-0.5 text-xs"
      >
        {SPEEDS.map((s) => <option key={s} value={s}>{s}x</option>)}
      </select>

      {!running ? (
        <button onClick={handleStart} className="bg-accent-green text-black px-3 py-0.5 rounded font-medium hover:bg-green-400">▶ 시작</button>
      ) : (
        <button onClick={handleStop} className="bg-accent-red text-white px-3 py-0.5 rounded font-medium hover:bg-red-400">⏹ 중지</button>
      )}

      <div className="flex-1 mx-2">
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div className="bg-accent-cyan h-2 rounded-full transition-all duration-300" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      </div>

      <span className={`font-mono ${phaseColor[phase] || 'text-gray-400'}`}>{phase}</span>
      <span className="text-gray-500 font-mono">{formatTime(elapsed_sec)}/{formatTime(total_duration)}</span>
      <span className="text-gray-500">Speed: {speed}x</span>
    </div>
  );
}
