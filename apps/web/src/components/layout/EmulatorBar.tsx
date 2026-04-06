// ref: CLAUDE.md §9.1, §21.2 — 에뮬레이터 하단 바 (반응형)
'use client';
import { useEffect, useState } from 'react';
import { useEmulatorStore } from '@/stores/emulatorStore';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';

const SPEEDS = [1, 10, 30, 60];

const PHASE_STYLES: Record<string, { color: string; bg: string; label: string; hex: string }> = {
  NORMAL:           { color: 'text-emerald-400', bg: 'bg-emerald-400', label: '정상',      hex: '#34d399' },
  SYMPTOM:          { color: 'text-amber-400',   bg: 'bg-amber-400',  label: '이상감지',   hex: '#fbbf24' },
  FAULT:            { color: 'text-red-400',     bg: 'bg-red-400',    label: '고장',      hex: '#f87171' },
  SECONDARY_IMPACT: { color: 'text-purple-400',  bg: 'bg-purple-400', label: '시뮬레이션', hex: '#c084fc' },
  RESPONSE:         { color: 'text-blue-400',    bg: 'bg-blue-400',   label: '대응/복구',  hex: '#60a5fa' },
  END:              { color: 'text-gray-500',    bg: 'bg-gray-500',   label: '종료',      hex: '#6b7280' },
};

// Phase segments for the progress bar (proportion of total duration based on default 900s)
const PHASE_SEGMENTS = [
  { key: 'NORMAL',           pct: 20, label: '정상' },
  { key: 'SYMPTOM',          pct: 20, label: '이상감지' },
  { key: 'FAULT',            pct: 27, label: '고장' },
  { key: 'SECONDARY_IMPACT', pct: 20, label: '시뮬레이션' },
  { key: 'RESPONSE',         pct: 13, label: '대응/복구' },
];

