// ref: CLAUDE.md §9.8 — SOP 모드 (M-SOP)
'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAppStore } from '@/stores/appStore';

export default function SopPage() {
  const [sops, setSops] = useState<any[]>([]);
  const [selectedSop, setSelectedSop] = useState<any>(null);
  const [tab, setTab] = useState<'execute' | 'edit' | 'history'>('execute');
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});
  const [memo, setMemo] = useState('');
  const { eventContext } = useAppStore();

  useEffect(() => {
    api.getSops().then(setSops).catch(console.error);
  }, []);

  const handleCheck = (stepNo: number) => {
    setCheckedSteps(prev => ({ ...prev, [stepNo]: !prev[stepNo] }));
  };

  return (
    <div className="h-full flex flex-col">
      <div className="h-10 bg-bg-secondary border-b border-gray-700 flex items-center px-4 gap-2">
        {(['execute', 'edit', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-xs px-3 py-1 rounded ${tab === t ? 'bg-accent-blue text-white' : 'text-gray-400'}`}>
            {t === 'execute' ? '실행' : t === 'edit' ? '저작/편집' : '실행이력'}
          </button>
        ))}
      </div>

      <div className="flex-1 flex min-h-0">
        {/* SOP 목록 */}
        <aside className="w-[220px] border-r border-gray-700 overflow-y-auto p-3">
          {sops.map(sop => (
            <button key={sop.sop_id} onClick={() => { setSelectedSop(sop); setCheckedSteps({}); setMemo(''); }}
              className={`w-full text-left text-[11px] px-3 py-2 rounded mb-1 ${
                selectedSop?.sop_id === sop.sop_id ? 'bg-accent-blue/20 text-white' : 'text-gray-300 hover:bg-bg-tertiary'
              }`}>
              <div className="font-medium">{sop.sop_name}</div>
              <div className="text-[10px] text-gray-500">{sop.sop_category} · {sop.target_equipment_id || '공통'}</div>
            </button>
          ))}
        </aside>

        {/* SOP 상세 */}
        <main className="flex-1 p-4 overflow-y-auto">
          {selectedSop ? (
            <>
              <h2 className="text-sm font-bold mb-1">{selectedSop.sop_name}</h2>
              <div className="text-[10px] text-gray-500 mb-4">
                {selectedSop.sop_id} · 대상: {selectedSop.target_equipment_id || '공통'} / {selectedSop.target_space_id || '—'}
              </div>

              {tab === 'execute' && (
                <>
                  <div className="space-y-2 mb-4">
                    {selectedSop.steps?.map((step: any, i: number) => (
                      <div key={i} className={`flex items-start gap-3 p-2 rounded ${checkedSteps[step.step_no] ? 'bg-green-500/10' : 'bg-bg-tertiary'}`}>
                        {step.type === 'CHECK' ? (
                          <input type="checkbox" checked={!!checkedSteps[step.step_no]} onChange={() => handleCheck(step.step_no)} className="mt-0.5" />
                        ) : (
                          <span className="text-gray-500 text-xs">ℹ</span>
                        )}
                        <span className="text-[11px] text-gray-200">{step.step_no}. {step.content}</span>
                      </div>
                    ))}
                  </div>

                  <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모 입력..."
                    className="w-full h-20 bg-bg-tertiary border border-gray-600 rounded p-2 text-xs text-white mb-3" />

                  <div className="flex gap-2">
                    <button className="bg-accent-green text-black px-4 py-1.5 rounded text-xs font-medium">실행완료</button>
                    <button className="bg-accent-orange text-black px-4 py-1.5 rounded text-xs font-medium">상황전파</button>
                  </div>
                </>
              )}

              {tab === 'edit' && (
                <div className="text-gray-500 text-xs">SOP 저작/편집 UI (구현 예정)</div>
              )}

              {tab === 'history' && (
                <div className="text-gray-500 text-xs">SOP 실행이력 UI (구현 예정)</div>
              )}
            </>
          ) : (
            <div className="text-gray-500 text-xs text-center mt-10">SOP를 선택하세요</div>
          )}
        </main>
      </div>
    </div>
  );
}
