// ref: CLAUDE.md §9.8 — SOP 플로우차트 스타일 실행 UI
// 레퍼런스: 열차 탈선/추돌 SOP 플로우차트 이미지 기반
// DECISION(상황판단) 노드: 다이아몬드 분기 + YES/NO 경로
'use client';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

interface SopStep {
  order?: number;
  step_no?: number;
  type: 'TEXT' | 'CHECK' | 'DECISION';
  title?: string;
  content: string;
  // DECISION 전용
  yes_label?: string;
  no_label?: string;
  yes_steps?: { content: string }[];
  no_steps?: { content: string }[];
}

interface SopFlowChartProps {
  sop: {
    sop_id: string;
    sop_name: string;
    sop_category: string;
    target_equipment_id?: string;
    target_space_id?: string;
    estimated_duration_min?: number;
    priority?: string | number;
    steps: SopStep[];
    broadcast_action?: string;
  };
  compact?: boolean;
  eventId?: string;
  onClose?: () => void;
}

// 카테고리별 헤더 색상
const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  EMERGENCY: { bg: 'bg-red-500/20', border: 'border-red-500/60', text: 'text-red-400', glow: 'shadow-red-500/20' },
  EVENT_RESPONSE: { bg: 'bg-amber-500/20', border: 'border-amber-500/60', text: 'text-amber-400', glow: 'shadow-amber-500/20' },
  SAFETY: { bg: 'bg-orange-500/20', border: 'border-orange-500/60', text: 'text-orange-400', glow: 'shadow-orange-500/20' },
  ROUTINE: { bg: 'bg-blue-500/20', border: 'border-blue-500/60', text: 'text-blue-400', glow: 'shadow-blue-500/20' },
  INSPECTION: { bg: 'bg-teal-500/20', border: 'border-teal-500/60', text: 'text-teal-400', glow: 'shadow-teal-500/20' },
};