export function EmulatorBar() {
  const { running, paused, scenario_id, elapsed_sec, phase, speed, total_duration, setStatus } = useEmulatorStore();
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [selectedScenario, setSelectedScenario] = useState('SC-01');
  const [selectedSpeed, setSelectedSpeed] = useState(10);
  const [expanded, setExpanded] = useState(false);

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
      setStatus({ running: false, paused: false, elapsed_sec: 0, phase: 'NORMAL' });
      const appState = useAppStore.getState();
      appState.clearAlarms();
      appState.clearSensorData();
      appState.setEventContext(null);
      appState.setShowEventPopup(false);
    } catch {}
  };

  const handlePause = async () => {
    try { await api.pauseEmulator(); setStatus({ paused: true }); } catch {}
  };

  const handleResume = async () => {
    try { await api.resumeEmulator(); setStatus({ paused: false }); } catch {}
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = total_duration > 0 ? (elapsed_sec / total_duration) * 100 : 0;
  const ps = PHASE_STYLES[phase] || PHASE_STYLES.NORMAL;

  /* ---- Mobile: 미니 플로팅 버튼 ---- */
  return (
    <>
      {/* Mobile floating button (< 640px) */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="sm:hidden fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full bg-[#0c1220] border border-white/[0.1] shadow-xl flex items-center justify-center"
      >
        {running ? (
          <div className={`w-3 h-3 rounded-full ${ps.bg} ${phase === 'FAULT' ? 'animate-pulse' : ''}`} />
        ) : (
          <span className="text-cyan-400 text-lg">▶</span>
        )}
      </button>

      {/* Mobile expanded panel */}
      {expanded && (
        <div className="sm:hidden fixed bottom-16 right-4 left-4 z-40 bg-[#0c1220]/95 backdrop-blur-xl rounded-xl border border-white/[0.08] p-3 space-y-3 animate-fadeIn">
          {/* Scenario + Speed */}
          <div className="flex items-center gap-2">
            <select
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              disabled={running}
              className="flex-1 bg-white/[0.05] text-white border border-white/[0.08] rounded-lg px-2 py-1.5 text-[12px]"
            >
              {scenarios.map((s) => (
                <option key={s.scenario_id} value={s.scenario_id} className="bg-[#0c1220]">
                  {s.scenario_id}
                </option>
              ))}
            </select>
            <div className="flex gap-0.5 bg-white/[0.03] rounded-lg p-0.5">
              {SPEEDS.map((s) => (
                <button key={s} onClick={() => !running && setSelectedSpeed(s)} disabled={running}
                  className={`px-1.5 py-0.5 rounded text-[11px] ${selectedSpeed === s ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500'}`}>
                  {s}x
                </button>
              ))}
            </div>
          </div>
          {/* Controls */}
          <div className="flex items-center gap-2">
            {!running ? (
              <button onClick={handleStart} className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-2 rounded-lg font-medium text-[13px]">
                ▶ 시작
              </button>
            ) : (
              <>
                {paused ? (
                  <button onClick={handleResume} className="flex-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 py-2 rounded-lg text-[13px]">▶ 재개</button>
                ) : (
                  <button onClick={handlePause} className="flex-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 py-2 rounded-lg text-[13px]">⏸ 일시정지</button>
                )}
                <button onClick={handleStop} className="flex-1 bg-red-500/20 text-red-400 border border-red-500/30 py-2 rounded-lg text-[13px]">⏹ 중지</button>
              </>
            )}
          </div>
          {/* Progress */}
          {running && (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white/[0.06] rounded-full h-2">
                <div className={`h-full rounded-full ${ps.bg}`} style={{ width: `${Math.min(progress, 100)}%`, opacity: 0.85 }} />
              </div>
              <span className={`text-[12px] font-bold ${ps.color}`}>{ps.label}</span>
              <span className="text-gray-500 text-[11px] font-mono">{formatTime(elapsed_sec)}</span>
            </div>
          )}
          <button onClick={() => setExpanded(false)} className="absolute top-1 right-2 text-gray-500 text-xs">✕</button>
        </div>
      )}

      {/* Desktop/Tablet bar (>= 640px) */}
      <div className="hidden sm:flex h-11 bg-[#0c1220]/90 backdrop-blur-xl border-t border-white/[0.06] items-center px-2 md:px-4 gap-2 md:gap-3 text-[12px] md:text-[13px]">
        {/* Scenario select */}
        <div className="flex items-center gap-1 md:gap-2">
          <span className="text-gray-600 hidden md:inline">시나리오</span>
          <select
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(e.target.value)}
            disabled={running}
            className="bg-white/[0.05] text-white border border-white/[0.08] rounded-lg px-1.5 md:px-2 py-1 text-[12px] md:text-[13px] focus:border-cyan-500/50 focus:outline-none disabled:opacity-40 max-w-[180px] md:max-w-none"
          >
            {scenarios.map((s) => (
              <option key={s.scenario_id} value={s.scenario_id} className="bg-[#0c1220]">
                {s.scenario_id} {s.scenario_name?.slice(0, 20)}
              </option>
            ))}
          </select>
        </div>

        {/* Speed */}
        <div className="flex items-center gap-0.5 md:gap-1 bg-white/[0.03] rounded-lg p-0.5">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => !running && setSelectedSpeed(s)}
              disabled={running}
              className={`px-1.5 md:px-2 py-0.5 rounded-md text-[11px] md:text-[12px] transition-all ${
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
            className="flex items-center gap-1 md:gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-3 md:px-4 py-1.5 rounded-lg font-medium text-[12px] md:text-[13px] shadow-lg shadow-cyan-500/20">
            <span>▶</span> 시작
          </button>
        ) : (
          <div className="flex items-center gap-1 md:gap-1.5">
            <span className="text-cyan-400/60 text-[11px] hidden lg:inline">{scenario_id}</span>
            {paused ? (
              <button onClick={handleResume}
                className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 md:px-3 py-1.5 rounded-lg font-medium text-[12px] md:text-[13px]">
                <span>▶</span><span className="hidden md:inline"> 재개</span>
              </button>
            ) : (
              <button onClick={handlePause}
                className="flex items-center gap-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 md:px-3 py-1.5 rounded-lg font-medium text-[12px] md:text-[13px]">
                <span>⏸</span><span className="hidden md:inline"> 일시정지</span>
              </button>
            )}
            <button onClick={handleStop}
              className="flex items-center gap-1 bg-red-500/20 text-red-400 border border-red-500/30 px-2 md:px-3 py-1.5 rounded-lg font-medium text-[12px] md:text-[13px]">
              <span>⏹</span><span className="hidden md:inline"> 중지</span>
            </button>
          </div>
        )}

        {/* Progress — segmented phase bar */}
        <div className="flex-1 flex items-center gap-0 mx-1 md:mx-2">
          <div className="flex-1 relative">
            {/* Phase labels above the bar */}
            {running && (
              <div className="hidden lg:flex mb-0.5 gap-0">
                {PHASE_SEGMENTS.map((seg) => {
                  const segStyle = PHASE_STYLES[seg.key];
                  const isActive = phase === seg.key;
                  const isPast = PHASE_SEGMENTS.findIndex(s => s.key === phase) > PHASE_SEGMENTS.findIndex(s => s.key === seg.key);
                  return (
                    <div key={seg.key} className="text-center" style={{ width: `${seg.pct}%` }}>
                      <span className={`text-[11px] font-bold transition-all ${
                        isActive ? segStyle.color : isPast ? 'text-gray-500' : 'text-gray-600'
                      } ${isActive ? 'scale-110 inline-block' : ''}`}>
                        {isActive ? `▸ ${seg.label}` : seg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Segmented progress bar */}
            <div className="w-full flex h-2 rounded-full overflow-hidden gap-px bg-white/[0.03]">
              {PHASE_SEGMENTS.map((seg, idx) => {
                const segStyle = PHASE_STYLES[seg.key];
                const segStart = PHASE_SEGMENTS.slice(0, idx).reduce((sum, s) => sum + s.pct, 0);
                const segEnd = segStart + seg.pct;
                const isActive = phase === seg.key;
                const isPast = progress >= segEnd;
                const isPartial = progress > segStart && progress < segEnd;
                const fillPct = isPast ? 100 : isPartial ? ((progress - segStart) / seg.pct) * 100 : 0;

                return (
                  <div key={seg.key} className="relative h-full" style={{ width: `${seg.pct}%` }}>
                    {/* Background */}
                    <div className={`absolute inset-0 ${isPast || isPartial ? '' : 'bg-white/[0.04]'}`}
                      style={isPast || isPartial ? { backgroundColor: segStyle.hex, opacity: isPast ? 0.15 : 0.08 } : {}} />
                    {/* Fill */}
                    <div className="absolute inset-y-0 left-0 transition-all duration-300"
                      style={{ width: `${fillPct}%`, backgroundColor: segStyle.hex, opacity: 0.85 }} />
                    {/* Active pulse overlay */}
                    {isActive && (
                      <div className="absolute inset-0 animate-pulse"
                        style={{ backgroundColor: segStyle.hex, opacity: 0.1 }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Progress indicator dot */}
            {running && progress > 0 && (
              <div className={`absolute bottom-[-1px] w-2.5 h-2.5 rounded-full shadow-lg shadow-black/50 border border-white/30`}
                style={{ left: `calc(${Math.min(progress, 100)}% - 5px)`, backgroundColor: ps.hex }} />
            )}
          </div>
        </div>

        {/* Phase badge */}
        <div className={`flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1.5 rounded-lg border ${
          paused ? 'border-amber-500/30 bg-amber-500/10'
            : phase === 'FAULT' ? 'border-red-500/40 bg-red-500/15'
            : phase === 'SECONDARY_IMPACT' ? 'border-purple-500/40 bg-purple-500/15'
            : phase === 'SYMPTOM' ? 'border-amber-500/40 bg-amber-500/15'
            : phase === 'RESPONSE' ? 'border-blue-500/40 bg-blue-500/15'
            : 'border-white/[0.08] bg-white/[0.03]'
        }`}>
          {paused ? (
            <>
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-bold text-amber-400 text-[13px] md:text-[14px]">일시정지</span>
            </>
          ) : (
            <>
              <div className={`w-2 h-2 rounded-full ${ps.bg} ${phase === 'FAULT' ? 'animate-pulse' : ''}`} />
              <span className={`font-bold ${ps.color} text-[13px] md:text-[14px]`}>{ps.label}</span>
            </>
          )}
        </div>

        {/* Time */}
        <span className="text-gray-400 font-mono tabular-nums text-[11px] md:text-[13px] w-[60px] md:w-[72px] text-right">
          {formatTime(elapsed_sec)}<span className="text-gray-600">/{formatTime(total_duration)}</span>
        </span>
      </div>
    </>
  );
}
