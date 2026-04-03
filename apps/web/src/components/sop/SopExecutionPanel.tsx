// ref: CLAUDE.md §3.3 — SOP 실행 패널 래퍼 (compact/full 듀얼 UI)
// 다른 모드에서 팝업으로 호출할 때 사용 (compact=true)
'use client';
import { SopFlowChart } from './SopFlowChart';

interface SopExecutionPanelProps {
  sop: any;
  compact?: boolean;
  eventId?: string;
  onClose?: () => void;
}

export function SopExecutionPanel({ sop, compact = false, eventId, onClose }: SopExecutionPanelProps) {
  return (
    <SopFlowChart
      sop={sop}
      compact={compact}
      eventId={eventId}
      onClose={onClose}
    />
  );
}
