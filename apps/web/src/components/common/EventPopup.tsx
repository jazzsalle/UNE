// ref: CLAUDE.md §9.2 — 이벤트 팝업
'use client';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/appStore';
import { SEVERITY_COLORS } from '@/lib/constants';

export function EventPopup() {
  const { eventContext, setShowEventPopup, setShowSopPanel, switchModeWithContext } = useAppStore();
  const router = useRouter();

  if (!eventContext) return null;

  const navigateMode = (path: string) => {
    setShowEventPopup(false);
    router.push(path);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-bg-secondary border border-gray-600 rounded-lg p-5 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg" style={{ color: SEVERITY_COLORS[eventContext.severity] || '#fff' }}>⚠</span>
          <span className="font-bold text-sm" style={{ color: SEVERITY_COLORS[eventContext.severity] || '#fff' }}>
            {eventContext.severity}
          </span>
          <span className="text-gray-400 text-xs ml-auto">{eventContext.scenario_id}</span>
        </div>

        <div className="text-xs text-gray-400 mb-1">설비: {eventContext.trigger_equipment_id}</div>
        <div className="text-xs text-gray-400 mb-3">이벤트: {eventContext.event_id}</div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: '이상탐지', path: '/anomaly' },
            { label: '위험예측', path: '/risk' },
            { label: '시뮬레이션', path: '/simulation' },
            { label: 'SOP 팝업', action: () => { setShowEventPopup(false); setShowSopPanel(true); } },
            { label: 'SOP 전체화면', path: '/sop' },
            { label: '이력조회', path: '/history' },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={() => btn.path ? navigateMode(btn.path) : btn.action?.()}
              className="text-[10px] bg-bg-tertiary hover:bg-gray-600 text-white py-2 px-2 rounded transition-colors"
            >
              {btn.label}
            </button>
          ))}
        </div>

        <button onClick={() => setShowEventPopup(false)} className="w-full text-xs text-gray-500 hover:text-white py-1">
          닫기
        </button>
      </div>
    </div>
  );
}
