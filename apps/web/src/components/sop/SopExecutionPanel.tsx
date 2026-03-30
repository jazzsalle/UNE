// ref: CLAUDE.md §3.3, §9.8 — SOP 실행 패널 (compact/full 듀얼 UI)
'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAppStore } from '@/stores/appStore';

interface SopExecutionPanelProps {
  sop: any;
  compact?: boolean;
  eventId?: string;
  onClose?: () => void;
}

export function SopExecutionPanel({ sop, compact = false, eventId, onClose }: SopExecutionPanelProps) {
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});
  const [memo, setMemo] = useState('');
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'executing' | 'completed'>('idle');

  const handleStart = async () => {
    if (!eventId) return;
    try {
      const exec = await api.executeSop(sop.sop_id, { event_id: eventId, scenario_id: sop.scenario_id });
      setExecutionId(exec.execution_id);
      setStatus('executing');
    } catch (err) { console.error(err); }
  };

  const handleCheck = async (stepNo: number) => {
    const updated = { ...checkedSteps, [stepNo]: !checkedSteps[stepNo] };
    setCheckedSteps(updated);
    if (executionId) {
      const steps = Object.entries(updated).map(([no, checked]) => ({ step_no: Number(no), checked, checked_at: new Date().toISOString() }));
      await api.updateExecution(executionId, { checked_steps: steps, memo }).catch(console.error);
    }
  };

  const handleComplete = async () => {
    if (!executionId) return;
    await api.completeExecution(executionId).catch(console.error);
    setStatus('completed');
  };

  const panelWidth = compact ? 'w-[400px]' : 'w-full';

  return (
    <div className={`${panelWidth} bg-bg-secondary border-l border-gray-700 flex flex-col h-full ${compact ? 'fixed right-0 top-0 bottom-0 z-40 shadow-2xl' : ''}`}>
      {/* Header */}
      <div className="p-3 border-b border-gray-700 flex items-center gap-2">
        <h3 className="text-xs font-bold flex-1 truncate">{sop.sop_name}</h3>
        {status === 'completed' && <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded">완료</span>}
        {compact && onClose && <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>}
      </div>

      {/* Info */}
      <div className="px-3 py-2 text-[10px] text-gray-500 border-b border-gray-800">
        {sop.sop_id} · {sop.target_equipment_id || '공통'} · {sop.sop_category}
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sop.steps?.map((step: any) => (
          <div key={step.step_no}
            className={`flex items-start gap-2 p-2 rounded text-[11px] transition-colors ${
              checkedSteps[step.step_no] ? 'bg-green-500/10 text-green-300' : 'bg-bg-tertiary text-gray-200'
            }`}
          >
            {step.type === 'CHECK' ? (
              <input
                type="checkbox"
                checked={!!checkedSteps[step.step_no]}
                onChange={() => handleCheck(step.step_no)}
                className="mt-0.5 accent-green-500"
              />
            ) : (
              <span className="text-gray-500">ℹ</span>
            )}
            <span>{step.step_no}. {step.content}</span>
          </div>
        ))}
      </div>

      {/* Memo */}
      <div className="px-3 py-2 border-t border-gray-800">
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 입력..."
          className="w-full h-16 bg-bg-tertiary border border-gray-600 rounded p-2 text-[11px] text-white resize-none"
        />
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-gray-700 flex gap-2">
        {status === 'idle' && (
          <button onClick={handleStart} className="bg-accent-blue text-white px-3 py-1.5 rounded text-xs flex-1">실행 시작</button>
        )}
        {status === 'executing' && (
          <>
            <button onClick={handleComplete} className="bg-accent-green text-black px-3 py-1.5 rounded text-xs font-medium flex-1">실행완료</button>
            <button className="bg-accent-orange text-black px-3 py-1.5 rounded text-xs font-medium">전파</button>
          </>
        )}
        {status === 'completed' && (
          <div className="text-center text-green-400 text-xs w-full py-1">SOP 실행이 완료되었습니다</div>
        )}
      </div>
    </div>
  );
}
