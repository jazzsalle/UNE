// ref: CLAUDE.md §9.8 — SOP 모드 (M-SOP) 전체
'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAppStore } from '@/stores/appStore';
import { SopExecutionPanel } from '@/components/sop/SopExecutionPanel';

export default function SopPage() {
  const [sops, setSops] = useState<any[]>([]);
  const [selectedSop, setSelectedSop] = useState<any>(null);
  const [executions, setExecutions] = useState<any[]>([]);
  const [tab, setTab] = useState<'execute' | 'edit' | 'history'>('execute');
  const { eventContext } = useAppStore();

  // 저작/편집 상태
  const [editForm, setEditForm] = useState({
    sop_name: '', sop_category: 'EMERGENCY', target_equipment_id: '',
    target_space_id: '', priority: 1, camera_preset: '', steps: [] as any[],
  });

  useEffect(() => {
    api.getSops().then(setSops).catch(console.error);
  }, []);

  useEffect(() => {
    if (tab === 'history') {
      const params: Record<string, string> = {};
      if (eventContext?.scenario_id) params.scenario_id = eventContext.scenario_id;
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/sop/executions${Object.keys(params).length ? '?' + new URLSearchParams(params) : ''}`)
        .then(r => r.json()).then(setExecutions).catch(() => {});
    }
  }, [tab, eventContext]);

  const handleSelectSop = (sop: any) => {
    setSelectedSop(sop);
    setEditForm({
      sop_name: sop.sop_name, sop_category: sop.sop_category,
      target_equipment_id: sop.target_equipment_id || '',
      target_space_id: sop.target_space_id || '',
      priority: sop.priority || 1, camera_preset: sop.camera_preset || '',
      steps: sop.steps || [],
    });
  };

  const addStep = () => {
    setEditForm(prev => ({
      ...prev,
      steps: [...prev.steps, { step_no: prev.steps.length + 1, type: 'CHECK', content: '' }],
    }));
  };

  const removeStep = (idx: number) => {
    setEditForm(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_no: i + 1 })),
    }));
  };

  const updateStep = (idx: number, field: string, value: string) => {
    setEditForm(prev => ({
      ...prev,
      steps: prev.steps.map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }));
  };

  return (
    <div className="h-full flex flex-col">
      <div className="h-10 bg-[#0a0e17] border-b border-white/[0.06] flex items-center px-4 gap-1">
        {(['execute', 'edit', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`mode-tab ${tab === t ? 'mode-tab-active' : 'text-gray-500 hover:text-gray-300'}`}>
            {t === 'execute' ? '실행' : t === 'edit' ? '저작/편집' : '실행이력'}
          </button>
        ))}
      </div>

      <div className="flex-1 flex min-h-0">
        {/* SOP 목록 */}
        <aside className="w-[220px] border-r border-white/[0.06] bg-[#0a0e17] overflow-y-auto p-3">
          <div className="text-[10px] text-gray-500 mb-2">{sops.length}개 SOP</div>
          {sops.map(sop => (
            <button key={sop.sop_id} onClick={() => handleSelectSop(sop)}
              className={`sidebar-item mb-1 ${
                selectedSop?.sop_id === sop.sop_id ? 'sidebar-item-active' : 'text-gray-300'
              }`}>
              <div className="font-medium">{sop.sop_name}</div>
              <div className="text-[10px] text-gray-500">{sop.sop_category} · {sop.target_equipment_id || '공통'}</div>
            </button>
          ))}
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 overflow-y-auto">
          {!selectedSop ? (
            <div className="text-gray-500 text-xs text-center mt-10">SOP를 선택하세요</div>
          ) : tab === 'execute' ? (
            <SopExecutionPanel sop={selectedSop} eventId={eventContext?.event_id || 'EVT-SC-01-001'} />
          ) : tab === 'edit' ? (
            <div className="p-4 space-y-4">
              <h3 className="text-sm font-bold">SOP 편집 — {selectedSop.sop_id}</h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400">이름</label>
                  <input value={editForm.sop_name} onChange={e => setEditForm(prev => ({ ...prev, sop_name: e.target.value }))}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded px-2 py-1 text-xs text-white mt-0.5" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400">카테고리</label>
                  <select value={editForm.sop_category} onChange={e => setEditForm(prev => ({ ...prev, sop_category: e.target.value }))}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded px-2 py-1 text-xs text-white mt-0.5">
                    <option value="EMERGENCY">EMERGENCY</option>
                    <option value="SAFETY">SAFETY</option>
                    <option value="ROUTINE">ROUTINE</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400">대상 설비</label>
                  <input value={editForm.target_equipment_id} onChange={e => setEditForm(prev => ({ ...prev, target_equipment_id: e.target.value }))}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded px-2 py-1 text-xs text-white mt-0.5" placeholder="BOG-201" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400">대상 공간</label>
                  <input value={editForm.target_space_id} onChange={e => setEditForm(prev => ({ ...prev, target_space_id: e.target.value }))}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded px-2 py-1 text-xs text-white mt-0.5" placeholder="Z-BOG" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400">우선순위 (1=최고)</label>
                  <input type="number" min={1} max={5} value={editForm.priority} onChange={e => setEditForm(prev => ({ ...prev, priority: Number(e.target.value) }))}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded px-2 py-1 text-xs text-white mt-0.5" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400">카메라 프리셋</label>
                  <input value={editForm.camera_preset} onChange={e => setEditForm(prev => ({ ...prev, camera_preset: e.target.value }))}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded px-2 py-1 text-xs text-white mt-0.5" placeholder="cam_bog_compressor_201" />
                </div>
              </div>

              {/* 단계 편집 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-400">단계 목록</span>
                  <button onClick={addStep} className="text-[10px] bg-cyan-500 text-white px-2 py-0.5 rounded">+ 단계 추가</button>
                </div>
                {editForm.steps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-gray-500 w-6">{step.step_no}</span>
                    <select value={step.type} onChange={e => updateStep(idx, 'type', e.target.value)}
                      className="bg-white/[0.03] border border-white/[0.08] rounded px-1 py-0.5 text-[10px] text-white w-20">
                      <option value="CHECK">CHECK</option>
                      <option value="TEXT">TEXT</option>
                    </select>
                    <input value={step.content} onChange={e => updateStep(idx, 'content', e.target.value)}
                      className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded px-2 py-0.5 text-[11px] text-white" placeholder="단계 내용" />
                    <button onClick={() => removeStep(idx)} className="text-red-400 hover:text-red-300 text-xs">✕</button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={async () => {
                  if (!selectedSop) return;
                  try {
                    await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/sop/${selectedSop.sop_id}`, {
                      method: 'PUT', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ...editForm, steps: editForm.steps }),
                    });
                    const updated = await api.getSops();
                    setSops(updated);
                    alert('SOP 저장 완료');
                  } catch (err) { console.error(err); }
                }} className="bg-cyan-500 text-white px-4 py-1.5 rounded text-xs">저장</button>
                <button onClick={() => setTab('execute')} className="text-gray-400 hover:text-white px-4 py-1.5 text-xs">취소</button>
              </div>
            </div>
          ) : (
            /* 실행이력 탭 */
            <div className="p-4">
              <h3 className="text-sm font-bold mb-3">SOP 실행이력</h3>
              <table className="w-full text-[11px]">
                <thead><tr className="text-gray-500 border-b border-white/[0.06]">
                  <th className="text-left py-2">실행ID</th><th className="text-left">SOP</th><th className="text-left">이벤트</th>
                  <th className="text-left">상태</th><th className="text-left">시작</th><th className="text-left">종료</th>
                </tr></thead>
                <tbody>
                  {executions.map((ex: any) => (
                    <tr key={ex.execution_id} className="border-b border-white/[0.04]">
                      <td className="py-1.5 text-white font-mono text-[10px]">{ex.execution_id.slice(0, 8)}</td>
                      <td className="text-gray-300">{ex.sop_id}</td>
                      <td className="text-gray-400">{ex.event_id?.slice(0, 12)}</td>
                      <td><span className={`text-[9px] px-1.5 py-0.5 rounded ${
                        ex.execution_status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>{ex.execution_status}</span></td>
                      <td className="text-gray-500">{new Date(ex.started_at).toLocaleDateString()}</td>
                      <td className="text-gray-500">{ex.ended_at ? new Date(ex.ended_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                  {executions.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-gray-600 py-4">실행이력이 없습니다</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
