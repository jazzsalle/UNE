// ref: CLAUDE.md §9.6 — 이력조회 (M-HIS) 완성
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAppStore } from '@/stores/appStore';

type PeriodFilter = '1m' | '3m' | '1y' | 'all';
type TypeFilter = '정비' | '점검' | '교체' | '사고';

const EQUIPMENT_NAMES_KR: Record<string, string> = {
  'SHP-001': 'LH2 운반선',
  'ARM-101': '로딩암',
  'TK-101':  '저장탱크 #1',
  'TK-102':  '저장탱크 #2',
  'BOG-201': 'BOG 압축기',
  'PMP-301': '이송펌프',
  'VAP-401': '기화기',
  'REL-701': '재액화기',
  'VAL-601': '벤트스택 #1',
  'VAL-602': '벤트스택 #2',
  'PIP-501': '메인배관',
  'SWP-001': '해수펌프',
};
const eqName = (id: string) => EQUIPMENT_NAMES_KR[id] || id;

const TYPE_KEYWORDS: Record<TypeFilter, string[]> = {
  '정비': ['정비', '보수', '유지', '교체 예정', '베어링', '윤활'],
  '점검': ['점검', '검사', '확인', '측정', '성능'],
  '교체': ['교체', '설치', '신규', '업그레이드'],
  '사고': ['사고', '고장', '이상', '트립', '누출', '파손', '캐비테이션', '과압', 'ESD'],
};

function getHistoryType(summary: string): TypeFilter {
  // 우선순위: 사고 > 교체 > 정비 > 점검(기본)
  const priority: TypeFilter[] = ['사고', '교체', '정비', '점검'];
  for (const type of priority) {
    if (TYPE_KEYWORDS[type].some(k => summary?.includes(k))) return type;
  }
  return '점검';
}

function filterByPeriod(date: string | null, period: PeriodFilter): boolean {
  if (period === 'all' || !date) return true;
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  switch (period) {
    case '1m': return diffDays <= 30;
    case '3m': return diffDays <= 90;
    case '1y': return diffDays <= 365;
    default: return true;
  }
}

