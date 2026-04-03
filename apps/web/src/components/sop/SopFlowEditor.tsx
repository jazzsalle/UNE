// ref: CLAUDE.md §9.8 — SOP 저작/편집 플로우차트 스타일 UI
// DECISION(상황판단) 노드 편집 지원
'use client';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

interface EditStep {
  step_no: number;
  type: 'TEXT' | 'CHECK' | 'DECISION';
  title: string;
  content: string;
  // DECISION 전용
  yes_label: string;
  no_label: string;
  yes_steps: { content: string }[];
  no_steps: { content: string }[];
}

interface SopFlowEditorProps {
  sop: any;
  isNew?: boolean;
  onSave?: (newSopId?: string) => void;
  onCancel?: () => void;
  onDelete?: (sopId: string) => void;
  customCategories?: { value: string; label: string }[];
}

const DEFAULT_CATEGORIES = [
  { value: 'EMERGENCY', label: '비상대응' },
  { value: 'EVENT_RESPONSE', label: '이벤트 대응' },
  { value: 'SAFETY', label: '안전관리' },
  { value: 'ROUTINE', label: '일상점검' },
  { value: 'INSPECTION', label: '현장점검' },
];

const PRIORITIES = [
  { value: '심각', label: '심각', color: 'text-red-400' },
  { value: '경계', label: '경계', color: 'text-amber-400' },
  { value: '주의', label: '주의', color: 'text-yellow-400' },
  { value: '관심', label: '관심', color: 'text-blue-400' },
];

const STEP_TYPES: { value: EditStep['type']; label: string; icon: string; color: string }[] = [
  { value: 'CHECK', label: '임무절차', icon: '☑', color: 'bg-cyan-500/20 text-cyan-400' },
  { value: 'TEXT', label: '점검사항', icon: 'ℹ', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'DECISION', label: '상황판단', icon: '◇', color: 'bg-amber-500/20 text-amber-400' },
];

