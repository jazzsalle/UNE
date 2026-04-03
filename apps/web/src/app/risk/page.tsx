// ref: CLAUDE.md §9.3 — 위험예측 (M-RSK)
'use client';
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/stores/appStore';
import { useEmulatorStore } from '@/stores/emulatorStore';
import { api } from '@/lib/api';
import type { VisualState } from '@/lib/constants';
import { CameraControlsOverlay, getSavedCamera, type CameraBookmarkRef } from '@/components/viewer3d/CameraBookmark';

const ThreeCanvas = dynamic(() => import('@/components/viewer3d/ThreeCanvas').then(m => ({ default: m.ThreeCanvas })), { ssr: false });
const TestbedModel = dynamic(() => import('@/components/viewer3d/TestbedModel').then(m => ({ default: m.TestbedModel })), { ssr: false });
const CameraController = dynamic(() => import('@/components/viewer3d/CameraController').then(m => ({ default: m.CameraController })), { ssr: false });
const ImpactNetwork2D = dynamic(() => import('@/components/risk/ImpactNetwork2D').then(m => ({ default: m.ImpactNetwork2D })), { ssr: false });
const CameraBookmarkInner = dynamic(() => import('@/components/viewer3d/CameraBookmark').then(m => ({ default: m.CameraBookmark })), { ssr: false });
const RiskPOIs = dynamic(() => import('@/components/risk/RiskPOIs').then(m => ({ default: m.RiskPOIs })), { ssr: false });
const EnvironmentScene = dynamic(() => import('@/components/viewer3d/EnvironmentScene').then(m => ({ default: m.EnvironmentScene })), { ssr: false });
const TopViewSwitcher = dynamic(() => import('@/components/viewer3d/TopViewSwitcher').then(m => ({ default: m.TopViewSwitcher })), { ssr: false });

// 설비별 피해범위 시뮬레이션 데이터 (레퍼런스 기반)
const DAMAGE_NODE_DATA: Record<string, {
  name: string; pressure: number; temperature: number;
  leakSize: number; leakArea: number; leakRate: number;
  fireIntensity: { kw: number; radius: number }[];
}> = {
  'BOG-201': {
    name: 'BOG 압축기', pressure: 10.5, temperature: 42,
    leakSize: 8, leakArea: 0.000050, leakRate: 0.089,
    fireIntensity: [
      { kw: 4, radius: 5.2 }, { kw: 8, radius: 3.8 },
      { kw: 12.5, radius: 3.0 }, { kw: 25, radius: 2.1 }, { kw: 37.5, radius: 1.7 },
    ],
  },
  'TK-101': {
    name: '저장탱크 #1', pressure: 4.2, temperature: -253,
    leakSize: 12, leakArea: 0.000113, leakRate: 0.156,
    fireIntensity: [
      { kw: 4, radius: 8.1 }, { kw: 8, radius: 5.7 },
      { kw: 12.5, radius: 4.5 }, { kw: 25, radius: 3.2 }, { kw: 37.5, radius: 2.6 },
    ],
  },
  'REL-701': {
    name: '재액화기', pressure: 5.8, temperature: -165,
    leakSize: 6, leakArea: 0.000028, leakRate: 0.042,
    fireIntensity: [
      { kw: 4, radius: 3.1 }, { kw: 8, radius: 2.2 },
      { kw: 12.5, radius: 1.7 }, { kw: 25, radius: 1.2 }, { kw: 37.5, radius: 1.0 },
    ],
  },
  'PMP-301': {
    name: '이송펌프', pressure: 7.1, temperature: -248,
    leakSize: 5, leakArea: 0.000020, leakRate: 0.034,
    fireIntensity: [
      { kw: 4, radius: 2.8 }, { kw: 8, radius: 2.0 },
      { kw: 12.5, radius: 1.6 }, { kw: 25, radius: 1.1 }, { kw: 37.5, radius: 0.9 },
    ],
  },
  'VAP-401': {
    name: '기화기', pressure: 6.8, temperature: -190,
    leakSize: 10, leakArea: 0.000079, leakRate: 0.114,
    fireIntensity: [
      { kw: 4, radius: 6.4 }, { kw: 8, radius: 4.5 },
      { kw: 12.5, radius: 3.6 }, { kw: 25, radius: 2.5 }, { kw: 37.5, radius: 2.0 },
    ],
  },
};

const FIRE_COLORS = ['#2196F3', '#4CAF50', '#FFC107', '#FF9800', '#F44336'];

