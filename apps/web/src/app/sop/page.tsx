// ref: CLAUDE.md §9.8 — SOP 모드 (M-SOP) 플로우차트 스타일
'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAppStore } from '@/stores/appStore';
import { SopFlowChart } from '@/components/sop/SopFlowChart';
import { SopFlowEditor } from '@/components/sop/SopFlowEditor';

const CATEGORY_BADGE: Record<string, { label: string; color: string }> = {
  EMERGENCY: { label: '비상', color: 'bg-red-500/20 text-red-400' },
  EVENT_RESPONSE: { label: '대응', color: 'bg-amber-500/20 text-amber-400' },
  SAFETY: { label: '안전', color: 'bg-orange-500/20 text-orange-400' },
  ROUTINE: { label: '일상', color: 'bg-blue-500/20 text-blue-400' },
  INSPECTION: { label: '점검', color: 'bg-teal-500/20 text-teal-400' },
};

export default function SopPage() {
  const [sops, setSops] = useState<any[]>([]);
  const [selectedSop, setSelectedSop] = useState<any>(null);
  const [executions, setExecutions] = useState<any[]>([]);
  const [tab, setTab] = useState<'execute' | 'edit' | 'history'>('execute');
  const { eventContext } = useAppStore();

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

  const handleSelectSop = (sop: any) => setSelectedSop(sop);

  const refreshSops = async () => {
    const updated = await api.getSops();
    setSops(updated);
    if (selectedSop) {
      const refreshed = updated.find((s: any) => s.sop_id === selectedSop.sop_id);
      if (refreshed) setSelectedSop(refreshed);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* 탭 헤더 */}
      <div className="h-10 bg-[#0a0e17] border-b border-white/[0.06] flex items-center px-4 gap-1">
        {([
          { key: 'execute' as const, icon: '▶', label: '실행' },
          { key: 'edit' as const, icon: '✎', label: '저작/편집' },
          { key: 'history' as const, icon: '📋', label: '실행이력' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded text-[11px] font-bold tracking-wide transition-all flex items-center gap-1.5 ${
              tab === t.key
                ? 'bg-white/[0.08] text-white shadow-inner'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
            }`}>
            <span className="text-[10px]">{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex min-h-0">
        {/* ── SOP 목록 사이드바 ── */}
        <aside className="w-[240px] border-r border-white/[0.06] bg-[#080c14] overflow-y-auto">
          {/* 검색/카운트 */}
          <div className="p-3 border-b border-white/[0.04]">
            <div className="text-[10px] text-gray-500 mb-2">{sops.length}개 SOP 등록</div>
          </div>

          {/* SOP 리스트 */}
          <div className="p-2 space-y-1">
            {sops.map(sop => {
              const cat = CATEGORY_BADGE[sop.sop_category] || CATEGORY_BADGE.EVENT_RESPONSE;
              const isSelected = selectedSop?.sop_id === sop.sop_id;

              return (
                <button key={sop.sop_id} onClick={() => handleSelectSop(sop)}
                  className={`w-full text-left rounded-lg p-2.5 transition-all ${
                    isSelected
                      ? 'bg-white/[0.08] border border-white/[0.12]'
                      : 'hover:bg-white/[0.03] border border-transparent'
                  }`}>
                  {/* 카테고리 + 우선순위 */}
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${cat.color}`}>
                      {cat.label}
                    </span>
                    {sop.target_equipment_id && (
                      <span className="text-[8px] text-cyan-400/60 bg-cyan-500/10 px-1 py-0.5 rounded">
                        {sop.target_equipment_id}
                      </span>
                    )}
                  </div>

                  {/* SOP 이름 */}
                  <div className={`text-[11px] font-bold leading-tight ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                    {sop.sop_name}
                  </div>

                  {/* 부가 정보 */}
                  <div className="flex items-center gap-2 mt-1 text-[9px] text-gray-500">
                    <span>{sop.sop_id}</span>
                    {sop.estimated_duration_min && <span>· {sop.estimated_duration_min}분</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── 메인 콘텐츠 ── */}
        <main className="flex-1 overflow-hidden">
          {tab === 'history' ? (
            /* 실행이력 탭 */
            <div className="h-full overflow-y-auto p-4">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <span className="text-[10px] bg-white/[0.06] px-2 py-0.5 rounded">📋</span>
                SOP 실행이력
              </h3>
              <div className="space-y-2">
                {executions.map((ex: any) => (
                  <div key={ex.execution_id}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 hover:bg-white/[0.04] transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                          ex.execution_status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' :
                          ex.execution_status === 'ABORTED' ? 'bg-red-500/20 text-red-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {ex.execution_status}
                        </span>
                        <span className="text-[11px] text-white font-bold">{ex.sop?.sop_name || ex.sop_id}</span>
                      </div>
                      <span className="text-[9px] text-gray-500 font-mono">
                        {new Date(ex.started_at).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[9px] text-gray-500">
                      <span>ID: {ex.execution_id.slice(0, 8)}...</span>
                      <span>이벤트: {ex.event_id?.slice(0, 12)}</span>
                      {ex.ended_at && <span>종료: {new Date(ex.ended_at).toLocaleTimeString('ko-KR')}</span>}
                    </div>
                  </div>
                ))}
                {executions.length === 0 && (
                  <div className="text-center py-12 text-gray-600 text-xs">실행이력이 없습니다</div>
                )}
              </div>
            </div>
          ) : !selectedSop ? (
            /* 미선택 상태 */
            <div className="h-full flex flex-col items-center justify-center text-gray-600">
              <svg className="w-16 h-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <div className="text-xs">좌측 목록에서 SOP를 선택하세요</div>
            </div>
          ) : tab === 'execute' ? (
            /* 실행 탭 — 플로우차트 */
            <SopFlowChart
              sop={selectedSop}
              eventId={eventContext?.event_id || 'EVT-SC-01-001'}
            />
          ) : tab === 'edit' ? (
            /* 편집 탭 — 플로우차트 에디터 */
            <SopFlowEditor
              sop={selectedSop}
              onSave={refreshSops}
              onCancel={() => setTab('execute')}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
