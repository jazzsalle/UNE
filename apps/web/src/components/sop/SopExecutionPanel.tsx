// ref: CLAUDE.md §3.3, §9.8 — SOP 실행 패널 (순차 실행, compact/full 듀얼 UI)
'use client';
import { useState, useMemo } from 'react';
import { api } from '@/lib/api';

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

  const steps = sop.steps || [];

  // 현재 활성 단계 (순차 실행: 첫 번째 미완료 CHECK 단계)
  const currentStepNo = useMemo(() => {
    for (const step of steps) {
      if (step.type === 'CHECK' && !checkedSteps[step.step_no]) {
        return step.step_no;
      }
    }
    return null; // 모두 완료
  }, [steps, checkedSteps]);

  // 모든 CHECK 단계 완료 여부
  const allChecked = useMemo(() => {
    return steps
      .filter((s: any) => s.type === 'CHECK')
      .every((s: any) => checkedSteps[s.step_no]);
  }, [steps, checkedSteps]);

  const handleStart = async () => {
    if (!eventId) return;
    try {
      const exec = await api.executeSop(sop.sop_id, { event_id: eventId, scenario_id: sop.scenario_id });
      setExecutionId(exec.execution_id);
      setStatus('executing');
    } catch (err) { console.error(err); }
  };

  const handleCheck = async (stepNo: number) => {
    // 순차 실행: 현재 단계만 체크 가능
    if (stepNo !== currentStepNo) return;

    const updated = { ...checkedSteps, [stepNo]: true };
    setCheckedSteps(updated);
    if (executionId) {
      const stepsPayload = Object.entries(updated).map(([no, checked]) => ({
        step_no: Number(no), checked, checked_at: new Date().toISOString(),
      }));
      await api.updateExecution(executionId, { checked_steps: stepsPayload, memo }).catch(console.error);
    }
  };

  const handleComplete = async () => {
    if (!executionId) return;
    await api.completeExecution(executionId).catch(console.error);
    setStatus('completed');
  };

  const panelWidth = compact ? 'w-[400px]' : 'w-full';

  return (
    <div className={`${panelWidth} bg-[#0a0e17] border-l border-white/[0.06] flex flex-col h-full ${compact ? 'fixed right-0 top-0 bottom-0 z-40 shadow-2xl' : ''}`}>
      {/* Header */}
      <div className="p-3 border-b border-white/[0.06] flex items-center gap-2">
        <h3 className="text-xs font-bold flex-1 truncate">{sop.sop_name}</h3>
        {status === 'executing' && !allChecked && (
          <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">
            {currentStepNo}/{steps.filter((s: any) => s.type === 'CHECK').length}
          </span>
        )}
        {status === 'completed' && <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded">완료</span>}
        {compact && onClose && <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>}
      </div>

      {/* Info */}
      <div className="px-3 py-2 text-[10px] text-gray-500 border-b border-white/[0.04]">
        {sop.sop_id} · {sop.target_equipment_id || '공통'} · {sop.sop_category}
      </div>

      {/* Steps — 순차 실행 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {steps.map((step: any) => {
          const isChecked = !!checkedSteps[step.step_no];
          const isCurrent = step.step_no === currentStepNo && status === 'executing';
          const isPast = step.type === 'CHECK' && isChecked;
          const isFuture = step.type === 'CHECK' && !isChecked && step.step_no !== currentStepNo;
          const isText = step.type === 'TEXT';

          return (
            <div key={step.step_no}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg text-[11px] transition-all duration-300 ${
                isPast ? 'bg-green-500/10 border border-green-500/20 text-green-300' :
                isCurrent ? 'bg-cyan-500/10 border border-cyan-500/30 text-white shadow-lg shadow-cyan-500/10' :
                isFuture ? 'bg-white/[0.02] border border-white/[0.04] text-gray-500' :
                isText ? 'bg-white/[0.02] text-gray-300' : 'bg-white/[0.02] text-gray-200'
              }`}
            >
              {step.type === 'CHECK' ? (
                <div className="mt-0.5 flex-shrink-0">
                  {isPast ? (
                    <div className="w-4 h-4 rounded bg-green-500/30 flex items-center justify-center text-green-400 text-[10px]">✓</div>
                  ) : isCurrent ? (
                    <button
                      onClick={() => handleCheck(step.step_no)}
                      className="w-4 h-4 rounded border-2 border-cyan-400 hover:bg-cyan-500/20 transition-colors cursor-pointer animate-pulse"
                      title="클릭하여 확인"
                    />
                  ) : (
                    <div className="w-4 h-4 rounded border border-gray-700" />
                  )}
                </div>
              ) : (
                <span className="text-gray-500 mt-0.5 flex-shrink-0">ℹ</span>
              )}
              <div className="flex-1">
                <span className={`${isFuture ? 'opacity-40' : ''}`}>
                  {step.step_no}. {step.content}
                </span>
                {isCurrent && (
                  <div className="mt-1 text-[9px] text-cyan-400">← 현재 단계 (클릭하여 확인)</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Memo */}
      <div className="px-3 py-2 border-t border-white/[0.04]">
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 입력..."
          className="w-full h-14 bg-white/[0.03] border border-white/[0.08] rounded-lg p-2 text-[11px] text-white resize-none focus:border-cyan-500/30 focus:outline-none"
        />
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-white/[0.06] flex gap-2">
        {status === 'idle' && (
          <button onClick={handleStart}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-3 py-1.5 rounded-lg text-xs flex-1 font-medium hover:from-cyan-400 hover:to-blue-500 transition-all">
            실행 시작
          </button>
        )}
        {status === 'executing' && (
          <>
            <button
              onClick={handleComplete}
              disabled={!allChecked}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex-1 transition-all ${
                allChecked
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-400'
                  : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
              }`}
            >
              {allChecked ? '실행완료' : `${Object.values(checkedSteps).filter(Boolean).length}/${steps.filter((s: any) => s.type === 'CHECK').length} 완료`}
            </button>
            <button className="bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-500/30 transition-colors">
              전파
            </button>
          </>
        )}
        {status === 'completed' && (
          <div className="text-center text-green-400 text-xs w-full py-1 flex items-center justify-center gap-1">
            <span className="text-green-400">✓</span> SOP 실행이 완료되었습니다
          </div>
        )}
      </div>
    </div>
  );
}
