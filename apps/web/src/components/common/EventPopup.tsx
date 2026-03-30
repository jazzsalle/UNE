// ref: CLAUDE.md §9.2 — 이벤트 팝업 (세련된 디자인)
'use client';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/appStore';
import { SEVERITY_COLORS } from '@/lib/constants';

const MODE_BUTTONS = [
  { label: '이상탐지', path: '/anomaly', icon: '📊', desc: 'KOGAS AI 진단' },
  { label: '위험예측', path: '/risk', icon: '🎯', desc: 'KGS 영향분석' },
  { label: '시뮬레이션', path: '/simulation', icon: '🎬', desc: 'KETI 대응안' },
  { label: 'SOP 팝업', icon: '📋', desc: '현재모드 유지', action: 'sopPopup' },
  { label: 'SOP 전체', path: '/sop', icon: '📑', desc: '전체화면 전환' },
  { label: '이력조회', path: '/history', icon: '📁', desc: '세이프티아 이력' },
];

export function EventPopup() {
  const { eventContext, setShowEventPopup, setShowSopPanel } = useAppStore();
  const router = useRouter();

  if (!eventContext) return null;

  const severityColor = SEVERITY_COLORS[eventContext.severity] || '#fff';
  const isEmergency = eventContext.severity === 'EMERGENCY' || eventContext.severity === 'CRITICAL';

  const navigateMode = (path: string) => {
    setShowEventPopup(false);
    router.push(path);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
      <div className={`glass max-w-lg w-full mx-4 overflow-hidden ${isEmergency ? 'animate-pulseGlow' : ''}`}>
        {/* Header gradient bar */}
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${severityColor}, transparent)` }} />

        <div className="p-5">
          {/* Title */}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ backgroundColor: severityColor + '20' }}>
              ⚠
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="badge" style={{ backgroundColor: severityColor + '20', color: severityColor }}>
                  {eventContext.severity}
                </span>
                <span className="text-gray-500 text-[10px]">{eventContext.scenario_id}</span>
              </div>
              <div className="text-sm font-semibold mt-1">{eventContext.trigger_equipment_id} 이상 감지</div>
            </div>
            <button onClick={() => setShowEventPopup(false)} className="text-gray-600 hover:text-white p-1 rounded-lg hover:bg-white/[0.05]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Info */}
          <div className="flex gap-4 mb-5 text-[11px]">
            <div className="data-card flex-1">
              <div className="text-gray-500 text-[10px]">트리거 설비</div>
              <div className="text-white font-medium mt-0.5">{eventContext.trigger_equipment_id}</div>
            </div>
            <div className="data-card flex-1">
              <div className="text-gray-500 text-[10px]">현재 Phase</div>
              <div className="text-amber-400 font-medium mt-0.5">{eventContext.current_phase}</div>
            </div>
            <div className="data-card flex-1">
              <div className="text-gray-500 text-[10px]">이벤트 ID</div>
              <div className="text-white font-mono text-[10px] mt-0.5">{eventContext.event_id?.slice(0, 12)}</div>
            </div>
          </div>

          {/* Mode buttons */}
          <div className="grid grid-cols-3 gap-2">
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
                className="data-card text-left group hover:border-cyan-500/30 hover:bg-cyan-500/5"
              >
                <div className="text-base mb-1">{btn.icon}</div>
                <div className="text-[11px] font-medium text-white group-hover:text-cyan-400 transition-colors">{btn.label}</div>
                <div className="text-[9px] text-gray-500 mt-0.5">{btn.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
