// ref: CLAUDE.md §9.8 — SOP 모드 (M-SOP) 플로우차트 스타일
'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAppStore } from '@/stores/appStore';
import { SopFlowChart } from '@/components/sop/SopFlowChart';
import { SopFlowEditor } from '@/components/sop/SopFlowEditor';

// 기본 카테고리 정의 (동적으로 추가 가능)
const DEFAULT_CATEGORIES: Record<string, { label: string; color: string }> = {
  EMERGENCY: { label: '비상', color: 'bg-red-500/20 text-red-400' },
  EVENT_RESPONSE: { label: '대응', color: 'bg-amber-500/20 text-amber-400' },
  SAFETY: { label: '안전', color: 'bg-orange-500/20 text-orange-400' },
  ROUTINE: { label: '일상', color: 'bg-blue-500/20 text-blue-400' },
  INSPECTION: { label: '점검', color: 'bg-teal-500/20 text-teal-400' },
};

// 사용자 추가 카테고리용 색상 풀 (순환)
const EXTRA_CATEGORY_COLORS = [
  'bg-violet-500/20 text-violet-400',
  'bg-pink-500/20 text-pink-400',
  'bg-lime-500/20 text-lime-400',
  'bg-sky-500/20 text-sky-400',
  'bg-rose-500/20 text-rose-400',
  'bg-indigo-500/20 text-indigo-400',
  'bg-emerald-500/20 text-emerald-400',
  'bg-fuchsia-500/20 text-fuchsia-400',
];

// 우선순위 정의 (4단계: 관심 < 주의 < 경계 < 심각)
const PRIORITY_BADGE: Record<string, { label: string; color: string }> = {
  '심각': { label: '심각', color: 'bg-red-500/20 text-red-400' },
  '경계': { label: '경계', color: 'bg-amber-500/20 text-amber-400' },
  '주의': { label: '주의', color: 'bg-yellow-500/20 text-yellow-400' },
  '관심': { label: '관심', color: 'bg-blue-500/20 text-blue-400' },
};

type TabType = 'execute' | 'edit' | 'history' | 'trash';