export default function HistoryPage() {
  const [histories, setHistories] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [equipmentFilter, setEquipmentFilter] = useState<string[]>([]);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter[]>([]);
  const router = useRouter();
  const setEventContext = useAppStore(s => s.setEventContext);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    Promise.all(['SC-01','SC-02','SC-03','SC-04','SC-05','SC-06','SC-07','SC-08'].map(s => api.getSafetia(s).catch(() => [])))
      .then(results => setHistories(results.flat()));
  }, []);

  const filtered = histories.filter(h => {
    if (equipmentFilter.length > 0 && !equipmentFilter.includes(h.equipment_id)) return false;
    if (!filterByPeriod(h.last_maintenance_date, periodFilter)) return false;
    if (typeFilter.length > 0) {
      const hType = getHistoryType(h.past_incident_summary || '');
      if (!typeFilter.includes(hType)) return false;
    }
    return true;
  });

  const TYPE_COLORS: Record<TypeFilter, string> = {
    '정비': 'text-blue-400',
    '점검': 'text-green-400',
    '교체': 'text-purple-400',
    '사고': 'text-red-400',
  };

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* Sidebar filters */}
      <aside className="w-full lg:w-[200px] bg-bg-secondary border-b lg:border-b-0 lg:border-r border-gray-700 p-3 overflow-y-auto max-h-[30vh] lg:max-h-none">
        {/* Mobile: collapsible filter toggle */}
        <div className="lg:block">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs text-gray-400 font-semibold">설비 필터</h4>
          <button onClick={() => setShowHelp(!showHelp)}
            className="text-[10px] text-gray-500 hover:text-cyan-400 border border-gray-600 hover:border-cyan-500/30 px-1.5 py-0.5 rounded transition-all"
            title="도움말">?</button>
        </div>
        {showHelp && (
          <div className="mb-3 p-2.5 bg-gray-800/80 rounded border border-gray-600 text-[11px] space-y-1.5">
            <div className="text-cyan-400 font-bold text-[12px]">이력관리 / 분석</div>
            <ul className="text-gray-400 space-y-1 list-disc ml-3">
              <li><b className="text-white">세이프티아 이력 데이터</b>: 각 설비의 정비/점검/사고/교체 이력을 조회</li>
              <li><b className="text-white">설비 필터</b>: 좌측에서 특정 설비를 선택하여 필터링</li>
              <li><b className="text-white">기간 필터</b>: 최근 1개월/3개월/1년/전체 기간 선택</li>
              <li><b className="text-white">유형 필터</b>: 정비/점검/교체/사고 유형별 분류</li>
              <li><b className="text-white">이력 상세</b>: 목록에서 항목 클릭 시 운영자 메모, 관련 SOP, 위험예측 연계 확인</li>
            </ul>
            <div className="text-gray-500 text-[10px] border-t border-gray-700 pt-1">
              시나리오 에뮬레이터의 SYMPTOM(이상감지) 단계에서 자동으로 관련 이력이 조회됩니다.
            </div>
          </div>
        )}
        <button onClick={() => setEquipmentFilter([])}
          className={`text-[12px] mb-2 ${equipmentFilter.length === 0 ? 'text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}>
          [전체 설비]
        </button>
        <div className="flex flex-wrap lg:block gap-2 lg:gap-0">
        {['BOG-201','TK-101','PMP-301','VAP-401','VAL-601','REL-701','ARM-101','SHP-001','PIP-501'].map(id => (
          <label key={id} className="flex items-center gap-2 text-[13px] text-gray-300 mb-1 cursor-pointer">
            <input type="checkbox" checked={equipmentFilter.includes(id)} onChange={(e) => {
              setEquipmentFilter(prev => e.target.checked ? [...prev, id] : prev.filter(x => x !== id));
            }} className="rounded accent-cyan-500" />
            {eqName(id)}
          </label>
        ))}
        </div>

        <div className="border-t border-gray-700 mt-3 pt-3">
          <h4 className="text-xs text-gray-400 mb-2 font-semibold">기간 필터</h4>
          {([['1m', '최근 1개월'], ['3m', '최근 3개월'], ['1y', '최근 1년'], ['all', '전체']] as [PeriodFilter, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setPeriodFilter(k)}
              className={`block text-[13px] mb-1 ${periodFilter === k ? 'text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}>
              [{label}]
            </button>
          ))}
        </div>

        <div className="border-t border-gray-700 mt-3 pt-3">
          <h4 className="text-xs text-gray-400 mb-2 font-semibold">유형 필터</h4>
          {(['정비', '점검', '교체', '사고'] as TypeFilter[]).map(type => (
            <label key={type} className="flex items-center gap-2 text-[13px] text-gray-300 mb-1 cursor-pointer">
              <input type="checkbox" checked={typeFilter.includes(type)} onChange={(e) => {
                setTypeFilter(prev => e.target.checked ? [...prev, type] : prev.filter(x => x !== type));
              }} className="rounded accent-cyan-500" />
              <span className={TYPE_COLORS[type]}>{type}</span>
            </label>
          ))}
        </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs text-gray-400">이력 목록 ({filtered.length}건)</h3>
          </div>
          <table className="w-full text-[13px]">
            <thead><tr className="text-gray-500 border-b border-gray-700">
              <th className="text-left py-2 w-16">구분</th>
              <th className="text-left">설비</th>
              <th className="text-left">최근점검</th>
              <th className="text-left">사고이력</th>
              <th className="text-left">연계SOP</th>
            </tr></thead>
            <tbody>
              {filtered.map(h => {
                const hType = getHistoryType(h.past_incident_summary || '');
                return (
                  <tr key={h.history_id} onClick={() => setSelected(h)}
                    className={`border-b border-gray-800 cursor-pointer hover:bg-bg-tertiary ${selected?.history_id === h.history_id ? 'bg-bg-tertiary' : ''}`}>
                    <td className={`py-2 font-medium ${TYPE_COLORS[hType]}`}>{hType}</td>
                    <td className="text-white">{eqName(h.equipment_id)}</td>
                    <td className="text-gray-400">{h.last_maintenance_date || '—'}</td>
                    <td className="text-gray-400 max-w-[200px] truncate">{h.past_incident_summary || '—'}</td>
                    <td className="text-accent-blue">{h.linked_sop_id || '—'}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-500">필터 조건에 맞는 이력이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="h-auto lg:h-[220px] border-t border-gray-700 bg-bg-secondary p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold">이력 상세 — {eqName(selected.equipment_id)}</h4>
              <div className="flex gap-2">
                <button onClick={() => {
                  router.push('/risk');
                }} className="text-[12px] px-2 py-1 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30">
                  상호영향 위험예측
                </button>
                <button onClick={() => {
                  router.push(`/sop`);
                }} className="text-[12px] px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30">
                  관련 SOP
                </button>
              </div>
            </div>
            <div className="text-[13px] space-y-2">
              <div className="flex flex-wrap gap-4 lg:gap-8">
                <div><span className="text-gray-500">점검일:</span> <span className="text-white">{selected.last_maintenance_date || '—'}</span></div>
                <div><span className="text-gray-500">시나리오:</span> <span className="text-cyan-400">{selected.scenario_id}</span></div>
                <div><span className="text-gray-500">유형:</span> <span className={TYPE_COLORS[getHistoryType(selected.past_incident_summary || '')]}>{getHistoryType(selected.past_incident_summary || '')}</span></div>
              </div>
              <div><span className="text-gray-500">사고요약:</span> <span className="text-white">{selected.past_incident_summary || '—'}</span></div>
              <div><span className="text-gray-500">운영자메모:</span> <span className="text-white">{selected.operator_note || '—'}</span></div>
              <div><span className="text-gray-500">연계SOP:</span> <span className="text-accent-blue">{selected.linked_sop_id || '—'}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
