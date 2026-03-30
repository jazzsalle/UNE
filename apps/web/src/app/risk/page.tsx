// ref: CLAUDE.md §9.3 — 위험예측 (M-RSK)
'use client';
import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';

export default function RiskPage() {
  const { eventContext } = useAppStore();
  const [kgsResults, setKgsResults] = useState<any[]>([]);
  const [hazop, setHazop] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const scenarioId = eventContext?.scenario_id || 'SC-01';

  const handleRun = async () => {
    setLoading(true);
    try {
      const [kgs, hz] = await Promise.all([
        api.getKgs(scenarioId),
        api.getHazop(scenarioId),
      ]);
      setKgsResults(kgs);
      setHazop(hz);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* 분석 입력 패널 */}
      <div className="h-14 bg-bg-secondary border-b border-gray-700 flex items-center px-4 gap-4 text-xs">
        <span className="text-gray-400">시나리오: <b className="text-white">{scenarioId}</b></span>
        <span className="text-green-400">🟢 KGS 연결정상</span>
        <button onClick={handleRun} disabled={loading}
          className="bg-accent-blue text-white px-4 py-1 rounded hover:bg-blue-500 disabled:opacity-50">
          {loading ? '분석중...' : '▶ 위험예측 실행'}
        </button>
      </div>

      {/* 3분할 */}
      <div className="flex-1 flex min-h-0">
        {/* 좌: 2D 영향 네트워크 */}
        <div className="w-[30%] border-r border-gray-700 p-3 overflow-y-auto">
          <h4 className="text-xs text-gray-400 mb-3">2D 영향 네트워크</h4>
          {kgsResults.length > 0 ? kgsResults.map((r) => (
            <div key={r.analysis_id} className="mb-2 p-2 rounded text-[11px]" style={{ borderLeft: `3px solid ${r.color_2d || '#666'}` }}>
              <div className="font-medium text-white">{r.affected_equipment_id}</div>
              <div className="text-gray-400">영향도: {r.impact_score}점 · {r.risk_level}</div>
              {r.predicted_after_sec != null && <div className="text-gray-500">{r.predicted_after_sec}초 후</div>}
            </div>
          )) : <div className="text-gray-600 text-[11px]">[실행] 버튼을 눌러주세요</div>}
        </div>

        {/* 중: 3D 뷰어 */}
        <div className="flex-1 flex items-center justify-center bg-bg-primary">
          <div className="text-gray-500 text-sm text-center">
            <div className="text-4xl mb-2">🌐</div>
            <div>3D 영향 컬러링 뷰어</div>
            <div className="text-xs text-gray-600 mt-1">시간축 슬라이더 포함</div>
          </div>
        </div>

        {/* 우: HAZOP + 상세 */}
        <div className="w-[30%] border-l border-gray-700 p-3 overflow-y-auto">
          <h4 className="text-xs text-gray-400 mb-3">HAZOP 상세</h4>
          {hazop ? (
            <div className="space-y-2 text-[11px]">
              <div><span className="text-gray-500">원인:</span> <span className="text-white">{hazop.cause}</span></div>
              <div><span className="text-gray-500">이벤트:</span> <span className="text-white">{hazop.event_scenario}</span></div>
              <div><span className="text-gray-500">위험:</span> <span className="text-white">{hazop.hazard_scenario}</span></div>
              <div><span className="text-gray-500">예방:</span> <span className="text-white">{hazop.preventive_action}</span></div>
              <div><span className="text-gray-500">비상:</span> <span className="text-orange-400">{hazop.emergency_response}</span></div>
              {hazop.linked_sop_id && (
                <div className="mt-3 p-2 bg-bg-tertiary rounded">
                  <div className="text-gray-400">연계 SOP</div>
                  <div className="text-accent-blue">{hazop.linked_sop_id}</div>
                </div>
              )}
            </div>
          ) : <div className="text-gray-600 text-[11px]">HAZOP 데이터 없음</div>}
        </div>
      </div>
    </div>
  );
}