export default function SopPage() {
  const [sops, setSops] = useState<any[]>([]);
  const [trashSops, setTrashSops] = useState<any[]>([]);
  const [selectedSop, setSelectedSop] = useState<any>(null);
  const [executions, setExecutions] = useState<any[]>([]);
  const [tab, setTab] = useState<TabType>('execute');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [trashCategory, setTrashCategory] = useState<string>('ALL');
  const [customCategories, setCustomCategories] = useState<Record<string, { label: string; color: string }>>({});
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [newCategoryKey, setNewCategoryKey] = useState('');
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null); // sop_id to confirm
  const [permanentDeleteConfirm, setPermanentDeleteConfirm] = useState<string | null>(null);
  const { eventContext } = useAppStore();
  const [showHelp, setShowHelp] = useState(false);

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
    if (tab === 'trash') {
      api.getTrash().then(setTrashSops).catch(console.error);
    }
  }, [tab, eventContext]);

  // 전체 카테고리 맵 = 기본 + 커스텀 + SOP에서 발견된 미등록 카테고리
  const allCategoryMap = useMemo(() => {
    const map = { ...DEFAULT_CATEGORIES, ...customCategories };
    let extraIdx = Object.keys(customCategories).length;
    [...sops, ...trashSops].forEach(sop => {
      if (sop.sop_category && !map[sop.sop_category]) {
        map[sop.sop_category] = {
          label: sop.sop_category,
          color: EXTRA_CATEGORY_COLORS[extraIdx % EXTRA_CATEGORY_COLORS.length],
        };
        extraIdx++;
      }
    });
    return map;
  }, [sops, trashSops, customCategories]);

  // 실제 사용 중인 카테고리 (SOP가 있는 것만)
  const usedCategories = useMemo(() => {
    const cats = new Set<string>();
    sops.forEach(sop => { if (sop.sop_category) cats.add(sop.sop_category); });
    return Array.from(cats);
  }, [sops]);

  // 휴지통 카테고리
  const trashUsedCategories = useMemo(() => {
    const cats = new Set<string>();
    trashSops.forEach(sop => { if (sop.sop_category) cats.add(sop.sop_category); });
    return Array.from(cats);
  }, [trashSops]);

  // 카테고리 필터 적용
  const filteredSops = useMemo(() => {
    if (selectedCategory === 'ALL') return sops;
    return sops.filter(sop => sop.sop_category === selectedCategory);
  }, [sops, selectedCategory]);

  // 휴지통 필터
  const filteredTrashSops = useMemo(() => {
    if (trashCategory === 'ALL') return trashSops;
    return trashSops.filter(sop => sop.sop_category === trashCategory);
  }, [trashSops, trashCategory]);

  const handleAddCategory = () => {
    const key = newCategoryKey.trim().toUpperCase().replace(/\s+/g, '_');
    const label = newCategoryLabel.trim();
    if (!key || !label) return;
    if (allCategoryMap[key]) return;
    const extraIdx = Object.keys(customCategories).length;
    setCustomCategories(prev => ({
      ...prev,
      [key]: { label, color: EXTRA_CATEGORY_COLORS[extraIdx % EXTRA_CATEGORY_COLORS.length] },
    }));
    setNewCategoryKey('');
    setNewCategoryLabel('');
    setShowCategoryInput(false);
  };

  const handleSelectSop = (sop: any) => setSelectedSop(sop);

  // 신규 SOP 생성용 빈 템플릿 (가이드 포함)
  const handleCreateNew = () => {
    const newId = `SOP-NEW-${Date.now().toString(36).toUpperCase()}`;
    setSelectedSop({
      sop_id: newId,
      sop_name: '',
      sop_category: 'EVENT_RESPONSE',
      trigger_type: 'MANUAL',
      target_space_id: '',
      target_equipment_id: '',
      linked_hazop_id: null,
      priority: '관심',
      camera_preset: '',
      popup_template: '',
      estimated_duration_min: 15,
      auto_open_popup: false,
      broadcast_action: '',
      steps: [],
      status: 'ACTIVE',
      _isNew: true,
    });
    setTab('edit');
  };

  // SOP 삭제 (휴지통 이동)
  const handleDelete = useCallback(async (sopId: string) => {
    try {
      await api.deleteSop(sopId);
      const updated = await api.getSops();
      setSops(updated);
      if (selectedSop?.sop_id === sopId) setSelectedSop(null);
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }, [selectedSop]);

  // 휴지통에서 복원
  const handleRestore = useCallback(async (sopId: string) => {
    try {
      await api.restoreSop(sopId);
      const [updated, updatedTrash] = await Promise.all([api.getSops(), api.getTrash()]);
      setSops(updated);
      setTrashSops(updatedTrash);
    } catch (err) {
      console.error('Restore failed:', err);
    }
  }, []);

  // 영구 삭제
  const handlePermanentDelete = useCallback(async (sopId: string) => {
    try {
      await api.permanentDeleteSop(sopId);
      const updatedTrash = await api.getTrash();
      setTrashSops(updatedTrash);
      setPermanentDeleteConfirm(null);
    } catch (err) {
      console.error('Permanent delete failed:', err);
    }
  }, []);

  const refreshSops = async (newSopId?: string) => {
    const updated = await api.getSops();
    setSops(updated);
    if (newSopId) {
      const created = updated.find((s: any) => s.sop_id === newSopId);
      if (created) setSelectedSop(created);
    } else if (selectedSop) {
      const refreshed = updated.find((s: any) => s.sop_id === selectedSop.sop_id);
      if (refreshed) setSelectedSop(refreshed);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* 탭 헤더 */}
      <div className="h-10 bg-[#0a0e17] border-b border-white/[0.06] flex items-center px-4 gap-1">
        {([
          { key: 'execute' as TabType, icon: '▶', label: '실행' },
          { key: 'edit' as TabType, icon: '✎', label: '저작/편집' },
          { key: 'history' as TabType, icon: '📋', label: '실행이력' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded text-[13px] font-bold tracking-wide transition-all flex items-center gap-1.5 ${
              tab === t.key
                ? 'bg-white/[0.08] text-white shadow-inner'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
            }`}>
            <span className="text-[12px]">{t.icon}</span> {t.label}
          </button>
        ))}

        {/* 도움말 */}
        <button onClick={() => setShowHelp(!showHelp)}
          className="ml-auto text-[11px] text-gray-500 hover:text-gray-300 border border-gray-600 px-2 py-0.5 rounded">
          {showHelp ? '도움말 닫기' : '? SOP 안내'}
        </button>

        {/* 구분선 */}
        <div className="w-px h-4 bg-white/[0.08] mx-1" />

        {/* 휴지통 탭 */}
        <button onClick={() => setTab('trash')}
          className={`px-3 py-1.5 rounded text-[13px] font-bold tracking-wide transition-all flex items-center gap-1.5 ${
            tab === 'trash'
              ? 'bg-red-500/10 text-red-400 shadow-inner'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
          }`}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          휴지통
          {trashSops.length > 0 && (
            <span className="text-[8px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
              {trashSops.length}
            </span>
          )}
        </button>
      </div>

      {showHelp && (
        <div className="px-4 py-2 bg-gray-800/80 border-b border-gray-600 text-[12px] space-y-2">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="text-green-400 font-bold mb-1">실행 탭</div>
              <ul className="text-gray-400 space-y-0.5 list-disc ml-3">
                <li>좌측에서 SOP를 선택하면 우측에 <span className="text-white">플로우차트</span> 형태로 실행 절차가 표시됨</li>
                <li>각 단계를 순서대로 체크하며 진행</li>
                <li>메모를 작성하고 <span className="text-white">[실행 완료]</span> 또는 <span className="text-white">[상황 전파]</span> 가능</li>
                <li>이벤트 연계 시 자동으로 추천 SOP가 표시됨</li>
              </ul>
            </div>
            <div className="flex-1">
              <div className="text-amber-400 font-bold mb-1">저작/편집 탭</div>
              <ul className="text-gray-400 space-y-0.5 list-disc ml-3">
                <li>새로운 SOP를 생성하거나 기존 SOP를 편집</li>
                <li>단계 추가/삭제/순서변경을 <span className="text-white">플로우차트 에디터</span>로 직접 조작</li>
                <li>카테고리(비상/안전/일상)와 우선순위 지정</li>
                <li>대상 설비/공간 및 카메라 프리셋 연동 설정</li>
              </ul>
            </div>
            <div className="flex-1">
              <div className="text-purple-400 font-bold mb-1">실행이력 탭</div>
              <ul className="text-gray-400 space-y-0.5 list-disc ml-3">
                <li>과거 SOP 실행 기록을 시간순으로 조회</li>
                <li>완료/중단 상태, 체크 이력, 작성 메모 확인</li>
                <li>이벤트별/시나리오별 필터링 가능</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* ── 휴지통 탭일 때는 전체 콘텐츠 교체 ── */}
        {tab === 'trash' ? (
          <TrashView
            trashSops={filteredTrashSops}
            allTrashSops={trashSops}
            trashCategory={trashCategory}
            setTrashCategory={setTrashCategory}
            trashUsedCategories={trashUsedCategories}
            allCategoryMap={allCategoryMap}
            onRestore={handleRestore}
            onPermanentDelete={handlePermanentDelete}
            permanentDeleteConfirm={permanentDeleteConfirm}
            setPermanentDeleteConfirm={setPermanentDeleteConfirm}
          />
        ) : (
          <>
            {/* ── SOP 목록 사이드바 ── */}
            <aside className="w-full lg:w-[260px] border-b lg:border-b-0 lg:border-r border-white/[0.06] bg-[#080c14] overflow-y-auto flex flex-col max-h-[35vh] lg:max-h-none">
              {/* 카운트 + 카테고리 추가 */}
              <div className="p-3 border-b border-white/[0.04]">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[12px] text-gray-500">
                    {filteredSops.length}개 SOP {selectedCategory !== 'ALL' && `(전체 ${sops.length})`}
                  </div>
                  <button onClick={() => setShowCategoryInput(!showCategoryInput)}
                    className="text-[9px] text-purple-400 hover:text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded transition-colors">
                    + 카테고리
                  </button>
                </div>

                {/* 카테고리 추가 입력 */}
                {showCategoryInput && (
                  <div className="mb-2 p-2 rounded-lg bg-white/[0.03] border border-purple-500/20 space-y-1.5">
                    <input value={newCategoryKey} onChange={e => setNewCategoryKey(e.target.value)}
                      placeholder="코드 (예: MAINTENANCE)"
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded px-2 py-1 text-[12px] text-white
                        focus:outline-none focus:border-purple-500/30 placeholder:text-gray-600" />
                    <input value={newCategoryLabel} onChange={e => setNewCategoryLabel(e.target.value)}
                      placeholder="표시명 (예: 유지보수)"
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded px-2 py-1 text-[12px] text-white
                        focus:outline-none focus:border-purple-500/30 placeholder:text-gray-600" />
                    <div className="flex gap-1.5">
                      <button onClick={handleAddCategory}
                        className="flex-1 py-1 rounded text-[9px] font-bold bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors">
                        추가
                      </button>
                      <button onClick={() => { setShowCategoryInput(false); setNewCategoryKey(''); setNewCategoryLabel(''); }}
                        className="px-2 py-1 rounded text-[9px] text-gray-500 hover:text-gray-300 transition-colors">
                        취소
                      </button>
                    </div>
                  </div>
                )}

                {/* 카테고리 필터 탭 */}
                <div className="flex flex-wrap gap-1">
                  <button onClick={() => setSelectedCategory('ALL')}
                    className={`text-[8px] px-2 py-0.5 rounded font-bold transition-all ${
                      selectedCategory === 'ALL'
                        ? 'bg-white/[0.12] text-white'
                        : 'bg-white/[0.03] text-gray-500 hover:text-gray-300'
                    }`}>
                    전체
                  </button>
                  {usedCategories.map(catKey => {
                    const catInfo = allCategoryMap[catKey] || { label: catKey, color: 'bg-gray-500/20 text-gray-400' };
                    return (
                      <button key={catKey} onClick={() => setSelectedCategory(catKey)}
                        className={`text-[8px] px-2 py-0.5 rounded font-bold transition-all ${
                          selectedCategory === catKey
                            ? catInfo.color + ' ring-1 ring-white/20'
                            : 'bg-white/[0.03] text-gray-500 hover:text-gray-300'
                        }`}>
                        {catInfo.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 새 SOP 생성 버튼 */}
              <div className="px-2 pt-2">
                <button onClick={handleCreateNew}
                  className="w-full py-2 rounded-lg border-2 border-dashed border-cyan-500/30 bg-cyan-500/5
                    text-cyan-400 text-[13px] font-bold hover:bg-cyan-500/10 hover:border-cyan-500/50
                    transition-all flex items-center justify-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  새 SOP 생성
                </button>
              </div>

              {/* SOP 리스트 */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredSops.map(sop => {
                  const catInfo = allCategoryMap[sop.sop_category] || { label: sop.sop_category || '미분류', color: 'bg-gray-500/20 text-gray-400' };
                  const priInfo = PRIORITY_BADGE[sop.priority] || PRIORITY_BADGE['관심'];
                  const isSelected = selectedSop?.sop_id === sop.sop_id;

                  return (
                    <div key={sop.sop_id} className="relative group">
                      <button onClick={() => handleSelectSop(sop)}
                        className={`w-full text-left rounded-lg p-2.5 transition-all ${
                          isSelected
                            ? 'bg-white/[0.08] border border-white/[0.12]'
                            : 'hover:bg-white/[0.03] border border-transparent'
                        }`}>
                        {/* 카테고리 + 우선순위 */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${catInfo.color}`}>
                            {catInfo.label}
                          </span>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${priInfo.color}`}>
                            {priInfo.label}
                          </span>
                          {sop.target_equipment_id && (
                            <span className="text-[8px] text-cyan-400/60 bg-cyan-500/10 px-1 py-0.5 rounded">
                              {sop.target_equipment_id}
                            </span>
                          )}
                        </div>

                        {/* SOP 이름 */}
                        <div className={`text-[13px] font-bold leading-tight ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                          {sop.sop_name}
                        </div>

                        {/* 부가 정보 */}
                        <div className="flex items-center gap-2 mt-1 text-[9px] text-gray-500">
                          <span>{sop.sop_id}</span>
                          {sop.estimated_duration_min && <span>· {sop.estimated_duration_min}분</span>}
                        </div>
                      </button>

                      {/* 삭제 버튼 (호버 시 표시) */}
                      {deleteConfirm === sop.sop_id ? (
                        <div className="absolute top-1 right-1 flex items-center gap-1 bg-[#0c1220] border border-red-500/30 rounded-lg p-1.5 shadow-xl z-10">
                          <span className="text-[9px] text-red-400 px-1">삭제?</span>
                          <button onClick={() => handleDelete(sop.sop_id)}
                            className="text-[9px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 font-bold">
                            확인
                          </button>
                          <button onClick={() => setDeleteConfirm(null)}
                            className="text-[9px] px-1.5 py-0.5 rounded text-gray-500 hover:text-gray-300">
                            취소
                          </button>
                        </div>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(sop.sop_id); }}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity
                            w-6 h-6 rounded flex items-center justify-center
                            text-gray-600 hover:text-red-400 hover:bg-red-500/10"
                          title="삭제">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
                {filteredSops.length === 0 && (
                  <div className="text-center py-8 text-gray-600 text-[12px]">
                    {selectedCategory === 'ALL' ? '등록된 SOP가 없습니다' : '해당 카테고리에 SOP가 없습니다'}
                  </div>
                )}
              </div>
            </aside>

            {/* ── 메인 콘텐츠 ── */}
            <main className="flex-1 overflow-hidden">
              {tab === 'history' ? (
                /* 실행이력 탭 */
                <div className="h-full overflow-y-auto p-4">
                  <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                    <span className="text-[12px] bg-white/[0.06] px-2 py-0.5 rounded">📋</span>
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
                            <span className="text-[13px] text-white font-bold">{ex.sop?.sop_name || ex.sop_id}</span>
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
                  key={selectedSop?.sop_id}
                  sop={selectedSop}
                  eventId={eventContext?.event_id || 'EVT-SC-01-001'}
                />
              ) : tab === 'edit' ? (
                /* 편집 탭 — 플로우차트 에디터 */
                <SopFlowEditor
                  key={selectedSop?.sop_id + (selectedSop?._isNew ? '-new' : '')}
                  sop={selectedSop}
                  isNew={!!selectedSop?._isNew}
                  onSave={(newSopId) => {
                    refreshSops(newSopId);
                    setTab('execute');
                  }}
                  onCancel={() => {
                    if (selectedSop?._isNew) setSelectedSop(null);
                    setTab('execute');
                  }}
                  onDelete={(sopId) => {
                    handleDelete(sopId);
                    setTab('execute');
                  }}
                  customCategories={Object.entries(customCategories).map(([k, v]) => ({ value: k, label: v.label }))}
                />
              ) : null}
            </main>
          </>
        )}
      </div>
    </div>
  );
}

/* ── 휴지통 전체 뷰 컴포넌트 ── */
function TrashView({
  trashSops, allTrashSops, trashCategory, setTrashCategory,
  trashUsedCategories, allCategoryMap, onRestore, onPermanentDelete,
  permanentDeleteConfirm, setPermanentDeleteConfirm,
}: {
  trashSops: any[];
  allTrashSops: any[];
  trashCategory: string;
  setTrashCategory: (c: string) => void;
  trashUsedCategories: string[];
  allCategoryMap: Record<string, { label: string; color: string }>;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  permanentDeleteConfirm: string | null;
  setPermanentDeleteConfirm: (id: string | null) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'linear-gradient(180deg, #0c1220 0%, #0a0f1a 100%)' }}>
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">휴지통</h2>
            <p className="text-[12px] text-gray-500">삭제된 SOP는 30일간 보존됩니다. 이후 자동으로 영구 삭제됩니다.</p>
          </div>
          <div className="ml-auto text-[12px] text-gray-500">
            {allTrashSops.length}개 항목
          </div>
        </div>

        {/* 카테고리 필터 */}
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setTrashCategory('ALL')}
            className={`text-[9px] px-2.5 py-1 rounded font-bold transition-all ${
              trashCategory === 'ALL'
                ? 'bg-white/[0.12] text-white'
                : 'bg-white/[0.03] text-gray-500 hover:text-gray-300'
            }`}>
            전체 ({allTrashSops.length})
          </button>
          {trashUsedCategories.map(catKey => {
            const catInfo = allCategoryMap[catKey] || { label: catKey, color: 'bg-gray-500/20 text-gray-400' };
            const count = allTrashSops.filter(s => s.sop_category === catKey).length;
            return (
              <button key={catKey} onClick={() => setTrashCategory(catKey)}
                className={`text-[9px] px-2.5 py-1 rounded font-bold transition-all ${
                  trashCategory === catKey
                    ? catInfo.color + ' ring-1 ring-white/20'
                    : 'bg-white/[0.03] text-gray-500 hover:text-gray-300'
                }`}>
                {catInfo.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* 목록 */}
      <div className="p-4 space-y-2">
        {trashSops.map(sop => {
          const catInfo = allCategoryMap[sop.sop_category] || { label: sop.sop_category || '미분류', color: 'bg-gray-500/20 text-gray-400' };
          const deletedDate = sop.deleted_at ? new Date(sop.deleted_at) : null;
          const daysRemaining = sop.days_remaining ?? 30;
          const isConfirming = permanentDeleteConfirm === sop.sop_id;

          return (
            <div key={sop.sop_id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors">
              <div className="flex items-start gap-4">
                {/* 좌측: SOP 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${catInfo.color}`}>
                      {catInfo.label}
                    </span>
                    <span className="text-[12px] font-mono text-gray-500">{sop.sop_id}</span>
                  </div>
                  <div className="text-[12px] font-bold text-gray-300 mb-1">{sop.sop_name}</div>
                  <div className="flex items-center gap-3 text-[9px] text-gray-500">
                    {deletedDate && (
                      <span>삭제일: {deletedDate.toLocaleDateString('ko-KR')}</span>
                    )}
                    {sop.target_equipment_id && (
                      <span>설비: {sop.target_equipment_id}</span>
                    )}
                    {sop.steps?.length > 0 && (
                      <span>단계: {sop.steps.length}개</span>
                    )}
                  </div>
                </div>

                {/* 우측: 남은 일수 + 액션 버튼 */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className={`text-[9px] px-2 py-0.5 rounded font-bold ${
                    daysRemaining <= 7
                      ? 'bg-red-500/15 text-red-400'
                      : daysRemaining <= 14
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-gray-500/15 text-gray-500'
                  }`}>
                    {daysRemaining}일 남음
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* 복원 버튼 */}
                    <button onClick={() => onRestore(sop.sop_id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-bold
                        bg-green-500/10 text-green-400 border border-green-500/20
                        hover:bg-green-500/20 hover:border-green-500/30 transition-all"
                      title="복원">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      복원
                    </button>

                    {/* 영구삭제 */}
                    {isConfirming ? (
                      <div className="flex items-center gap-1 bg-[#0c1220] border border-red-500/30 rounded-lg px-2 py-1">
                        <span className="text-[9px] text-red-400">영구삭제?</span>
                        <button onClick={() => onPermanentDelete(sop.sop_id)}
                          className="text-[9px] px-2 py-0.5 rounded bg-red-500/30 text-red-300 hover:bg-red-500/50 font-bold">
                          확인
                        </button>
                        <button onClick={() => setPermanentDeleteConfirm(null)}
                          className="text-[9px] px-1.5 py-0.5 text-gray-500 hover:text-gray-300">
                          취소
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setPermanentDeleteConfirm(sop.sop_id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-bold
                          bg-red-500/10 text-red-400/70 border border-red-500/15
                          hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all"
                        title="영구 삭제">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        바로 삭제
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {trashSops.length === 0 && (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-700 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <div className="text-[13px] text-gray-600 font-bold">휴지통이 비어있습니다</div>
            <div className="text-[12px] text-gray-700 mt-1">삭제된 SOP가 이곳에 표시됩니다</div>
          </div>
        )}
      </div>
    </div>
  );
}
