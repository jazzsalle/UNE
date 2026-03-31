// ref: CLAUDE.md §9.2 — 이벤트 팝업 (드래그 가능, 소형, enrichment + SOP 추천)
'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState, useCallback, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { SEVERITY_COLORS } from '@/lib/constants';

const MODE_BUTTONS = [
  { label: '이상탐지', path: '/anomaly', icon: '📊' },
  { label: '위험예측', path: '/risk', icon: '🎯' },
  { label: '시뮬레이션', path: '/simulation', icon: '🎬' },
  { label: 'SOP 팝업', icon: '📋', action: 'sopPopup' },
  { label: 'SOP 전체', path: '/sop', icon: '📑' },
  { label: '이력조회', path: '/history', icon: '📁' },
];

export function EventPopup() {
  const { eventContext, setShowEventPopup, setShowSopPanel } = useAppStore();
  const router = useRouter();
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Center on mount
  useEffect(() => {
    if (popupRef.current) {
      const rect = popupRef.current.getBoundingClientRect();
      setPos({
        x: (window.innerWidth - rect.width) / 2,
        y: Math.min(80, (window.innerHeight - rect.height) / 3),
      });
    }
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    setDragging(true);
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  }, [pos]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  if (!eventContext) return null;

  const severityColor = SEVERITY_COLORS[eventContext.severity] || '#fff';
  const isEmergency = eventContext.severity === 'EMERGENCY' || eventContext.severity === 'CRITICAL';
  const hasEnrichment = !!(eventContext.kogas_result || eventContext.kgs_results?.length || eventContext.recommended_sops?.length);

  const navigateMode = (path: string) => {
    setShowEventPopup(false);
    router.push(path);
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        ref={popupRef}
        className={`pointer-events-auto absolute w-[360px] glass overflow-hidden shadow-2xl shadow-black/50 ${isEmergency ? 'animate-pulseGlow' : ''}`}
        style={{
          left: pos.x,
          top: pos.y,
          cursor: dragging ? 'grabbing' : 'grab',
        }}
        onMouseDown={onMouseDown}
      >
        {/* Header gradient bar */}
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${severityColor}, transparent)` }} />

        <div className="p-3">
          {/* Title */}
          <div className="flex items-start gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
              style={{ backgroundColor: severityColor + '20' }}>
              ⚠
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="badge text-[9px]" style={{ backgroundColor: severityColor + '20', color: severityColor }}>
                  {eventContext.severity}
                </span>
                <span className="text-gray-500 text-[9px]">{eventContext.scenario_id}</span>
              </div>
              <div className="text-xs font-semibold mt-0.5 truncate">{eventContext.trigger_equipment_id} 이상 감지</div>
            </div>
            <button onClick={() => setShowEventPopup(false)} className="text-gray-600 hover:text-white p-0.5 rounded hover:bg-white/[0.05]">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Info cards - compact */}
          <div className="flex gap-2 mb-3 text-[10px]">
            <div className="data-card flex-1 !p-2">
              <div className="text-gray-500 text-[9px]">트리거</div>
              <div className="text-white font-medium">{eventContext.trigger_equipment_id}</div>
            </div>
            <div className="data-card flex-1 !p-2">
              <div className="text-gray-500 text-[9px]">Phase</div>
              <div className="text-amber-400 font-medium">{eventContext.current_phase}</div>
            </div>
          </div>

          {/* Enrichment summary */}
          {hasEnrichment && (
            <div className="mb-3 space-y-1.5">
              {eventContext.kogas_result && (
                <div className="data-card flex items-center gap-2 !p-2">
                  <span className="text-[9px] text-cyan-400 font-semibold w-10 shrink-0">KOGAS</span>
                  <span className="text-[10px] text-white flex-1 truncate">{eventContext.kogas_result.fault_name}</span>
                  <span className="text-[9px] text-gray-500">{Math.round((eventContext.kogas_result.diagnosis_confidence || 0) * 100)}%</span>
                </div>
              )}
              {eventContext.kgs_results && eventContext.kgs_results.length > 0 && (
                <div className="data-card flex items-center gap-2 !p-2">
                  <span className="text-[9px] text-amber-400 font-semibold w-10 shrink-0">KGS</span>
                  <span className="text-[10px] text-white">영향 {eventContext.kgs_results.length}개</span>
                  <span className="text-[9px] text-gray-500 ml-auto">max {Math.max(...eventContext.kgs_results.map((k: any) => k.impact_score))}점</span>
                </div>
              )}
              {eventContext.recommended_sops && eventContext.recommended_sops.length > 0 && (
                <div className="data-card flex items-center gap-2 !p-2">
                  <span className="text-[9px] text-green-400 font-semibold w-10 shrink-0">SOP</span>
                  <span className="text-[10px] text-white flex-1 truncate">{eventContext.recommended_sops[0].sop_name}</span>
                  <button
                    onClick={() => { setShowEventPopup(false); setShowSopPanel(true); }}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30"
                  >
                    실행
                  </button>
                </div>
              )}
            </div>
          )}

          {!hasEnrichment && (
            <div className="mb-3 data-card text-center !p-2">
              <div className="text-[9px] text-gray-500 animate-pulse">진단 데이터 로딩 중...</div>
            </div>
          )}

          {/* Mode buttons - compact 2x3 grid */}
          <div className="grid grid-cols-3 gap-1.5">
            {MODE_BUTTONS.map((btn) => (
              <button
                key={btn.label}
                onClick={() => {
                  if (btn.action === 'sopPopup') {
                    setShowEventPopup(false);
                    setShowSopPanel(true);
                  } else if (btn.path) {
                    navigateMode(btn.path);
                  }
                }}
                className="data-card text-center !p-2 group hover:border-cyan-500/30 hover:bg-cyan-500/5"
              >
                <div className="text-sm mb-0.5">{btn.icon}</div>
                <div className="text-[9px] font-medium text-gray-300 group-hover:text-cyan-400">{btn.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
