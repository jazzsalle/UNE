// ref: CLAUDE.md §3.3 — SOP 팝업 오버레이 (운영모드에서 호출)
'use client';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';
import { SopExecutionPanel } from '@/components/sop/SopExecutionPanel';

export function SopPopupOverlay() {
  const { showSopPanel, setShowSopPanel, eventContext } = useAppStore();
  const [recommendedSop, setRecommendedSop] = useState<any>(null);

  useEffect(() => {
    if (showSopPanel && eventContext?.event_id) {
      api.recommendSop({ event_id: eventContext.event_id })
        .then((data) => setRecommendedSop(data.primary))
        .catch(console.error);
    }
  }, [showSopPanel, eventContext]);

  if (!showSopPanel || !recommendedSop) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 z-40 flex">
      {/* 클릭으로 닫기 배경 */}
      <div className="flex-1" onClick={() => setShowSopPanel(false)} />
      <SopExecutionPanel
        sop={recommendedSop}
        compact={true}
        eventId={eventContext?.event_id || ''}
        onClose={() => setShowSopPanel(false)}
      />
    </div>
  );
}
