// ref: CLAUDE.md §9.3 — 위험예측 (M-RSK)
'use client';
import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';
// CameraController now uses equipment IDs directly
import type { VisualState } from '@/lib/constants';

const ThreeCanvas = dynamic(() => import('@/components/viewer3d/ThreeCanvas').then(m => ({ default: m.ThreeCanvas })), { ssr: false });
const TestbedModel = dynamic(() => import('@/components/viewer3d/TestbedModel').then(m => ({ default: m.TestbedModel })), { ssr: false });
const CameraController = dynamic(() => import('@/components/viewer3d/CameraController').then(m => ({ default: m.CameraController })), { ssr: false });
const ImpactNetwork2D = dynamic(() => import('@/components/risk/ImpactNetwork2D').then(m => ({ default: m.ImpactNetwork2D })), { ssr: false });

export default function RiskPage() {
  const { eventContext, setSelectedEquipment } = useAppStore();
  const [kgsResults, setKgsResults] = useState<any[]>([]);
  const [hazop, setHazop] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<string | null>(null);
  const [timeSlider, setTimeSlider] = useState(0);

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

  const handleNodeClick = useCallback((equipmentId: string) => {
    setSelectedEquipment(equipmentId);
    setCameraTarget(equipmentId);
  }, [setSelectedEquipment]);

  // 시간축 기반 컬러링
  const equipmentStates: Record<string, VisualState> = {};
  for (const r of kgsResults) {
    if (r.predicted_after_sec == null || r.predicted_after_sec <= timeSlider * 60) {
      const state: VisualState = r.impact_type === 'PRIMARY_EVENT' ? 'critical' :
                                  r.impact_score >= 80 ? 'critical' :
                                  r.impact_score >= 60 ? 'warning' : 'affected';
      equipmentStates[r.affected_equipment_id] = state;
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* 분석 입력 패널 */}
      <div className="h-14 bg-bg-secondary border-b border-gray-700 flex items-center px-4 gap-4 text-xs">
        <span className="text-gray-400">이벤트 연계: <b className="text-white">{scenarioId}</b></span>
        {eventContext?.trigger_equipment_id && (
          <span className="text-gray-400">트리거: <b className="text-orange-400">{eventContext.trigger_equipment_id}</b></span>
        )}
        <span className="text-green-400">🟢 KGS 연결정상</span>
        <button onClick={handleRun} disabled={loading}
          className="bg-accent-blue text-white px-4 py-1.5 rounded hover:bg-blue-500 disabled:opacity-50 font-medium">
          {loading ? '분석중...' : '▶ 위험예측 실행'}
        </button>
        <button onClick={() => { setKgsResults([]); setHazop(null); setTimeSlider(0); }}
          className="text-gray-400 hover:text-white px-2 py-1">↻ 초기화</button>
      </div>

      {/* 3분할 */}
      <div className="flex-1 flex min-h-0">
        {/* 좌: 2D 영향 네트워크 */}
        <div className="w-[30%] border-r border-gray-700">
          <ImpactNetwork2D kgsResults={kgsResults} onNodeClick={handleNodeClick} />
        </div>

        {/* 중: 3D 뷰어 + 시간축 */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 bg-bg-primary">
            <ThreeCanvas>
              <TestbedModel
                equipmentStates={equipmentStates}
                onEquipmentClick={handleNodeClick}
                heatmapTarget={kgsResults.length > 0 ? {
                  equipmentId: kgsResults[0]?.trigger_equipment_id,
                  radius: Math.max(...kgsResults.map(r => r.impact_score)) * 1.5,
                } : null}
                propagationPaths={kgsResults
                  .filter(r => r.trigger_equipment_id !== r.affected_equipment_id)
                  .map(r => ({ from: r.trigger_equipment_id, to: r.affected_equipment_id }))}
              />
              <CameraController targetEquipmentId={cameraTarget} />
            </ThreeCanvas>
          </div>

          {/* 시간축 슬라이더 */}
          {kgsResults.length > 0 && (
            <div className="h-10 bg-bg-secondary border-t border-gray-700 flex items-center px-4 gap-3">
              <span className="text-[10px] text-gray-500">시간축:</span>
              <input
                type="range" min={0} max={60} value={timeSlider}
                onChange={(e) => setTimeSlider(Number(e.target.value))}
                className="flex-1 h-1 accent-cyan-500"
              />
              <span className="text-[10px] text-gray-400 w-12">{timeSlider}분</span>
            </div>
          )}
        </div>

        {/* 우: HAZOP + 상세 */}
        <div className="w-[30%] border-l border-gray-700 p-3 overflow-y-auto">
          <h4 className="text-xs text-gray-400 mb-3">HAZOP 상세</h4>
          {hazop ? (
            <div className="space-y-3 text-[11px]">
              {[
                { label: '노드', value: hazop.node },
                { label: '파라미터', value: hazop.process_parameter },
                { label: '편차', value: hazop.deviation },
                { label: '원인', value: hazop.cause },
                { label: '이벤트 시나리오', value: hazop.event_scenario },
                { label: '위험 시나리오', value: hazop.hazard_scenario },
                { label: '예방조치', value: hazop.preventive_action },
                { label: '비상대응', value: hazop.emergency_response, highlight: true },
              ].map(({ label, value, highlight }) => (
                <div key={label}>
                  <span className="text-gray-500 text-[10px]">{label}</span>
                  <div className={highlight ? 'text-orange-400' : 'text-white'}>{value}</div>
                </div>
              ))}

              <div className="mt-4 pt-3 border-t border-gray-700">
                <h5 className="text-xs text-gray-400 mb-2">권고조치</h5>
                {kgsResults.filter(r => r.recommended_action).slice(0, 3).map((r, i) => (
                  <div key={i} className="text-[11px] text-gray-300 mb-1">
                    • {r.recommended_action}
                  </div>
                ))}
              </div>

              {hazop.linked_sop_id && (
                <div className="mt-3 p-2 bg-bg-tertiary rounded">
                  <div className="text-[10px] text-gray-400">연계 SOP</div>
                  <div className="text-accent-blue text-[11px]">{hazop.linked_sop_id}</div>
                  <button className="text-[10px] text-accent-blue mt-1 hover:underline">[SOP 실행]</button>
                </div>
              )}
            </div>
          ) : <div className="text-gray-600 text-[11px]">위험예측 실행 후 HAZOP 데이터가 표시됩니다</div>}
        </div>
      </div>
    </div>
  );
}
