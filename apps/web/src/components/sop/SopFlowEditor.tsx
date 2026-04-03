// ref: CLAUDE.md §9.8 — SOP 저작/편집 플로우차트 스타일 UI
'use client';
import { useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface EditStep {
  step_no: number;
  type: 'TEXT' | 'CHECK';
  title: string;
  content: string;
}

interface SopFlowEditorProps {
  sop: any;
  onSave?: () => void;
  onCancel?: () => void;
}

const CATEGORIES = [
  { value: 'EMERGENCY', label: '비상대응', color: 'text-red-400' },
  { value: 'EVENT_RESPONSE', label: '이벤트 대응', color: 'text-amber-400' },
  { value: 'SAFETY', label: '안전관리', color: 'text-orange-400' },
  { value: 'ROUTINE', label: '일상점검', color: 'text-blue-400' },
  { value: 'INSPECTION', label: '현장점검', color: 'text-teal-400' },
];

export function SopFlowEditor({ sop, onSave, onCancel }: SopFlowEditorProps) {
  const rawSteps = (sop.steps || []).map((s: any, i: number) => ({
    step_no: s.order || s.step_no || i + 1,
    type: s.type || 'CHECK',
    title: s.title || '',
    content: s.content || '',
  }));

  const [form, setForm] = useState({
    sop_name: sop.sop_name || '',
    sop_category: sop.sop_category || 'EVENT_RESPONSE',
    target_equipment_id: sop.target_equipment_id || '',
    target_space_id: sop.target_space_id || '',
    priority: sop.priority || 'CRITICAL',
    camera_preset: sop.camera_preset || '',
    estimated_duration_min: sop.estimated_duration_min || 15,
    broadcast_action: sop.broadcast_action || '',
  });

  const [steps, setSteps] = useState<EditStep[]>(rawSteps);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const addStep = useCallback((type: 'TEXT' | 'CHECK') => {
    setSteps(prev => [...prev, {
      step_no: prev.length + 1,
      type,
      title: type === 'CHECK' ? '확인 항목' : '안내',
      content: '',
    }]);
  }, []);

  const removeStep = useCallback((idx: number) => {
    setSteps(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_no: i + 1 })));
  }, []);

  const updateStep = useCallback((idx: number, field: keyof EditStep, value: string) => {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }, []);

  const moveStep = useCallback((idx: number, dir: -1 | 1) => {
    setSteps(prev => {
      const newArr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= newArr.length) return prev;
      [newArr[idx], newArr[target]] = [newArr[target], newArr[idx]];
      return newArr.map((s, i) => ({ ...s, step_no: i + 1 }));
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        steps: steps.map(s => ({
          order: s.step_no,
          type: s.type,
          title: s.title,
          content: s.content,
        })),
      };
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/sop/${sop.sop_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      onSave?.();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'linear-gradient(180deg, #0c1220 0%, #0a0f1a 100%)' }}>
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded font-bold">편집모드</span>
          <span className="text-xs text-gray-500">{sop.sop_id}</span>
        </div>
        <input
          value={form.sop_name}
          onChange={e => setForm(prev => ({ ...prev, sop_name: e.target.value }))}
          className="w-full bg-transparent text-sm font-black text-amber-400 tracking-wide border-b border-amber-500/20 pb-1
            focus:border-amber-500/50 focus:outline-none placeholder:text-amber-400/30"
          placeholder="SOP 이름 입력..."
        />
      </div>

      {/* 메타 정보 그리드 */}
      <div className="px-4 py-3 border-b border-white/[0.06] grid grid-cols-2 gap-2">
        <FieldBox label="카테고리">
          <select value={form.sop_category} onChange={e => setForm(p => ({ ...p, sop_category: e.target.value }))}
            className="edit-input">
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </FieldBox>
        <FieldBox label="우선순위">
          <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
            className="edit-input">
            <option value="EMERGENCY">긴급</option>
            <option value="CRITICAL">중요</option>
            <option value="INFO">일반</option>
          </select>
        </FieldBox>
        <FieldBox label="대상 설비">
          <input value={form.target_equipment_id} onChange={e => setForm(p => ({ ...p, target_equipment_id: e.target.value }))}
            className="edit-input" placeholder="BOG-201" />
        </FieldBox>
        <FieldBox label="대상 공간">
          <input value={form.target_space_id} onChange={e => setForm(p => ({ ...p, target_space_id: e.target.value }))}
            className="edit-input" placeholder="Z-BOG" />
        </FieldBox>
        <FieldBox label="예상 소요(분)">
          <input type="number" value={form.estimated_duration_min}
            onChange={e => setForm(p => ({ ...p, estimated_duration_min: Number(e.target.value) }))}
            className="edit-input" min={1} />
        </FieldBox>
        <FieldBox label="카메라 프리셋">
          <input value={form.camera_preset} onChange={e => setForm(p => ({ ...p, camera_preset: e.target.value }))}
            className="edit-input" placeholder="cam_bog_compressor_201" />
        </FieldBox>
      </div>

      {/* 플로우차트 단계 편집 */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {/* 시작 노드 */}
        <div className="flex flex-col items-center mb-1">
          <div className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-[9px] text-amber-400 font-bold">
            비상상황 발생
          </div>
          <FlowArrowEdit />
        </div>

        {/* 단계들 */}
        {steps.map((step, idx) => (
          <div key={idx} className="flex flex-col items-center">
            <div className={`w-full rounded-lg border overflow-hidden transition-all ${
              dragIdx === idx ? 'border-purple-500/50 shadow-lg shadow-purple-500/20' :
              'border-white/[0.08] hover:border-white/[0.15]'
            }`}>
              {/* 단계 헤더 (드래그/타입/삭제) */}
              <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white/[0.03]">
                {/* 순서 이동 */}
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveStep(idx, -1)} disabled={idx === 0}
                    className="text-gray-600 hover:text-gray-300 disabled:opacity-20 text-[8px] leading-none">▲</button>
                  <button onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1}
                    className="text-gray-600 hover:text-gray-300 disabled:opacity-20 text-[8px] leading-none">▼</button>
                </div>

                {/* 번호 */}
                <span className="text-[9px] text-gray-500 font-mono w-4 text-center">{step.step_no}</span>

                {/* 타입 토글 */}
                <button
                  onClick={() => updateStep(idx, 'type', step.type === 'CHECK' ? 'TEXT' : 'CHECK')}
                  className={`text-[8px] px-1.5 py-0.5 rounded font-bold transition-colors ${
                    step.type === 'CHECK'
                      ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                      : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                  }`}>
                  {step.type === 'CHECK' ? '☑ CHECK' : 'ℹ TEXT'}
                </button>

                {/* 타이틀 입력 */}
                <input
                  value={step.title}
                  onChange={e => updateStep(idx, 'title', e.target.value)}
                  className="flex-1 bg-transparent text-[10px] font-bold text-gray-200 focus:outline-none
                    border-b border-transparent focus:border-white/20 placeholder:text-gray-600"
                  placeholder="단계 제목..."
                />

                {/* 삭제 */}
                <button onClick={() => removeStep(idx)}
                  className="text-red-400/40 hover:text-red-400 text-xs transition-colors">✕</button>
              </div>

              {/* 내용 입력 */}
              <div className="px-3 py-2">
                <textarea
                  value={step.content}
                  onChange={e => updateStep(idx, 'content', e.target.value)}
                  rows={2}
                  className="w-full bg-white/[0.02] border border-white/[0.06] rounded p-2 text-[11px] text-gray-200
                    resize-none focus:border-cyan-500/30 focus:outline-none placeholder:text-gray-600 leading-relaxed"
                  placeholder="단계 상세 내용을 입력하세요. 마침표(.)로 구분하면 bullet 항목으로 표시됩니다."
                />
              </div>
            </div>

            {/* 연결 화살표 */}
            {idx < steps.length - 1 && <FlowArrowEdit />}
          </div>
        ))}

        {/* 단계 추가 버튼 */}
        <div className="flex flex-col items-center mt-2">
          <FlowArrowEdit />
          <div className="flex gap-2">
            <button onClick={() => addStep('CHECK')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-cyan-500/30
                bg-cyan-500/5 text-cyan-400 text-[10px] font-bold hover:bg-cyan-500/10 transition-colors">
              <span>☑</span> + CHECK 단계
            </button>
            <button onClick={() => addStep('TEXT')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-blue-500/30
                bg-blue-500/5 text-blue-400 text-[10px] font-bold hover:bg-blue-500/10 transition-colors">
              <span>ℹ</span> + TEXT 단계
            </button>
          </div>
        </div>

        {/* 종료 노드 */}
        <div className="flex flex-col items-center mt-2">
          <FlowArrowEdit />
          <div className="px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-[9px] text-green-400 font-bold">
            상황종료
          </div>
        </div>

        <div className="h-4" />
      </div>

      {/* 하단 액션 */}
      <div className="px-4 py-3 border-t border-white/[0.08] flex gap-2">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-purple-500/80 to-blue-500/80 text-white text-xs font-bold
            hover:from-purple-500 hover:to-blue-500 transition-all disabled:opacity-50">
          {saving ? '저장 중...' : '💾 저장'}
        </button>
        <button onClick={onCancel}
          className="px-4 py-2.5 rounded-lg border border-white/[0.08] text-gray-400 text-xs hover:text-white hover:border-white/[0.15] transition-colors">
          취소
        </button>
      </div>

      <style jsx>{`
        .edit-input {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 11px;
          color: white;
          margin-top: 2px;
        }
        .edit-input:focus {
          outline: none;
          border-color: rgba(139,92,246,0.4);
        }
      `}</style>
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