/* ── 커스텀 드롭다운 (다크테마 대응) ── */
function CustomSelect({ value, options, onChange, placeholder }: {
  value: string;
  options: { value: string; label: string; color?: string }[];
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative mt-0.5">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-md
          px-2 py-1.5 text-[11px] text-left flex items-center justify-between
          hover:border-purple-500/30 focus:outline-none focus:border-purple-500/40 transition-colors">
        <span className={selected?.color || 'text-white'}>{selected?.label || placeholder || '선택...'}</span>
        <svg className="w-3 h-3 text-gray-500 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={open ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-white/[0.1]
          bg-[#141a28] shadow-xl shadow-black/50 max-h-48 overflow-y-auto">
          {options.map(opt => (
            <button key={opt.value} type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors
                ${opt.value === value
                  ? 'bg-purple-500/20 text-white'
                  : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                }`}>
              <span className={opt.color || ''}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SopFlowEditor({ sop, isNew = false, onSave, onCancel, onDelete, customCategories = [] }: SopFlowEditorProps) {
  const allCategories = useMemo(() => {
    const merged = [...DEFAULT_CATEGORIES];
    customCategories.forEach(c => {
      if (!merged.find(m => m.value === c.value)) merged.push(c);
    });
    return merged;
  }, [customCategories]);

  const defaultNewSteps: EditStep[] = isNew && (!sop.steps || sop.steps.length === 0)
    ? [
        { step_no: 1, type: 'TEXT', title: '상황 인지 및 초기 확인', content: '이상 발생 설비의 현장 상태를 확인합니다. 알람 내용과 현장 상황을 대조하세요.', yes_label: 'YES', no_label: 'NO', yes_steps: [], no_steps: [] },
        { step_no: 2, type: 'CHECK', title: '현장 안전 조치', content: '개인보호구(PPE) 착용 여부를 확인합니다. 작업 구역 내 위험요소를 점검합니다.', yes_label: 'YES', no_label: 'NO', yes_steps: [], no_steps: [] },
        { step_no: 3, type: 'CHECK', title: '설비 상태 점검', content: '해당 설비의 센서값(압력, 온도, 진동 등)을 확인합니다. 이상 수치가 지속되는지 모니터링합니다.', yes_label: 'YES', no_label: 'NO', yes_steps: [], no_steps: [] },
        { step_no: 4, type: 'DECISION', title: '이상 해소 여부 판단', content: '조치 후 설비 상태가 정상 범위로 복귀했습니까?', yes_label: '정상복귀', no_label: '이상지속', yes_steps: [{ content: '정상운전 복귀 절차를 진행합니다.' }], no_steps: [{ content: '추가 비상조치를 실시하고 관리자에게 보고합니다.' }] },
        { step_no: 5, type: 'CHECK', title: '후속 조치 및 보고', content: '조치 내용을 기록하고, 관련 부서에 상황을 전파합니다.', yes_label: 'YES', no_label: 'NO', yes_steps: [], no_steps: [] },
      ]
    : [];

  const rawSteps: EditStep[] = defaultNewSteps.length > 0
    ? defaultNewSteps
    : (sop.steps || []).map((s: any, i: number) => ({
        step_no: s.order || s.step_no || i + 1,
        type: s.type || 'CHECK',
        title: s.title || '',
        content: s.content || '',
        yes_label: s.yes_label || 'YES',
        no_label: s.no_label || 'NO',
        yes_steps: s.yes_steps || [],
        no_steps: s.no_steps || [],
      }));

  const [form, setForm] = useState({
    sop_id: sop.sop_id || '',
    sop_name: sop.sop_name || '',
    sop_category: sop.sop_category || 'EVENT_RESPONSE',
    target_equipment_id: sop.target_equipment_id || '',
    target_space_id: sop.target_space_id || '',
    priority: sop.priority || '관심',
    camera_preset: sop.camera_preset || '',
    estimated_duration_min: sop.estimated_duration_min || 15,
    broadcast_action: sop.broadcast_action || '',
  });

  const [steps, setSteps] = useState<EditStep[]>(rawSteps);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const addStep = useCallback((type: EditStep['type']) => {
    setSteps(prev => [...prev, {
      step_no: prev.length + 1,
      type,
      title: type === 'CHECK' ? '임무절차' : type === 'DECISION' ? '상황판단' : '점검사항',
      content: type === 'DECISION' ? '조치가 완료되었습니까?' : '',
      yes_label: 'YES',
      no_label: 'NO',
      yes_steps: type === 'DECISION' ? [{ content: '정상복귀 절차 진행' }] : [],
      no_steps: type === 'DECISION' ? [{ content: '추가 조치 실시' }] : [],
    }]);
  }, []);

  const removeStep = useCallback((idx: number) => {
    setSteps(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_no: i + 1 })));
  }, []);

  const updateStep = useCallback((idx: number, field: string, value: any) => {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }, []);

  const cycleType = useCallback((idx: number) => {
    const order: EditStep['type'][] = ['CHECK', 'TEXT', 'DECISION'];
    setSteps(prev => prev.map((s, i) => {
      if (i !== idx) return s;
      const nextIdx = (order.indexOf(s.type) + 1) % order.length;
      const nextType = order[nextIdx];
      return {
        ...s,
        type: nextType,
        title: s.title || (nextType === 'DECISION' ? '상황판단' : nextType === 'CHECK' ? '임무절차' : '점검사항'),
        yes_steps: nextType === 'DECISION' && s.yes_steps.length === 0 ? [{ content: '' }] : s.yes_steps,
        no_steps: nextType === 'DECISION' && s.no_steps.length === 0 ? [{ content: '' }] : s.no_steps,
      };
    }));
  }, []);

  const moveStep = useCallback((idx: number, dir: -1 | 1) => {
    setSteps(prev => {
      const arr = [...prev];
      const t = idx + dir;
      if (t < 0 || t >= arr.length) return prev;
      [arr[idx], arr[t]] = [arr[t], arr[idx]];
      return arr.map((s, i) => ({ ...s, step_no: i + 1 }));
    });
  }, []);

  // DECISION 분기 하위 항목 관리
  const addBranchItem = useCallback((stepIdx: number, branch: 'yes_steps' | 'no_steps') => {
    setSteps(prev => prev.map((s, i) =>
      i === stepIdx ? { ...s, [branch]: [...s[branch], { content: '' }] } : s
    ));
  }, []);

  const removeBranchItem = useCallback((stepIdx: number, branch: 'yes_steps' | 'no_steps', itemIdx: number) => {
    setSteps(prev => prev.map((s, i) =>
      i === stepIdx ? { ...s, [branch]: s[branch].filter((_, j) => j !== itemIdx) } : s
    ));
  }, []);

  const updateBranchItem = useCallback((stepIdx: number, branch: 'yes_steps' | 'no_steps', itemIdx: number, content: string) => {
    setSteps(prev => prev.map((s, i) =>
      i === stepIdx ? { ...s, [branch]: s[branch].map((item, j) => j === itemIdx ? { content } : item) } : s
    ));
  }, []);

  const handleSave = async () => {
    if (!form.sop_name.trim()) {
      alert('SOP 이름을 입력해주세요.');
      return;
    }
    if (!form.sop_id.trim()) {
      alert('SOP ID를 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      const stepsPayload = steps.map(s => {
        const base: any = { order: s.step_no, type: s.type, title: s.title, content: s.content };
        if (s.type === 'DECISION') {
          base.yes_label = s.yes_label;
          base.no_label = s.no_label;
          base.yes_steps = s.yes_steps;
          base.no_steps = s.no_steps;
        }
        return base;
      });
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      if (isNew) {
        // 신규 생성 (POST)
        const payload = {
          sop_id: form.sop_id,
          sop_name: form.sop_name,
          sop_category: form.sop_category,
          trigger_type: 'MANUAL',
          target_space_id: form.target_space_id || null,
          target_equipment_id: form.target_equipment_id || null,
          priority: form.priority,
          camera_preset: form.camera_preset || null,
          estimated_duration_min: form.estimated_duration_min,
          broadcast_action: form.broadcast_action || null,
          steps: stepsPayload,
          status: 'ACTIVE',
        };
        const resp = await fetch(`${baseUrl}/api/sop`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || '생성 실패');
        }
        onSave?.(form.sop_id);
      } else {
        // 기존 수정 (PUT)
        const payload = { ...form, steps: stepsPayload };
        delete (payload as any).sop_id; // id는 URL param으로
        await fetch(`${baseUrl}/api/sop/${sop.sop_id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        onSave?.();
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || '저장 중 오류가 발생했습니다.');
    }
    finally { setSaving(false); }
  };

  const inputCls = "w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-md px-2 py-1.5 text-[11px] text-white mt-0.5 focus:outline-none focus:border-purple-500/40 placeholder:text-gray-600";

  return (
    <div className="flex flex-col h-full" style={{ background: 'linear-gradient(180deg, #0c1220 0%, #0a0f1a 100%)' }}>
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${
            isNew ? 'bg-green-500/20 text-green-400' : 'bg-purple-500/20 text-purple-400'
          }`}>{isNew ? '신규 생성' : '편집모드'}</span>
          {isNew ? (
            <input value={form.sop_id} onChange={e => setForm(p => ({ ...p, sop_id: e.target.value.toUpperCase().replace(/\s+/g, '-') }))}
              className="bg-transparent text-xs text-gray-400 border-b border-white/[0.1] focus:border-cyan-500/40 focus:outline-none
                placeholder:text-gray-600 font-mono"
              placeholder="SOP-ID-입력 (예: SOP-LEAK-01)" />
          ) : (
            <span className="text-xs text-gray-500">{sop.sop_id}</span>
          )}
        </div>
        <input value={form.sop_name} onChange={e => setForm(p => ({ ...p, sop_name: e.target.value }))}
          className="w-full bg-transparent text-sm font-black text-amber-400 tracking-wide border-b border-amber-500/20 pb-1
            focus:border-amber-500/50 focus:outline-none placeholder:text-amber-400/30"
          placeholder="SOP 이름 입력..." />
      </div>

      {/* 메타 정보 */}
      <div className="px-4 py-3 border-b border-white/[0.06] grid grid-cols-2 gap-3">
        <FieldBox label="카테고리">
          <CustomSelect
            value={form.sop_category}
            options={allCategories}
            onChange={val => setForm(p => ({ ...p, sop_category: val }))}
            placeholder="카테고리 선택"
          />
        </FieldBox>
        <FieldBox label="우선순위">
          <CustomSelect
            value={form.priority}
            options={PRIORITIES}
            onChange={val => setForm(p => ({ ...p, priority: val }))}
            placeholder="우선순위 선택"
          />
        </FieldBox>
        <FieldBox label="대상 설비">
          <input value={form.target_equipment_id} onChange={e => setForm(p => ({ ...p, target_equipment_id: e.target.value }))}
            className={inputCls} placeholder="BOG-201" />
        </FieldBox>
        <FieldBox label="대상 공간">
          <input value={form.target_space_id} onChange={e => setForm(p => ({ ...p, target_space_id: e.target.value }))}
            className={inputCls} placeholder="Z-BOG" />
        </FieldBox>
        <FieldBox label="예상 소요(분)">
          <input type="number" value={form.estimated_duration_min}
            onChange={e => setForm(p => ({ ...p, estimated_duration_min: Number(e.target.value) }))}
            className={inputCls} min={1} />
        </FieldBox>
        <FieldBox label="카메라 프리셋">
          <input value={form.camera_preset} onChange={e => setForm(p => ({ ...p, camera_preset: e.target.value }))}
            className={inputCls} placeholder="cam_bog_compressor_201" />
        </FieldBox>
      </div>

      {/* 플로우차트 단계 편집 */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {/* 시작 */}
        <div className="flex flex-col items-center mb-1">
          <div className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-[9px] text-amber-400 font-bold">
            비상상황 발생
          </div>
          <FlowArrowEdit />
        </div>

        {/* 단계들 */}
        {steps.map((step, idx) => (
          <div key={idx} className="flex flex-col items-center">
            {step.type === 'DECISION' ? (
              /* ── DECISION 노드 편집 ── */
              <div className="w-full">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveStep(idx, -1)} disabled={idx === 0}
                      className="text-gray-600 hover:text-gray-300 disabled:opacity-20 text-[8px]">▲</button>
                    <button onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1}
                      className="text-gray-600 hover:text-gray-300 disabled:opacity-20 text-[8px]">▼</button>
                  </div>
                  <span className="text-[9px] text-gray-500 font-mono w-4">{step.step_no}</span>
                  <button onClick={() => cycleType(idx)}
                    className="text-[8px] px-1.5 py-0.5 rounded font-bold bg-amber-500/20 text-amber-400 hover:bg-amber-500/30">
                    ◇ 상황판단
                  </button>
                  <span className="flex-1" />
                  <button onClick={() => removeStep(idx)} className="text-red-400/40 hover:text-red-400 text-xs">✕</button>
                </div>

                {/* 다이아몬드 프리뷰 + 제목/질문 */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
                    <div className="absolute inset-1 rotate-45 rounded border-2 border-amber-500/40 bg-amber-500/5" />
                    <span className="relative text-[8px] text-amber-400 font-bold text-center leading-tight">
                      {step.title || '상황\n판단'}
                    </span>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input value={step.title} onChange={e => updateStep(idx, 'title', e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded px-2 py-1 text-[10px] text-amber-400 font-bold
                        focus:outline-none focus:border-amber-500/30 placeholder:text-gray-600"
                      placeholder="판단 제목 (예: 조치완료, 이상해소 여부)" />
                    <input value={step.content} onChange={e => updateStep(idx, 'content', e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded px-2 py-1 text-[10px] text-gray-200
                        focus:outline-none focus:border-amber-500/30 placeholder:text-gray-600"
                      placeholder="판단 질문 (예: 이상상태가 해소되었습니까?)" />
                  </div>
                </div>

                {/* YES/NO 분기 편집 */}
                <div className="flex gap-2">
                  {/* YES 분기 */}
                  <div className="flex-1 rounded-lg border border-green-500/20 overflow-hidden">
                    <div className="px-2 py-1 bg-green-500/10 flex items-center gap-1.5">
                      <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <input value={step.yes_label} onChange={e => updateStep(idx, 'yes_label', e.target.value)}
                        className="bg-transparent text-[9px] font-bold text-green-400 w-16 focus:outline-none" placeholder="YES" />
                    </div>
                    <div className="p-2 space-y-1">
                      {step.yes_steps.map((item, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <span className="text-green-400/40 text-[8px]">•</span>
                          <input value={item.content}
                            onChange={e => updateBranchItem(idx, 'yes_steps', i, e.target.value)}
                            className="flex-1 bg-white/[0.02] border border-white/[0.04] rounded px-1.5 py-0.5 text-[10px] text-gray-200
                              focus:outline-none focus:border-green-500/30 placeholder:text-gray-600"
                            placeholder="조치 항목..." />
                          <button onClick={() => removeBranchItem(idx, 'yes_steps', i)}
                            className="text-red-400/30 hover:text-red-400 text-[9px]">✕</button>
                        </div>
                      ))}
                      <button onClick={() => addBranchItem(idx, 'yes_steps')}
                        className="text-[8px] text-green-400/50 hover:text-green-400 w-full text-left px-1">+ 항목 추가</button>
                    </div>
                  </div>

                  {/* NO 분기 */}
                  <div className="flex-1 rounded-lg border border-red-500/20 overflow-hidden">
                    <div className="px-2 py-1 bg-red-500/10 flex items-center gap-1.5">
                      <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <input value={step.no_label} onChange={e => updateStep(idx, 'no_label', e.target.value)}
                        className="bg-transparent text-[9px] font-bold text-red-400 w-16 focus:outline-none" placeholder="NO" />
                    </div>
                    <div className="p-2 space-y-1">
                      {step.no_steps.map((item, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <span className="text-red-400/40 text-[8px]">•</span>
                          <input value={item.content}
                            onChange={e => updateBranchItem(idx, 'no_steps', i, e.target.value)}
                            className="flex-1 bg-white/[0.02] border border-white/[0.04] rounded px-1.5 py-0.5 text-[10px] text-gray-200
                              focus:outline-none focus:border-red-500/30 placeholder:text-gray-600"
                            placeholder="조치 항목..." />
                          <button onClick={() => removeBranchItem(idx, 'no_steps', i)}
                            className="text-red-400/30 hover:text-red-400 text-[9px]">✕</button>
                        </div>
                      ))}
                      <button onClick={() => addBranchItem(idx, 'no_steps')}
                        className="text-[8px] text-red-400/50 hover:text-red-400 w-full text-left px-1">+ 항목 추가</button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ── TEXT / CHECK 노드 편집 ── */
              <div className={`w-full rounded-lg border overflow-hidden transition-all border-white/[0.08] hover:border-white/[0.15]`}>
                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white/[0.03]">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveStep(idx, -1)} disabled={idx === 0}
                      className="text-gray-600 hover:text-gray-300 disabled:opacity-20 text-[8px]">▲</button>
                    <button onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1}
                      className="text-gray-600 hover:text-gray-300 disabled:opacity-20 text-[8px]">▼</button>
                  </div>
                  <span className="text-[9px] text-gray-500 font-mono w-4 text-center">{step.step_no}</span>
                  <button onClick={() => cycleType(idx)}
                    className={`text-[8px] px-1.5 py-0.5 rounded font-bold transition-colors ${
                      step.type === 'CHECK' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                    {step.type === 'CHECK' ? '☑ 임무절차' : 'ℹ 점검사항'}
                  </button>
                  <input value={step.title} onChange={e => updateStep(idx, 'title', e.target.value)}
                    className="flex-1 bg-transparent text-[10px] font-bold text-gray-200 focus:outline-none
                      border-b border-transparent focus:border-white/20 placeholder:text-gray-600"
                    placeholder="단계 제목..." />
                  <button onClick={() => removeStep(idx)} className="text-red-400/40 hover:text-red-400 text-xs">✕</button>
                </div>
                <div className="px-3 py-2">
                  <textarea value={step.content} onChange={e => updateStep(idx, 'content', e.target.value)}
                    rows={2}
                    className="w-full bg-white/[0.02] border border-white/[0.06] rounded p-2 text-[11px] text-gray-200
                      resize-none focus:border-cyan-500/30 focus:outline-none placeholder:text-gray-600 leading-relaxed"
                    placeholder="단계 상세 내용. 마침표(.)로 구분하면 bullet 항목으로 표시됩니다." />
                </div>
              </div>
            )}
            {idx < steps.length - 1 && <FlowArrowEdit />}
          </div>
        ))}

        {/* 단계 추가 */}
        <div className="flex flex-col items-center mt-2">
          <FlowArrowEdit />
          <div className="flex gap-2 flex-wrap justify-center">
            {STEP_TYPES.map(t => (
              <button key={t.value} onClick={() => addStep(t.value)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed
                  ${t.value === 'CHECK' ? 'border-cyan-500/30 bg-cyan-500/5 text-cyan-400' :
                    t.value === 'TEXT' ? 'border-blue-500/30 bg-blue-500/5 text-blue-400' :
                    'border-amber-500/30 bg-amber-500/5 text-amber-400'}
                  text-[10px] font-bold hover:brightness-125 transition-all`}>
                <span>{t.icon}</span> + {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 종료 */}
        <div className="flex flex-col items-center mt-2">
          <FlowArrowEdit />
          <div className="px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-[9px] text-green-400 font-bold">
            상황종료
          </div>
        </div>
        <div className="h-4" />
      </div>

      {/* 하단 */}
      <div className="px-4 py-3 border-t border-white/[0.08] flex gap-2">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-purple-500/80 to-blue-500/80 text-white text-xs font-bold
            hover:from-purple-500 hover:to-blue-500 transition-all disabled:opacity-50">
          {saving ? '저장 중...' : isNew ? '+ 생성' : '저장'}
        </button>
        <button onClick={onCancel}
          className="px-4 py-2.5 rounded-lg border border-white/[0.08] text-gray-400 text-xs hover:text-white hover:border-white/[0.15] transition-colors">
          취소
        </button>

        {/* 삭제 버튼 (기존 SOP 편집 시만 표시) */}
        {!isNew && onDelete && (
          showDeleteConfirm ? (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[10px] text-red-400">삭제하시겠습니까?</span>
              <button onClick={() => onDelete(sop.sop_id)}
                className="px-3 py-2.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold
                  hover:bg-red-500/30 border border-red-500/30 transition-colors">
                확인
              </button>
              <button onClick={() => setShowDeleteConfirm(false)}
                className="px-2 py-2.5 rounded-lg text-gray-500 text-xs hover:text-gray-300 transition-colors">
                취소
              </button>
            </div>
          ) : (
            <button onClick={() => setShowDeleteConfirm(true)}
              className="ml-auto px-3 py-2.5 rounded-lg border border-red-500/15 text-red-400/60 text-xs
                hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-all"
              title="휴지통으로 이동">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )
        )}
      </div>
    </div>
  );
}

function FieldBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[9px] text-gray-500 font-bold tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function FlowArrowEdit() {
  return (
    <div className="flex flex-col items-center my-0.5">
      <div className="w-0 h-2.5 border-l-2 border-dashed border-gray-700" />
      <svg className="w-2.5 h-1.5 text-gray-700 -mt-0.5" viewBox="0 0 12 8" fill="currentColor">
        <path d="M6 8L0 0h12z" />
      </svg>
    </div>
  );
}
