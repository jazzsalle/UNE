// ref: CLAUDE.md §9.2 — 이벤트 팝업 (컴팩트, 이상이벤트 상세 강화)
'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState, useCallback, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { SEVERITY_COLORS, SEVERITY_KR, PHASE_KR, SENSOR_TYPE_KR } from '@/lib/constants';

const MODE_BUTTONS = [
  { label: '상태감시', path: '/anomaly', icon: '📊' },
  { label: '위험예측', path: '/risk', icon: '🎯' },
  { label: '시뮬레이션', path: '/simulation', icon: '🎬' },
  { label: 'SOP', icon: '📋', action: 'sopPopup' },
  { label: '이력', path: '/history', icon: '📁' },
];

export function EventPopup() {
  const { eventContext, setShowEventPopup, setShowSopPanel, sensorData } = useAppStore();
  const router = useRouter();
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

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
        className={`pointer-events-auto absolute w-[340px] glass overflow-hidden shadow-2xl shadow-black/50 ${isEmergency ? 'animate-pulseGlow' : ''}`}
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
          {/* Title row */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: severityColor + '20', color: severityColor }}>
              {SEVERITY_KR[eventContext.severity] || eventContext.severity}
            </span>
            <span className="text-[11px] font-bold text-white flex-1 truncate">
              {eventContext.trigger_equipment_id} 이상 감지
            </span>
            <button onClick={() => setShowEventPopup(false)} className="text-gray-600 hover:text-white p-0.5 rounded hover:bg-white/[0.05]">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 이벤트 상세 정보 (핵심 강조) */}
          <div className="space-y-1.5 mb-2.5">
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              <div className="bg-white/[0.03] rounded px-2 py-1.5">
                <div className="text-gray-500 text-[9px]">시나리오</div>
                <div className="text-white font-medium">{eventContext.scenario_id}</div>
              </div>
              <div className="bg-white/[0.03] rounded px-2 py-1.5">
                <div className="text-gray-500 text-[9px]">단계</div>
                <div className="text-amber-400 font-medium">{PHASE_KR[eventContext.current_phase] || eventContext.current_phase}</div>
              </div>
              <div className="bg-white/[0.03] rounded px-2 py-1.5">
                <div className="text-gray-500 text-[9px]">영향설비</div>
                <div className="text-yellow-400 font-medium">{eventContext.affected_equipment_ids?.length || 0}개</div>
              </div>
            </div>

            {/* 영향 설비 목록 */}
            {eventContext.affected_equipment_ids && eventContext.affected_equipment_ids.length > 0 && (
              <div className="bg-white/[0.03] rounded px-2 py-1.5 text-[10px]">
                <span className="text-gray-500">영향 범위: </span>
                <span className="text-yellow-300">
                  {eventContext.affected_equipment_ids.join(', ')}
                </span>
              </div>
            )}
          </div>

          {/* Enrichment 결과 (KOGAS/KGS/SOP) */}
          {hasEnrichment && (
            <div className="mb-2.5 space-y-1">
              {eventContext.kogas_result && (
                <div className="flex items-center gap-2 bg-white/[0.03] rounded px-2 py-1.5 text-[10px]">
                  <span className="text-cyan-400 font-bold text-[9px] w-12 shrink-0">KOGAS</span>
                  <span className="text-white flex-1 truncate">{eventContext.kogas_result.fault_name}</span>
                  <span className="text-cyan-400 font-mono text-[9px]">{Math.round((eventContext.kogas_result.diagnosis_confidence || 0) * 100)}%</span>
                </div>
              )}
              {eventContext.kgs_results && eventContext.kgs_results.length > 0 && (
                <div className="flex items-center gap-2 bg-white/[0.03] rounded px-2 py-1.5 text-[10px]">
                  <span className="text-amber-400 font-bold text-[9px] w-12 shrink-0">KGS</span>
                  <span className="text-white">영향 {eventContext.kgs_results.length}개</span>
                  <span className="text-amber-400 font-mono text-[9px] ml-auto">최대 {Math.max(...eventContext.kgs_results.map((k: any) => k.impact_score))}점</span>
                </div>
              )}
              {eventContext.recommended_sops && eventContext.recommended_sops.length > 0 && (
                <div className="flex items-center gap-2 bg-white/[0.03] rounded px-2 py-1.5 text-[10px]">
                  <span className="text-green-400 font-bold text-[9px] w-12 shrink-0">SOP</span>
                  <span className="text-white flex-1 truncate">{eventContext.recommended_sops[0].sop_name}</span>
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
            <div className="mb-2.5 bg-white/[0.03] rounded text-center py-2">
              <div className="text-[9px] text-gray-500 animate-pulse">진단 데이터 수집 중...</div>
            </div>
          )}

          {/* 모드 전환 버튼 (컴팩트 한 줄) */}
          <div className="flex gap-1">
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
                className="flex-1 text-center py-1.5 rounded bg-white/[0.03] border border-white/[0.06] hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all"
              >
                <div className="text-[9px] text-gray-400 hover:text-cyan-400">{btn.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