function RiskDetailPanel({ hazop, kgsResults }: { hazop: any; kgsResults: any[] }) {
  const [tab, setTab] = useState<'risk' | 'damage'>('risk');

  return (
    <div className="w-[22%] border-l border-gray-700 flex flex-col overflow-hidden">
      {/* 탭 헤더 */}
      <div className="flex border-b border-gray-700 shrink-0">
        <button
          onClick={() => setTab('risk')}
          className={`flex-1 py-2 text-[11px] font-bold transition-colors ${
            tab === 'risk'
              ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          위험도 예측
        </button>
        <button
          onClick={() => setTab('damage')}
          className={`flex-1 py-2 text-[11px] font-bold transition-colors ${
            tab === 'damage'
              ? 'text-orange-400 border-b-2 border-orange-400 bg-orange-500/5'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          피해범위 예측
        </button>
      </div>

      {/* 탭 내용 */}
      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'risk' ? (
          /* 위험도 예측 탭 */
          hazop ? (
            <div className="space-y-2.5">
              {/* 위험등급 배지 + 설비명 */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[9px] px-2 py-0.5 rounded font-bold bg-orange-500/20 text-orange-400">
                  {hazop.risk_level || '높음'}
                </span>
                <span className="text-white text-[12px] font-bold">{hazop.node}</span>
              </div>

              {[
                { label: '설명', value: hazop.node },
                { label: '공정 파라미터', value: hazop.process_parameter },
                { label: '이탈', value: hazop.deviation },
                { label: '원인', value: hazop.cause },
                { label: '이벤트 시나리오', value: hazop.event_scenario },
                { label: '위험 시나리오', value: hazop.hazard_scenario },
              ].map(({ label, value }) => (
                <div key={label} className="text-[11px]">
                  <span className="text-gray-500 text-[10px]">{label}</span>
                  <div className="text-white mt-0.5">{value}</div>
                </div>
              ))}

              <div className="pt-2 border-t border-gray-700 space-y-2">
                <div className="text-[11px]">
                  <span className="text-gray-500 text-[10px]">예방 조치</span>
                  <div className="text-white mt-0.5">{hazop.preventive_action}</div>
                </div>
                <div className="text-[11px]">
                  <span className="text-gray-500 text-[10px]">비상 대응</span>
                  <div className="text-orange-400 mt-0.5">{hazop.emergency_response}</div>
                </div>
              </div>

              {/* 권고조치 */}
              {kgsResults.filter(r => r.recommended_action).length > 0 && (
                <div className="pt-2 border-t border-gray-700">
                  <span className="text-gray-500 text-[10px]">권고조치</span>
                  {kgsResults.filter(r => r.recommended_action).slice(0, 3).map((r, i) => (
                    <div key={i} className="text-[11px] text-gray-300 mt-1">• {r.recommended_action}</div>
                  ))}
                </div>
              )}

              {/* 연계 SOP */}
              {hazop.linked_sop_id && (
                <div className="mt-2 p-2 bg-bg-tertiary rounded">
                  <div className="text-[10px] text-gray-400">연계 SOP</div>
                  <div className="text-accent-blue text-[11px]">{hazop.linked_sop_id}</div>
                  <button className="text-[10px] text-accent-blue mt-1 hover:underline">[SOP 실행]</button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-600 text-[11px] text-center mt-8">위험예측 실행 후 데이터가 표시됩니다</div>
          )
        ) : (
          /* 피해범위 예측 탭 */
          kgsResults.length > 0 ? (
            <div className="space-y-4">
              <div className="text-[10px] text-gray-500 mb-2">
                전체 <span className="text-cyan-400 font-bold">{Object.keys(DAMAGE_NODE_DATA).length}건</span>의 정보가 조회되었습니다
              </div>
              {kgsResults.map((r, idx) => {
                const nodeData = DAMAGE_NODE_DATA[r.affected_equipment_id] || DAMAGE_NODE_DATA[r.trigger_equipment_id];
                if (!nodeData) return null;
                const eqId = r.affected_equipment_id || r.trigger_equipment_id;
                return (
                  <div key={idx} className="border border-gray-700 rounded-lg p-3">
                    <div className="text-[12px] font-bold text-white mb-2">{nodeData.name}</div>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-gray-500">압력(MPa)</span>
                        <span className="text-white">{nodeData.pressure}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">온도(℃)</span>
                        <span className="text-white">{nodeData.temperature}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">누출구 크기(mm)</span>
                        <span className="text-white">{nodeData.leakSize}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">누출 면적(m²)</span>
                        <span className="text-white">{nodeData.leakArea}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">누출량(kg/s)</span>
                        <span className="text-white">{nodeData.leakRate}</span>
                      </div>
                    </div>

                    {/* 화재강도 */}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="text-[10px] text-gray-500">화재강도</div>
                      <div className="relative w-10 h-10">
                        {[...nodeData.fireIntensity].reverse().map((fi, i) => (
                          <div
                            key={i}
                            className="absolute rounded-full"
                            style={{
                              width: `${(5 - i) * 8}px`,
                              height: `${(5 - i) * 8}px`,
                              top: '50%', left: '50%',
                              transform: 'translate(-50%, -50%)',
                              background: FIRE_COLORS[nodeData.fireIntensity.length - 1 - i] + '80',
                            }}
                          />
                        ))}
                      </div>
                      <div className="flex-1 space-y-0.5">
                        {nodeData.fireIntensity.map((fi, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[9px]">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: FIRE_COLORS[i] }} />
                            <span className="text-gray-400">{fi.kw}(kW/m²)</span>
                            <span className="text-white">: {fi.radius}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-gray-600 text-[11px] text-center mt-8">위험예측 실행 후 피해범위가 표시됩니다</div>
          )
        )}
      </div>
    </div>
  );
}

export default function RiskPage() {
  const { eventContext, setSelectedEquipment } = useAppStore();
  const emulatorPhase = useEmulatorStore((s) => s.phase);
  const emulatorRunning = useEmulatorStore((s) => s.running);
  const emulatorScenarioId = useEmulatorStore((s) => s.scenario_id);
  const [kgsResults, setKgsResults] = useState<any[]>([]);
  const [hazop, setHazop] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<string | null>(null);
  const cameraRef = useRef<CameraBookmarkRef | null>(null);
  const savedCamera = useMemo(() => getSavedCamera('risk'), []);
  const [timeSlider, setTimeSlider] = useState(0);
  const [viewMode, setViewMode] = useState<'3D' | '2D'>('3D');
  const [leftWidth, setLeftWidth] = useState(240);
  const resizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);
  const autoLoadedRef = useRef<string | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      const delta = e.clientX - startX.current;
      setLeftWidth(Math.max(160, Math.min(480, startW.current + delta)));
    };
    const onUp = () => { resizing.current = false; document.body.style.cursor = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const scenarioId = eventContext?.scenario_id || emulatorScenarioId || 'SC-01';

  // 에뮬레이터에서 FAULT 이상 phase 진입 시 KGS/HAZOP 자동 로드
  useEffect(() => {
    if (!emulatorRunning) return;
    const shouldAutoLoad = ['FAULT', 'SECONDARY_IMPACT', 'RESPONSE'].includes(emulatorPhase);
    if (shouldAutoLoad && autoLoadedRef.current !== scenarioId) {
      autoLoadedRef.current = scenarioId;
      Promise.all([
        api.getKgs(scenarioId),
        api.getHazop(scenarioId),
      ]).then(([kgs, hz]) => {
        setKgsResults(kgs);
        setHazop(hz);
      }).catch(console.error);
    }
  }, [emulatorRunning, emulatorPhase, scenarioId]);

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

  // KGS 결과에서 관련 설비 ID 추출 (그룹 프레이밍용)
  const frameEquipmentIds = useMemo(() => {
    if (kgsResults.length === 0) return null;
    const ids = new Set<string>();
    for (const r of kgsResults) {
      ids.add(r.trigger_equipment_id);
      if (r.affected_equipment_id) ids.add(r.affected_equipment_id);
    }
    return Array.from(ids);
  }, [kgsResults]);

  // 에뮬레이터 phase 기반 설비 상태 (시나리오 실행 중 3D 연동)
  const phaseEquipmentStates = useMemo<Record<string, VisualState>>(() => {
    if (!emulatorRunning || !eventContext) return {};
    const states: Record<string, VisualState> = {};
    const trigger = eventContext.trigger_equipment_id;
    const affected = eventContext.affected_equipment_ids || [];

    if (emulatorPhase === 'SYMPTOM') {
      if (trigger) states[trigger] = 'warning';
    } else if (emulatorPhase === 'FAULT') {
      if (trigger) states[trigger] = 'critical';
      for (const id of affected) states[id] = 'warning';
    } else if (emulatorPhase === 'SECONDARY_IMPACT') {
      if (trigger) states[trigger] = 'emergency';
      for (const id of affected) states[id] = 'affected';
    } else if (emulatorPhase === 'RESPONSE') {
      if (trigger) states[trigger] = 'warning';
    }
    return states;
  }, [emulatorRunning, emulatorPhase, eventContext]);

  // KGS 시간축 기반 컬러링 + 에뮬레이터 phase 상태 병합
  const equipmentStates: Record<string, VisualState> = { ...phaseEquipmentStates };
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
        {/* 좌: 설비 영향도 네트워크 (리사이즈 가능) */}
        <div className="flex flex-col shrink-0 relative" style={{ width: leftWidth }}>
          <div className="px-3 py-2 border-b border-gray-700 flex items-center gap-2">
            <span className="text-[11px] font-bold text-cyan-400">설비 영향도 분석</span>
            {kgsResults.length > 0 && (
              <span className="text-[9px] text-gray-500">
                — 트리거 설비에서 영향 받는 설비 간 위험 전파 관계도
              </span>
            )}
          </div>
          <div className="flex-1">
            <ImpactNetwork2D kgsResults={kgsResults} onNodeClick={handleNodeClick} />
          </div>
          {/* 리사이즈 핸들 */}
          <div
            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize group z-10 hover:bg-cyan-500/30 active:bg-cyan-500/50 transition-colors"
            onMouseDown={(e) => {
              e.preventDefault();
              resizing.current = true;
              startX.current = e.clientX;
              startW.current = leftWidth;
              document.body.style.cursor = 'col-resize';
            }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 right-0 w-0.5 h-8 bg-gray-600 group-hover:bg-cyan-400 rounded transition-colors" />
          </div>
        </div>

        {/* 중: 3D/2D 뷰어 + 시간축 */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 bg-bg-primary relative">
            {/* 2D/3D 모드 토글 */}
            <div className="absolute top-2 right-2 z-20 flex bg-black/60 rounded-lg overflow-hidden border border-gray-600/50 backdrop-blur-sm">
              <button
                onClick={() => setViewMode('3D')}
                className={`px-3 py-1.5 text-[11px] font-bold transition-colors ${
                  viewMode === '3D'
                    ? 'bg-cyan-500/30 text-cyan-400 border-r border-cyan-500/30'
                    : 'text-gray-400 hover:text-white border-r border-gray-600/50'
                }`}
              >
                3D
              </button>
              <button
                onClick={() => setViewMode('2D')}
                className={`px-3 py-1.5 text-[11px] font-bold transition-colors ${
                  viewMode === '2D'
                    ? 'bg-cyan-500/30 text-cyan-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                2D
              </button>
            </div>

            <CameraControlsOverlay controlRef={cameraRef} pageId="risk" />
            <ThreeCanvas initialPosition={savedCamera?.position} initialTarget={savedCamera?.target}>
              <TestbedModel
                equipmentStates={equipmentStates}
                onEquipmentClick={handleNodeClick}
                heatmapPoints={kgsResults.length > 0 ? [
                  { equipmentId: kgsResults[0]?.trigger_equipment_id, weight: 95 },
                  ...kgsResults
                    .filter(r => r.predicted_after_sec == null || r.predicted_after_sec <= timeSlider * 60)
                    .map(r => ({ equipmentId: r.affected_equipment_id, weight: r.impact_score })),
                ] : []}
                heatmapTarget={null}
                propagationPaths={kgsResults
                  .filter(r => r.trigger_equipment_id !== r.affected_equipment_id)
                  .map(r => ({ from: r.trigger_equipment_id, to: r.affected_equipment_id, impactScore: r.impact_score }))}
              />
              <EnvironmentScene />
              <RiskPOIs kgsResults={kgsResults} onNodeClick={handleNodeClick} />
              {viewMode === '3D' ? (
                <CameraController targetEquipmentId={cameraTarget} frameEquipmentIds={frameEquipmentIds} />
              ) : (
                <TopViewSwitcher equipmentIds={frameEquipmentIds} />
              )}
              <CameraBookmarkInner pageId="risk" controlRef={cameraRef} />
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

        {/* 우: 위험도 예측 / 피해범위 예측 탭 패널 */}
        <RiskDetailPanel hazop={hazop} kgsResults={kgsResults} />
      </div>
    </div>
  );
}