function PriorityBadge({ priority }: { priority?: string | number }) {
  // 우선순위: 심각 > 경계 > 주의 > 관심
  const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
    '심각': { label: '심각', color: 'bg-red-500/30 text-red-300' },
    '경계': { label: '경계', color: 'bg-amber-500/30 text-amber-300' },
    '주의': { label: '주의', color: 'bg-yellow-500/30 text-yellow-300' },
    '관심': { label: '관심', color: 'bg-blue-500/30 text-blue-300' },
  };
  const p = typeof priority === 'string' ? priority : '';
  const info = PRIORITY_MAP[p] || PRIORITY_MAP['관심'];
  return <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${info.color}`}>{info.label}</span>;
}

export function SopFlowChart({ sop, compact = false, eventId, onClose }: SopFlowChartProps) {
  const [checkedSteps, setCheckedSteps] = useState<Record<number, { checked: boolean; time: string }>>({});
  const [decisionResults, setDecisionResults] = useState<Record<number, 'yes' | 'no'>>({});
  const [memo, setMemo] = useState('');
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'executing' | 'completed'>('idle');
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const steps = sop.steps || [];
  const normalizedSteps = steps.map((s, i) => ({
    ...s,
    stepNo: s.order || s.step_no || i + 1,
  }));

  const colors = CATEGORY_COLORS[sop.sop_category] || CATEGORY_COLORS.EVENT_RESPONSE;

  // 현재 활성 단계 (순차 실행: 첫 번째 미완료 CHECK 또는 미결정 DECISION 단계)
  const currentStepNo = useMemo(() => {
    for (const step of normalizedSteps) {
      if (step.type === 'CHECK' && !checkedSteps[step.stepNo]?.checked) {
        return step.stepNo;
      }
      if (step.type === 'DECISION' && !decisionResults[step.stepNo]) {
        return step.stepNo;
      }
    }
    return null;
  }, [normalizedSteps, checkedSteps, decisionResults]);

  const actionableSteps = normalizedSteps.filter(s => s.type === 'CHECK' || s.type === 'DECISION');
  const completedActions = actionableSteps.filter(s =>
    (s.type === 'CHECK' && checkedSteps[s.stepNo]?.checked) ||
    (s.type === 'DECISION' && decisionResults[s.stepNo])
  ).length;
  const totalActions = actionableSteps.length;
  const allDone = totalActions > 0 && completedActions >= totalActions;
  const progressPct = totalActions > 0 ? (completedActions / totalActions) * 100 : 0;

  // 경과시간 타이머
  useEffect(() => {
    if (status === 'executing') {
      timerRef.current = setInterval(() => setElapsedSec(prev => prev + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  // 현재 단계로 자동 스크롤
  useEffect(() => {
    if (currentStepNo && scrollRef.current) {
      const el = scrollRef.current.querySelector(`[data-step="${currentStepNo}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStepNo]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStart = async () => {
    if (!eventId) return;
    try {
      const exec = await api.executeSop(sop.sop_id, { event_id: eventId, scenario_id: '' });
      setExecutionId(exec.execution_id);
      setStatus('executing');
      setElapsedSec(0);
    } catch (err) { console.error(err); }
  };

  const handleCheck = useCallback(async (stepNo: number) => {
    if (stepNo !== currentStepNo || status !== 'executing') return;
    const now = new Date().toISOString();
    const updated = { ...checkedSteps, [stepNo]: { checked: true, time: now } };
    setCheckedSteps(updated);
    if (executionId) {
      const stepsPayload = Object.entries(updated).map(([no, v]) => ({
        step_no: Number(no), checked: v.checked, checked_at: v.time,
      }));
      await api.updateExecution(executionId, { checked_steps: stepsPayload, memo }).catch(console.error);
    }
  }, [currentStepNo, status, checkedSteps, executionId, memo]);

  const handleDecision = useCallback((stepNo: number, choice: 'yes' | 'no') => {
    if (stepNo !== currentStepNo || status !== 'executing') return;
    setDecisionResults(prev => ({ ...prev, [stepNo]: choice }));
  }, [currentStepNo, status]);

  const handleComplete = async () => {
    if (!executionId) return;
    await api.completeExecution(executionId).catch(console.error);
    setStatus('completed');
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleBroadcast = async () => {
    if (!executionId) return;
    try {
      await fetch(`/api/sop/execution/${executionId}/broadcast`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: sop.broadcast_action || '상황전파' }),
      });
      setBroadcastSent(true);
    } catch (err) { console.error(err); }
  };

  const estimatedTotalMin = sop.estimated_duration_min || 15;
  const timePerStep = estimatedTotalMin / normalizedSteps.length;

  return (
    <div className={`flex flex-col h-full ${compact ? 'w-[420px] fixed right-0 top-0 bottom-0 z-40' : 'w-full'}`}
      style={{ background: 'linear-gradient(180deg, #0c1220 0%, #0a0f1a 100%)' }}>

      {/* ── 헤더 ── */}
      <div className={`relative border-b-2 ${colors.border}`}>
        <div className={`${colors.bg} px-4 py-1 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <PriorityBadge priority={sop.priority} />
            <span className={`text-[9px] font-bold tracking-wider ${colors.text}`}>{sop.sop_category}</span>
          </div>
          {onClose && <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">&times;</button>}
        </div>
        <div className="px-4 py-3">
          <h2 className="text-sm font-black text-amber-400 tracking-wide leading-tight">{sop.sop_name}</h2>
          <div className="flex items-center gap-3 mt-1.5 text-[12px] text-gray-400">
            {sop.target_equipment_id && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />{sop.target_equipment_id}
              </span>
            )}
            {sop.target_space_id && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />{sop.target_space_id}
              </span>
            )}
            <span>{sop.sop_id}</span>
          </div>
        </div>
        {status === 'executing' && (
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between text-[9px] mb-1">
              <span className="text-cyan-400 font-mono">{formatTime(elapsedSec)}</span>
              <span className="text-gray-500">
                {completedActions}/{totalActions} 완료
                {sop.estimated_duration_min && ` · 예상 ${sop.estimated_duration_min}분`}
              </span>
            </div>
            <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* ── 플로우차트 본체 ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4">
        {/* 시작 노드 */}
        <div className="flex flex-col items-center mb-1">
          <div className={`px-6 py-2.5 rounded-full text-[18px] font-bold tracking-wide ${
            status === 'idle' ? 'bg-gray-700/50 text-gray-400' :
            status === 'executing' ? `${colors.bg} ${colors.text} shadow-lg ${colors.glow}` :
            'bg-green-500/20 text-green-400'
          }`}>
            {status === 'idle' ? '대기 중' : status === 'executing' ? '상황발생' : '조치 완료'}
          </div>
          <FlowArrow />
        </div>

        {/* 단계들 */}
        {normalizedSteps.map((step, idx) => {
          const isChecked = !!checkedSteps[step.stepNo]?.checked;
          const decisionResult = decisionResults[step.stepNo];
          const isCurrent = step.stepNo === currentStepNo && status === 'executing';
          const isPastCheck = step.type === 'CHECK' && isChecked;
          const isPastDecision = step.type === 'DECISION' && !!decisionResult;
          const isPast = isPastCheck || isPastDecision;
          const isFuture = (step.type === 'CHECK' && !isChecked && !isCurrent) ||
                           (step.type === 'DECISION' && !decisionResult && !isCurrent);
          const isLast = idx === normalizedSteps.length - 1;
          const cumulativeMin = Math.round(timePerStep * (idx + 1));

          // DECISION 노드 렌더링
          if (step.type === 'DECISION') {
            return (
              <div key={step.stepNo} data-step={step.stepNo} className="flex flex-col items-center">
                <DecisionNode
                  step={step}
                  isCurrent={isCurrent}
                  isPast={isPastDecision}
                  isFuture={isFuture && !isCurrent}
                  result={decisionResult}
                  onDecide={(choice) => handleDecision(step.stepNo, choice)}
                  colors={colors}
                  cumulativeMin={cumulativeMin}
                />
                {!isLast && <FlowArrow active={isPast || isCurrent} color={isPast ? 'green' : isCurrent ? 'cyan' : 'gray'} />}
              </div>
            );
          }

          // TEXT / CHECK 노드 렌더링
          return (
            <div key={step.stepNo} data-step={step.stepNo} className="flex flex-col items-center">
              <div className="w-full flex items-start gap-2">
                <div className={`flex-1 relative rounded-lg overflow-hidden transition-all duration-300 ${
                  isPast ? 'border border-green-500/30' :
                  isCurrent ? `border-2 ${colors.border} shadow-lg ${colors.glow}` :
                  isFuture ? 'border border-white/[0.06] opacity-50' :
                  'border border-white/[0.08]'
                }`}>
                  {/* 헤더 */}
                  <div className={`flex items-center gap-2 px-3 py-1.5 ${
                    isPast ? 'bg-green-500/10' : isCurrent ? colors.bg : 'bg-white/[0.03]'
                  }`}>
                    {step.type === 'CHECK' ? (
                      isPast ? (
                        <div className="w-5 h-5 rounded bg-green-500/30 flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : isCurrent ? (
                        <button onClick={() => handleCheck(step.stepNo)}
                          className={`w-5 h-5 rounded border-2 ${colors.border} flex items-center justify-center flex-shrink-0 hover:bg-white/10 transition-colors group`}
                          title="클릭하여 확인">
                          <div className={`w-2 h-2 rounded-sm ${colors.bg} opacity-0 group-hover:opacity-100 transition-opacity`} />
                        </button>
                      ) : (
                        <div className="w-5 h-5 rounded border border-gray-600 flex-shrink-0" />
                      )
                    ) : (
                      <div className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] text-blue-400 font-bold">i</span>
                      </div>
                    )}
                    <span className={`text-[12px] font-bold flex-1 ${
                      isPast ? 'text-green-300' : isCurrent ? colors.text : isFuture ? 'text-gray-600' : 'text-gray-300'
                    }`}>
                      {step.title || (step.type === 'CHECK' ? '임무절차' : '점검사항')}
                    </span>
                    {isPastCheck && checkedSteps[step.stepNo]?.time && (
                      <span className="text-[8px] text-green-400/60 font-mono">
                        {new Date(checkedSteps[step.stepNo].time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  {/* 내용 */}
                  <div className={`px-3 py-2 text-[13px] leading-relaxed ${
                    isPast ? 'text-green-300/70' : isCurrent ? 'text-white' : isFuture ? 'text-gray-600' : 'text-gray-300'
                  }`}>
                    <BulletContent content={step.content} isPast={isPast} isCurrent={isCurrent} colors={colors} />
                  </div>
                  {isCurrent && (
                    <div className="px-3 py-1.5 bg-white/[0.02] border-t border-white/[0.04] flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${colors.text.replace('text-', 'bg-')} animate-pulse`} />
                      <span className={`text-[9px] ${colors.text}`}>현재 단계 — 체크박스를 클릭하여 확인</span>
                    </div>
                  )}
                </div>
                <div className="w-14 flex-shrink-0 pt-2 text-right">
                  <span className={`text-[8px] font-mono ${
                    isPast ? 'text-green-400/50' : isCurrent ? colors.text : 'text-gray-600'
                  }`}>{cumulativeMin}분이내</span>
                </div>
              </div>
              {!isLast && <FlowArrow active={isPast || isCurrent} color={isPast ? 'green' : isCurrent ? 'cyan' : 'gray'} />}
            </div>
          );
        })}

        {/* 최종 상황보고/종료 */}
        {status === 'executing' && allDone && (
          <div className="flex flex-col items-center mt-1">
            <FlowArrow active color="green" />
            <div className="px-5 py-2 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="text-[12px] font-bold text-green-400 text-center">상황보고</div>
            </div>
          </div>
        )}
        {status === 'completed' && (
          <div className="flex flex-col items-center mt-2">
            <FlowArrow active color="green" />
            <div className="px-5 py-2 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="text-[12px] font-bold text-green-400 text-center">상황보고</div>
            </div>
            <FlowArrow active color="green" />
            <div className="px-8 py-3 rounded-full bg-green-500/20 border-2 border-green-500/40">
              <div className="text-[18px] font-black text-green-300 text-center">상황종료</div>
            </div>
          </div>
        )}
        <div className="h-4" />
      </div>

      {/* ── 메모 + 액션 바 ── */}
      <div className="border-t border-white/[0.08]">
        {status === 'executing' && (
          <div className="px-3 py-2">
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)}
              placeholder="조치 메모 입력..." rows={2}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg p-2 text-[13px] text-white resize-none focus:border-cyan-500/30 focus:outline-none placeholder:text-gray-600" />
          </div>
        )}
        <div className="px-3 py-2.5 flex gap-2">
          {status === 'idle' && (
            <button onClick={handleStart}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold tracking-wide transition-all
                ${colors.bg} ${colors.text} border ${colors.border} hover:brightness-125 shadow-lg ${colors.glow}`}>
              ▶ SOP 실행 시작
            </button>
          )}
          {status === 'executing' && (
            <>
              <button onClick={handleComplete} disabled={!allDone}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold tracking-wide transition-all ${
                  allDone
                    ? 'bg-green-500/20 text-green-400 border border-green-500/40 hover:bg-green-500/30 shadow-lg shadow-green-500/20'
                    : 'bg-white/[0.03] text-gray-600 border border-white/[0.06] cursor-not-allowed'
                }`}>
                {allDone ? '✓ 실행완료' : `${completedActions}/${totalActions} 진행 중`}
              </button>
              <button onClick={handleBroadcast} disabled={broadcastSent}
                className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  broadcastSent ? 'bg-amber-500/10 text-amber-400/50 border border-amber-500/20'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30'
                }`}>
                {broadcastSent ? '전파완료' : '상황전파'}
              </button>
            </>
          )}
          {status === 'completed' && (
            <div className="flex-1 flex flex-col items-center gap-1 py-1">
              <div className="flex items-center gap-1.5 text-green-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-bold">SOP 실행 완료</span>
              </div>
              <span className="text-[9px] text-gray-500">소요시간: {formatTime(elapsedSec)}</span>
            </div>
          )}
        </div>
        <div className="px-3 py-2 border-t border-white/[0.06] text-[8px] text-gray-500 space-y-0.5">
          <div>(정)SOP 담당 부서 | SOP 담당자-정 | 010-1234-5678</div>
          <div>(부)SOP 담당 부서 | SOP 담당자-부 | 010-3178-1234</div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   DECISION(상황판단) 노드 컴포넌트
   ══════════════════════════════════════════ */
interface DecisionNodeProps {
  step: SopStep & { stepNo: number };
  isCurrent: boolean;
  isPast: boolean;
  isFuture: boolean;
  result?: 'yes' | 'no';
  onDecide: (choice: 'yes' | 'no') => void;
  colors: { bg: string; border: string; text: string; glow: string };
  cumulativeMin: number;
}

function DecisionNode({ step, isCurrent, isPast, isFuture, result, onDecide, colors, cumulativeMin }: DecisionNodeProps) {
  const yesLabel = step.yes_label || 'YES';
  const noLabel = step.no_label || 'NO';
  const yesSteps = step.yes_steps || [];
  const noSteps = step.no_steps || [];

  return (
    <div className="w-full">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          {/* 다이아몬드 노드 */}
          <div className="flex flex-col items-center">
            <div className={`relative w-24 h-24 flex items-center justify-center ${
              isFuture ? 'opacity-40' : ''
            }`}>
              <div className={`absolute inset-1 rotate-45 rounded-md border-2 transition-all duration-300 ${
                isPast && result === 'yes' ? 'border-green-500/60 bg-green-500/10 shadow-lg shadow-green-500/20' :
                isPast && result === 'no' ? 'border-amber-500/60 bg-amber-500/10 shadow-lg shadow-amber-500/20' :
                isCurrent ? `${colors.border} ${colors.bg} shadow-lg ${colors.glow}` :
                'border-gray-600 bg-white/[0.02]'
              }`} />
              <div className="relative text-center z-10">
                <div className={`text-[9px] font-black tracking-wide ${
                  isPast && result === 'yes' ? 'text-green-400' :
                  isPast && result === 'no' ? 'text-amber-400' :
                  isCurrent ? colors.text :
                  'text-gray-500'
                }`}>
                  {step.title || '상황판단'}
                </div>
              </div>
            </div>

            {/* 판단 질문 */}
            {(isCurrent || isPast) && (
              <div className={`-mt-1 mb-2 px-3 py-1.5 rounded text-[12px] text-center max-w-[280px] ${
                isCurrent ? 'bg-white/[0.05] text-white border border-white/[0.08]' :
                'text-gray-500'
              }`}>
                {step.content}
              </div>
            )}

            {/* 판단 버튼 (현재 단계일 때) */}
            {isCurrent && !result && (
              <div className="flex gap-3 mb-2">
                <button onClick={() => onDecide('yes')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-green-500/50
                    bg-green-500/10 text-green-400 text-[13px] font-bold
                    hover:bg-green-500/20 hover:border-green-500/70 hover:shadow-lg hover:shadow-green-500/20
                    transition-all active:scale-95">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {yesLabel}
                </button>
                <button onClick={() => onDecide('no')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-red-500/50
                    bg-red-500/10 text-red-400 text-[13px] font-bold
                    hover:bg-red-500/20 hover:border-red-500/70 hover:shadow-lg hover:shadow-red-500/20
                    transition-all active:scale-95">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {noLabel}
                </button>
              </div>
            )}
          </div>

          {/* ── YES/NO 분기 경로 ── */}
          {isPast && result && (yesSteps.length > 0 || noSteps.length > 0) && (
            <div className="flex gap-3 mt-1">
              {/* YES 경로 */}
              <div className={`flex-1 rounded-lg overflow-hidden border transition-all ${
                result === 'yes' ? 'border-green-500/30 opacity-100' : 'border-white/[0.04] opacity-30'
              }`}>
                <div className={`px-2.5 py-1 text-[9px] font-bold flex items-center gap-1.5 ${
                  result === 'yes' ? 'bg-green-500/15 text-green-400' : 'bg-white/[0.02] text-gray-600'
                }`}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {yesLabel}
                </div>
                {yesSteps.length > 0 && (
                  <div className="px-2.5 py-1.5 space-y-0.5">
                    {yesSteps.map((s, i) => (
                      <div key={i} className={`flex items-start gap-1.5 text-[12px] ${
                        result === 'yes' ? 'text-green-300/80' : 'text-gray-600'
                      }`}>
                        <span className={`mt-1 w-1 h-1 rounded-full flex-shrink-0 ${
                          result === 'yes' ? 'bg-green-400/50' : 'bg-gray-700'
                        }`} />
                        <span>{s.content}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* NO 경로 */}
              <div className={`flex-1 rounded-lg overflow-hidden border transition-all ${
                result === 'no' ? 'border-red-500/30 opacity-100' : 'border-white/[0.04] opacity-30'
              }`}>
                <div className={`px-2.5 py-1 text-[9px] font-bold flex items-center gap-1.5 ${
                  result === 'no' ? 'bg-red-500/15 text-red-400' : 'bg-white/[0.02] text-gray-600'
                }`}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {noLabel}
                </div>
                {noSteps.length > 0 && (
                  <div className="px-2.5 py-1.5 space-y-0.5">
                    {noSteps.map((s, i) => (
                      <div key={i} className={`flex items-start gap-1.5 text-[12px] ${
                        result === 'no' ? 'text-red-300/80' : 'text-gray-600'
                      }`}>
                        <span className={`mt-1 w-1 h-1 rounded-full flex-shrink-0 ${
                          result === 'no' ? 'bg-red-400/50' : 'bg-gray-700'
                        }`} />
                        <span>{s.content}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 우측 시간 */}
        <div className="w-14 flex-shrink-0 pt-6 text-right">
          <span className={`text-[8px] font-mono ${
            isPast ? 'text-green-400/50' : isCurrent ? colors.text : 'text-gray-600'
          }`}>{cumulativeMin}분이내</span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   공통 하위 컴포넌트
   ══════════════════════════════════════════ */
function BulletContent({ content, isPast, isCurrent, colors }: {
  content: string; isPast: boolean; isCurrent: boolean;
  colors: { text: string };
}) {
  return (
    <>
      {content.split(/[.·]/).filter(Boolean).map((item, i) => (
        <div key={i} className="flex items-start gap-1.5 mb-0.5">
          <span className={`mt-1.5 w-1 h-1 rounded-full flex-shrink-0 ${
            isPast ? 'bg-green-400/50' :
            isCurrent ? colors.text.replace('text-', 'bg-') :
            'bg-gray-600'
          }`} />
          <span>{item.trim()}</span>
        </div>
      ))}
    </>
  );
}

function FlowArrow({ active = false, color = 'gray' }: { active?: boolean; color?: 'gray' | 'green' | 'cyan' | 'amber' }) {
  const colorMap = { gray: 'border-gray-700', green: 'border-green-500/40', cyan: 'border-cyan-500/40', amber: 'border-amber-500/40' };
  const arrowColor = { gray: 'text-gray-700', green: 'text-green-500/60', cyan: 'text-cyan-500/60', amber: 'text-amber-500/60' };
  return (
    <div className="flex flex-col items-center my-0.5">
      <div className={`w-0 h-3 border-l-2 border-dashed ${colorMap[color]} transition-colors duration-300`} />
      <svg className={`w-3 h-2 ${arrowColor[color]} -mt-0.5`} viewBox="0 0 12 8" fill="currentColor">
        <path d="M6 8L0 0h12z" />
      </svg>
    </div>
  );
}
