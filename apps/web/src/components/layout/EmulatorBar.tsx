// ref: CLAUDE.md §9.1 — 에뮬레이터 하단 바 (세련된 디자인)
'use client';
import { useEffect, useState } from 'react';
import { useEmulatorStore } from '@/stores/emulatorStore';
import { api } from '@/lib/api';

const SPEEDS = [1, 10, 30, 60];

const PHASE_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  NORMAL:           { color: 'text-emerald-400', bg: 'bg-emerald-400', label: '정상' },
  SYMPTOM:          { color: 'text-amber-400',   bg: 'bg-amber-400',  label: '증상감지' },
  FAULT:            { color: 'text-red-400',     bg: 'bg-red-400',    label: '고장' },
  SECONDARY_IMPACT: { color: 'text-orange-400',  bg: 'bg-orange-400', label: '2차영향' },
  RESPONSE:         { color: 'text-blue-400',    bg: 'bg-blue-400',   label: '대응' },
  END:              { color: 'text-gray-500',    bg: 'bg-gray-500',   label: '종료' },
};

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
    } catch (err: any) { console.error(err); }
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
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = total_duration > 0 ? (elapsed_sec / total_duration) * 100 : 0;
  const ps = PHASE_STYLES[phase] || PHASE_STYLES.NORMAL;

  return (
    <div className="h-11 bg-[#0c1220]/90 backdrop-blur-xl border-t border-white/[0.06] flex items-center px-4 gap-3 text-[11px]">
      {/* Scenario select */}
      <div className="flex items-center gap-2">
        <span className="text-gray-600 hidden sm:inline">시나리오</span>
        <select
          value={selectedScenario}
          onChange={(e) => setSelectedScenario(e.target.value)}
          disabled={running}
          className="bg-white/[0.05] text-white border border-white/[0.08] rounded-lg px-2 py-1 text-[11px] focus:border-cyan-500/50 focus:outline-none disabled:opacity-40"
        >
          {scenarios.map((s) => (
            <option key={s.scenario_id} value={s.scenario_id} className="bg-[#0c1220]">
              {s.scenario_id} {s.scenario_name?.slice(0, 20)}
            </option>
          ))}
        </select>
      </div>

      {/* Speed */}
      <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => !running && setSelectedSpeed(s)}
            disabled={running}
            className={`px-2 py-0.5 rounded-md text-[10px] transition-all ${
              selectedSpeed === s
                ? 'bg-cyan-500/20 text-cyan-400 font-medium'
                : 'text-gray-500 hover:text-gray-300 disabled:opacity-40'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Controls */}
      {!running ? (
        <button onClick={handleStart}
          className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-4 py-1.5 rounded-lg font-medium text-[11px] shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-shadow">
          <span>▶</span> 시작
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-cyan-400/60 text-[10px] hidden md:inline">{scenario_id}</span>
          <button onClick={handleStop}
            className="flex items-center gap-1.5 bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg font-medium text-[11px] hover:bg-red-500/30 transition-colors">
            <span>⏹</span> 중지
          </button>
        </div>
      )}

      {/* Progress */}
      <div className="flex-1 flex items-center gap-3 mx-2">
        <div className="flex-1 relative group">
          {/* Phase label markers (shown on hover or running) */}
          {running && (
            <div className="absolute -top-4 left-0 w-full flex text-[8px] text-gray-600 pointer-events-none">
              <span style={{ position: 'absolute', left: '10%', transform: 'translateX(-50%)' }}>정상</span>
              <span style={{ position: 'absolute', left: '30%', transform: 'translateX(-50%)' }}>증상</span>
              <span style={{ position: 'absolute', left: '53%', transform: 'translateX(-50%)' }}>고장</span>
              <span style={{ position: 'absolute', left: '77%', transform: 'translateX(-50%)' }}>2차</span>
              <span style={{ position: 'absolute', left: '93%', transform: 'translateX(-50%)' }}>대응</span>
            </div>
          )}
          <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${ps.bg}`}
              style={{ width: `${Math.min(progress, 100)}%`, opacity: 0.8 }}
            />
          </div>
          {/* Phase divider markers */}
          <div className="absolute top-0 left-0 w-full h-full flex">
            {[20, 40, 67, 87].map((pct) => (
              <div key={pct} className="absolute top-0 h-full w-px bg-white/[0.1]" style={{ left: `${pct}%` }} />
            ))}
          </div>
          {/* Current position indicator */}
          {running && progress > 0 && (
            <div
              className={`absolute top-[-1px] w-2 h-2 rounded-full ${ps.bg} shadow-sm`}
              style={{ left: `calc(${Math.min(progress, 100)}% - 4px)` }}
            />
          )}
        </div>
      </div>

      {/* Phase badge */}
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
        phase === 'FAULT' || phase === 'SECONDARY_IMPACT'
          ? 'border-red-500/30 bg-red-500/10'
          : phase === 'SYMPTOM'
          ? 'border-amber-500/30 bg-amber-500/10'
          : 'border-white/[0.08] bg-white/[0.03]'
      }`}>
        <div className={`w-1.5 h-1.5 rounded-full ${ps.bg} ${phase === 'FAULT' ? 'animate-pulse' : ''}`} />
        <span className={`font-medium ${ps.color}`}>{ps.label}</span>
      </div>

      {/* Time */}
      <span className="text-gray-400 font-mono tabular-nums w-[72px] text-right">
        {formatTime(elapsed_sec)}<span className="text-gray-600">/{formatTime(total_duration)}</span>
      </span>
    </div>
  );
}
