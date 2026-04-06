// ref: CLAUDE.md §9.5 — 시뮬레이션/의사결정지원 (M-SIM) 3D 통합
'use client';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';
// CameraController now uses equipment IDs directly
import type { VisualState } from '@/lib/constants';
import { CameraControlsOverlay, getSavedCamera, type CameraBookmarkRef } from '@/components/viewer3d/CameraBookmark';
import { EQUIPMENT_POSITIONS } from '@/components/viewer3d/deckUtils';

const EQUIPMENT_NAMES_KR: Record<string, string> = {
  'SHP-001': 'LH2 운반선',   'ARM-101': '로딩암',
  'TK-101':  '저장탱크 #1',  'TK-102':  '저장탱크 #2',
  'BOG-201': 'BOG 압축기',   'PMP-301': '이송펌프',
  'VAP-401': '기화기',       'REL-701': '재액화기',
  'VAL-601': '벤트스택 #1',  'VAL-602': '벤트스택 #2',
  'PIP-501': '메인배관',     'SWP-001': '해수펌프',
};
const eqName = (id: string) => EQUIPMENT_NAMES_KR[id] || id;

const RISK_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  'NONE':     { bg: 'bg-gray-500/20',   text: 'text-gray-400',  label: '위험없음' },
  'LOW':      { bg: 'bg-green-500/20',  text: 'text-green-400', label: '저위험' },
  'MEDIUM':   { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: '중위험' },
  'HIGH':     { bg: 'bg-red-500/20',    text: 'text-red-400',   label: '고위험' },
};

const ThreeCanvas = dynamic(() => import('@/components/viewer3d/ThreeCanvas').then(m => ({ default: m.ThreeCanvas })), { ssr: false });
const TestbedModel = dynamic(() => import('@/components/viewer3d/TestbedModel').then(m => ({ default: m.TestbedModel })), { ssr: false });
const CameraController = dynamic(() => import('@/components/viewer3d/CameraController').then(m => ({ default: m.CameraController })), { ssr: false });
const CameraBookmarkInner = dynamic(() => import('@/components/viewer3d/CameraBookmark').then(m => ({ default: m.CameraBookmark })), { ssr: false });
const GasDispersion = dynamic(() => import('@/components/viewer3d/effects/GasDispersion').then(m => ({ default: m.GasDispersion })), { ssr: false });
const EquipmentPOIs = dynamic(() => import('@/components/viewer3d/EquipmentPOI').then(m => ({ default: m.EquipmentPOIs })), { ssr: false });
const EnvironmentScene = dynamic(() => import('@/components/viewer3d/EnvironmentScene').then(m => ({ default: m.EnvironmentScene })), { ssr: false });

export default function SimulationPage() {
  const { eventContext, setSelectedEquipment, sensorData } = useAppStore();
  const [equipment, setEquipment] = useState<any[]>([]);
  const [kgsResults, setKgsResults] = useState<any[]>([]);
  const [ketiResult, setKetiResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'event' | 'manual'>('event');
  const [simTime, setSimTime] = useState(0);
  const [simRunning, setSimRunning] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<string | null>(null);
  const cameraRef = useRef<CameraBookmarkRef | null>(null);
  const savedCamera = useMemo(() => getSavedCamera('simulation'), []);
  const [appliedOption, setAppliedOption] = useState<'A' | 'B' | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // 수동 실행 파라미터
  const [manualParams, setManualParams] = useState({
    scenario_id: 'SC-01', trigger_equipment: 'BOG-201',
    initial_pressure: 12.5, duration_hr: 2, temp_deviation: 5, flow_change: -40,
  });

  const hasEvent = !!(eventContext?.scenario_id && eventContext?.event_id);
  const scenarioId = tab === 'event' ? (eventContext?.scenario_id || '') : manualParams.scenario_id;

  // 이벤트 연계 탭 진입 시 이벤트가 없으면 수동 탭으로 안내
  // 이벤트 연계 탭에서 이벤트가 있으면 자동으로 시나리오 설정

  // 설비 목록 로드 (EquipmentPOIs용)
  useEffect(() => { api.getEquipment().then(setEquipment).catch(console.error); }, []);

  // 시뮬레이션 시간 자동 증가 타이머
  useEffect(() => {
    if (!simRunning) return;
    const maxTime = ketiResult?.expected_stabilization_min || 60;
    const interval = setInterval(() => {
      setSimTime(prev => {
        const next = prev + 1;
        if (next >= maxTime) {
          setSimRunning(false);
          return maxTime;
        }
        return next;
      });
    }, 1000); // 1초마다 1분 진행 (시뮬레이션 시간)
    return () => clearInterval(interval);
  }, [simRunning, ketiResult]);

  const handleRun = async () => {
    setLoading(true);
    setAppliedOption(null);
    setSimTime(0);
    try {
      const [kgs, keti] = await Promise.all([
        api.getKgs(scenarioId),
        api.getKeti(scenarioId),
      ]);
      setKgsResults(kgs);
      setKetiResult(keti);
      setSimRunning(true);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleStop = () => { setSimRunning(false); };
  const handleReset = () => { setSimRunning(false); setSimTime(0); setKgsResults([]); setKetiResult(null); setAppliedOption(null); };

  const handleApplyOption = useCallback((option: 'A' | 'B') => {
    setAppliedOption(option);
    // 대응안 적용 시 안정화 시간에 맞게 max time 조정
    if (ketiResult) {
      const stabMin = option === 'A'
        ? (ketiResult.option_a_stabilization_min || ketiResult.expected_stabilization_min)
        : (ketiResult.option_b_stabilization_min || ketiResult.expected_stabilization_min);
      // 적용 시점부터 시뮬레이션 계속 진행
      setSimRunning(true);
    }
  }, [ketiResult]);

  // 시간축 기반 3D 컬러링
  const equipmentStates = useMemo(() => {
    const states: Record<string, VisualState> = {};
    if (appliedOption) {
      const stabMin = appliedOption === 'A'
        ? (ketiResult?.option_a_stabilization_min || ketiResult?.expected_stabilization_min || 30)
        : (ketiResult?.option_b_stabilization_min || ketiResult?.expected_stabilization_min || 30);
      for (const r of kgsResults) {
        if (simTime >= stabMin) {
          states[r.affected_equipment_id] = 'normal';
        } else {
          const recovery = simTime / stabMin;
          states[r.affected_equipment_id] = recovery > 0.7 ? 'warning' : recovery > 0.3 ? 'affected' : (
            r.impact_type === 'PRIMARY_EVENT' ? 'emergency' :
            r.impact_score >= 80 ? 'critical' : 'warning'
          );
        }
      }
    } else {
      for (const r of kgsResults) {
        if (r.predicted_after_sec == null || r.predicted_after_sec <= simTime * 60) {
          states[r.affected_equipment_id] = r.impact_type === 'PRIMARY_EVENT' ? 'emergency' :
            r.impact_score >= 80 ? 'critical' : r.impact_score >= 60 ? 'warning' : 'affected';
        }
      }
    }
    return states;
  }, [kgsResults, simTime, appliedOption, ketiResult]);

  const handleEquipmentClick = (id: string) => {
    setSelectedEquipment(id);
    setCameraTarget(id);
  };

  const currentMaxTime = appliedOption
    ? (appliedOption === 'A'
      ? (ketiResult?.option_a_stabilization_min || ketiResult?.expected_stabilization_min || 60)
      : (ketiResult?.option_b_stabilization_min || ketiResult?.expected_stabilization_min || 60))
    : (ketiResult?.expected_stabilization_min || 60);

  const progress = currentMaxTime > 0 ? (simTime / currentMaxTime) * 100 : 0;

  return (
    <div className="h-full flex flex-col">
      {/* 탭 + 입력 */}
      <div className="bg-bg-secondary border-b border-gray-700 px-4 py-2">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => setTab('event')} className={`text-xs px-3 py-1 rounded ${tab === 'event' ? 'bg-accent-blue text-white' : 'text-gray-400'}`}>이벤트 연계</button>
          <button onClick={() => setTab('manual')} className={`text-xs px-3 py-1 rounded ${tab === 'manual' ? 'bg-accent-blue text-white' : 'text-gray-400'}`}>수동 실행</button>
          <button onClick={() => setShowHelp(!showHelp)} className="ml-auto text-[11px] text-gray-500 hover:text-gray-300 border border-gray-600 px-2 py-0.5 rounded">
            {showHelp ? '도움말 닫기' : '? 시뮬레이션 안내'}
          </button>
        </div>

        {/* 도움말 패널 */}
        {showHelp && (
          <div className="mb-2 p-3 bg-gray-800/80 rounded border border-gray-600 text-[12px] space-y-2">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="text-cyan-400 font-bold mb-1">시나리오 실행 (에뮬레이터)</div>
                <ul className="text-gray-400 space-y-0.5 list-disc ml-3">
                  <li>상단 GNB의 <span className="text-white">시나리오 재생 버튼(▶)</span>으로 실행</li>
                  <li>실제 센서값을 시간순으로 재생 (SSE 실시간 스트림)</li>
                  <li>모든 모드에서 동시에 센서 데이터가 갱신됨</li>
                  <li>이벤트/알람이 자동 발생하여 전체 흐름 체험</li>
                </ul>
              </div>
              <div className="flex-1">
                <div className="text-purple-400 font-bold mb-1">시뮬레이션 실행 (KETI 예측분석)</div>
                <ul className="text-gray-400 space-y-0.5 list-disc ml-3">
                  <li>이 페이지의 <span className="text-white">[▶ 시뮬레이션 실행]</span> 버튼으로 실행</li>
                  <li>KETI 엔진이 <b className="text-white">What-if</b> 예측분석 수행</li>
                  <li>대응안 A/B를 비교하여 최적 조치 결정 지원</li>
                  <li>3D에서 시간축에 따른 영향 확산/축소 시각화</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* 이벤트 연계 탭 — 이벤트 정보 표시 */}
        {tab === 'event' && (
          hasEvent ? (
            <div className="flex flex-wrap items-center gap-3 mb-2 text-[12px] p-2 bg-bg-tertiary rounded border border-gray-700">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  eventContext!.severity === 'EMERGENCY' ? 'bg-red-500/30 text-red-400' :
                  eventContext!.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                  eventContext!.severity === 'WARNING' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>{eventContext!.severity}</span>
                <span className="text-cyan-400 font-bold">{eventContext!.scenario_id}</span>
                <span className="text-gray-500">|</span>
                <span className="text-white">{eqName(eventContext!.trigger_equipment_id || '')}</span>
              </div>
              {eventContext!.affected_equipment_ids?.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">영향설비:</span>
                  {eventContext!.affected_equipment_ids.slice(0, 4).map(id => (
                    <span key={id} className="text-[11px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 rounded">{eqName(id)}</span>
                  ))}
                  {eventContext!.affected_equipment_ids.length > 4 && (
                    <span className="text-gray-500">+{eventContext!.affected_equipment_ids.length - 4}</span>
                  )}
                </div>
              )}
              <span className="text-[11px] text-gray-500 ml-auto">Phase: <span className="text-white">{eventContext!.current_phase}</span></span>
            </div>
          ) : (
            <div className="mb-2 p-3 bg-gray-800/60 rounded border border-dashed border-gray-600 text-[12px] text-gray-400">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-yellow-500">⚠</span>
                <span className="text-white font-medium">활성 이벤트가 없습니다</span>
              </div>
              <div className="text-gray-500 leading-relaxed">
                에뮬레이터에서 시나리오를 실행하면 이벤트가 자동 생성되어 연계됩니다.
                이벤트 없이 시뮬레이션을 실행하려면 <button onClick={() => setTab('manual')} className="text-cyan-400 hover:underline">[수동 실행]</button> 탭을 사용하세요.
              </div>
            </div>
          )
        )}

        {/* 수동 실행 탭 — 파라미터 입력 */}
        {tab === 'manual' && (
          <div className="flex flex-wrap gap-3 mb-2 text-[12px]">
            <label className="text-gray-400">시나리오
              <select value={manualParams.scenario_id}
                onChange={e => setManualParams(p => ({ ...p, scenario_id: e.target.value }))}
                className="ml-1 bg-bg-tertiary text-white px-2 py-0.5 rounded border border-gray-600 text-[12px]">
                {['SC-01','SC-02','SC-03','SC-04','SC-05','SC-06','SC-07','SC-08'].map(s =>
                  <option key={s} value={s}>{s}</option>
                )}
              </select>
            </label>
            <label className="text-gray-400">초기압력
              <input type="range" min={5} max={20} step={0.5} value={manualParams.initial_pressure}
                onChange={e => setManualParams(p => ({ ...p, initial_pressure: Number(e.target.value) }))}
                className="w-24 ml-1 accent-cyan-500" />
              <span className="text-white ml-1">{manualParams.initial_pressure}bar</span>
            </label>
            <label className="text-gray-400">온도편차
              <input type="range" min={1} max={15} value={manualParams.temp_deviation}
                onChange={e => setManualParams(p => ({ ...p, temp_deviation: Number(e.target.value) }))}
                className="w-20 ml-1 accent-cyan-500" />
              <span className="text-white ml-1">±{manualParams.temp_deviation}℃</span>
            </label>
            <label className="text-gray-400">유량변화
              <input type="range" min={-80} max={0} value={manualParams.flow_change}
                onChange={e => setManualParams(p => ({ ...p, flow_change: Number(e.target.value) }))}
                className="w-20 ml-1 accent-cyan-500" />
              <span className="text-white ml-1">{manualParams.flow_change}%</span>
            </label>
          </div>
        )}

        <div className="flex items-center gap-3 text-xs">
          {scenarioId ? (
            <span className="text-gray-400">시나리오: <b className="text-white">{scenarioId}</b></span>
          ) : (
            <span className="text-gray-500">시나리오 미선택</span>
          )}
          <span className="text-green-400">KETI 연결정상</span>
          {!simRunning ? (
            <button onClick={handleRun} disabled={loading || (tab === 'event' && !hasEvent)} className="bg-accent-green text-black px-4 py-1 rounded font-medium disabled:opacity-40">
              {loading ? '분석중...' : '▶ 시뮬레이션 실행'}
            </button>
          ) : (
            <>
              <button onClick={handleStop} className="bg-yellow-500 text-black px-3 py-1 rounded text-xs">⏸ 일시정지</button>
              <button onClick={handleReset} className="bg-accent-red text-white px-3 py-1 rounded text-xs">⏹ 중지</button>
            </>
          )}
          <button onClick={handleReset} className="text-gray-400 hover:text-white text-xs">↻ 초기화</button>
        </div>
      </div>

      {/* 2분할: 3D + 결과 */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* 3D 뷰어 + 타임라인 */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 bg-bg-primary relative">
            <CameraControlsOverlay controlRef={cameraRef} pageId="simulation" />
            <ThreeCanvas initialPosition={savedCamera?.position} initialTarget={savedCamera?.target}>
              <TestbedModel equipmentStates={equipmentStates} onEquipmentClick={handleEquipmentClick} />
              <EnvironmentScene />
              <EquipmentPOIs
                equipment={equipment}
                equipmentStates={equipmentStates}
                selectedId={cameraTarget}
                onSelect={handleEquipmentClick}
                sensorData={sensorData}
              />
              <CameraController targetEquipmentId={cameraTarget} />
              <CameraBookmarkInner pageId="simulation" controlRef={cameraRef} />
              {/* 가스 확산 시뮬레이션 — 시뮬레이션 실행 중 trigger 설비 위치에 표시 */}
              {simRunning && kgsResults.length > 0 && (() => {
                const triggerId = kgsResults[0]?.trigger_equipment_id;
                const origin = EQUIPMENT_POSITIONS[triggerId];
                if (!origin) return null;
                const totalMin = currentMaxTime;
                const gasProgress = appliedOption
                  ? Math.max(0, 1 - (simTime / totalMin) * 1.5)  // 대응안 적용: 점진적 축소
                  : Math.min(1, simTime / totalMin);
                return (
                  <GasDispersion
                    origin={origin}
                    maxRadius={60 + (kgsResults[0]?.impact_score || 70) * 0.5}
                    windDirection={45}
                    windSpeed={0.3}
                    progress={gasProgress}
                    gasType="h2"
                    visible={gasProgress > 0.01}
                  />
                );
              })()}
            </ThreeCanvas>
          </div>

          {/* 타임라인 스크러버 */}
          {kgsResults.length > 0 && (
            <div className="bg-bg-secondary border-t border-gray-700 px-4 py-2">
              <div className="flex items-center gap-3">
                <span className="text-[12px] text-gray-500 whitespace-nowrap">시뮬레이션 시간:</span>
                <div className="flex-1 relative">
                  <input
                    type="range" min={0} max={currentMaxTime} value={simTime}
                    onChange={(e) => setSimTime(Number(e.target.value))}
                    className="w-full h-1.5 accent-cyan-500"
                  />
                  {/* 타임라인 마커: KGS 영향 전파 시점 */}
                  <div className="relative w-full h-3 -mt-1">
                    {kgsResults.filter(r => r.predicted_after_sec != null).map((r, i) => {
                      const markerMin = r.predicted_after_sec / 60;
                      const pct = (markerMin / currentMaxTime) * 100;
                      if (pct > 100) return null;
                      return (
                        <div key={i} className="absolute top-0" style={{ left: `${pct}%` }} title={`${eqName(r.affected_equipment_id)} 영향 (${Math.floor(markerMin)}분)`}>
                          <div className="w-0.5 h-2 mx-auto" style={{ backgroundColor: r.color_2d || '#F59E0B' }} />
                          <div className="text-[9px] text-gray-500 -ml-3 whitespace-nowrap">{Math.floor(markerMin)}분</div>
                        </div>
                      );
                    })}
                    {appliedOption && (
                      <div className="absolute top-0" style={{ left: `100%` }}>
                        <div className="w-0.5 h-2 mx-auto bg-green-400" />
                        <div className="text-[9px] text-green-400 -ml-4 whitespace-nowrap">안정화</div>
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[13px] text-white font-mono w-20 text-right">{simTime}분 / {currentMaxTime}분</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {simRunning && (
                  <span className="text-[11px] text-cyan-400 animate-pulse">● 시뮬레이션 진행중</span>
                )}
                {appliedOption && (
                  <span className="text-[11px] text-green-400">Option {appliedOption} 적용됨 (안정화: {currentMaxTime}분)</span>
                )}
                {!simRunning && simTime > 0 && simTime >= currentMaxTime && (
                  <span className="text-[11px] text-yellow-400">시뮬레이션 완료</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 결과 패널 */}
        <div className="w-full lg:w-[420px] border-t lg:border-t-0 lg:border-l border-gray-700 p-3 overflow-y-auto max-h-[50vh] lg:max-h-none">
          {kgsResults.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs text-gray-400 mb-2 font-medium">KGS 위험영향 결과</h4>
              {kgsResults.map((r) => (
                <div key={r.analysis_id} className="text-[13px] mb-1.5 flex items-center gap-2 p-1.5 rounded bg-bg-tertiary">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color_2d || '#666' }} />
                  <span className="text-white font-medium">{eqName(r.affected_equipment_id)}</span>
                  <span className="text-gray-400">{r.impact_score}점</span>
                  <span className={`text-[9px] px-1 py-0.5 rounded ${
                    r.risk_level === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>{r.risk_level}</span>
                  {r.predicted_after_sec != null && (
                    <span className="text-gray-500 ml-auto">{Math.floor(r.predicted_after_sec / 60)}분후</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {ketiResult && (
            <>
              <h4 className="text-xs text-gray-400 mb-2 font-medium">KETI 대응안 비교</h4>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {/* Option A */}
                <div className={`p-3 rounded border transition-all ${
                  appliedOption === 'A'
                    ? 'border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500/30'
                    : 'border-gray-700 bg-bg-tertiary hover:border-gray-500'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] text-cyan-400 font-bold">대응안 A</span>
                    {ketiResult.option_a_risk && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${RISK_BADGE[ketiResult.option_a_risk]?.bg} ${RISK_BADGE[ketiResult.option_a_risk]?.text}`}>
                        {RISK_BADGE[ketiResult.option_a_risk]?.label}
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-white mb-2 leading-relaxed">{ketiResult.recommended_option_a}</div>

                  {/* 안정화 시간 비교 바 */}
                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                      <span>안정화 소요시간</span>
                      <span className="text-cyan-400 font-bold">{ketiResult.option_a_stabilization_min || ketiResult.expected_stabilization_min}분</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                      <div className="bg-cyan-500 h-1.5 rounded-full" style={{
                        width: `${Math.min(100, ((ketiResult.option_a_stabilization_min || ketiResult.expected_stabilization_min) / Math.max(ketiResult.option_a_stabilization_min || 1, ketiResult.option_b_stabilization_min || 1)) * 100)}%`
                      }} />
                    </div>
                  </div>

                  {ketiResult.option_a_detail && (
                    <div className="text-[11px] text-gray-500 mb-2 leading-relaxed border-t border-gray-700 pt-1.5">
                      {ketiResult.option_a_detail}
                    </div>
                  )}

                  <button onClick={() => handleApplyOption('A')}
                    className={`text-[12px] w-full py-1.5 rounded font-medium transition-all ${
                      appliedOption === 'A'
                        ? 'bg-cyan-500 text-black'
                        : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/40'
                    }`}>
                    {appliedOption === 'A' ? '✓ 적용됨' : '적용 ▶'}
                  </button>
                </div>

                {/* Option B */}
                <div className={`p-3 rounded border transition-all ${
                  appliedOption === 'B'
                    ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/30'
                    : 'border-gray-700 bg-bg-tertiary hover:border-gray-500'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] text-purple-400 font-bold">대응안 B</span>
                    {ketiResult.option_b_risk && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${RISK_BADGE[ketiResult.option_b_risk]?.bg} ${RISK_BADGE[ketiResult.option_b_risk]?.text}`}>
                        {RISK_BADGE[ketiResult.option_b_risk]?.label}
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-white mb-2 leading-relaxed">{ketiResult.recommended_option_b}</div>

                  {/* 안정화 시간 비교 바 */}
                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                      <span>안정화 소요시간</span>
                      <span className="text-purple-400 font-bold">{ketiResult.option_b_stabilization_min || ketiResult.expected_stabilization_min}분</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                      <div className="bg-purple-500 h-1.5 rounded-full" style={{
                        width: `${Math.min(100, ((ketiResult.option_b_stabilization_min || ketiResult.expected_stabilization_min) / Math.max(ketiResult.option_a_stabilization_min || 1, ketiResult.option_b_stabilization_min || 1)) * 100)}%`
                      }} />
                    </div>
                  </div>

                  {ketiResult.option_b_detail && (
                    <div className="text-[11px] text-gray-500 mb-2 leading-relaxed border-t border-gray-700 pt-1.5">
                      {ketiResult.option_b_detail}
                    </div>
                  )}

                  <button onClick={() => handleApplyOption('B')}
                    className={`text-[12px] w-full py-1.5 rounded font-medium transition-all ${
                      appliedOption === 'B'
                        ? 'bg-purple-500 text-white'
                        : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/40'
                    }`}>
                    {appliedOption === 'B' ? '✓ 적용됨' : '적용 ▶'}
                  </button>
                </div>
              </div>

              {/* 비교 요약 */}
              {(ketiResult.option_a_stabilization_min || ketiResult.option_b_stabilization_min) && (
                <div className="mb-3 p-2 bg-gray-800/60 rounded border border-gray-700">
                  <div className="text-[11px] text-gray-400 mb-1.5 font-medium">대응안 비교 요약</div>
                  <div className="grid grid-cols-3 gap-1 text-[11px]">
                    <div className="text-gray-500"></div>
                    <div className="text-cyan-400 font-medium text-center">A</div>
                    <div className="text-purple-400 font-medium text-center">B</div>

                    <div className="text-gray-500">안정화</div>
                    <div className="text-white text-center">{ketiResult.option_a_stabilization_min || '-'}분</div>
                    <div className="text-white text-center">{ketiResult.option_b_stabilization_min || '-'}분</div>

                    <div className="text-gray-500">위험도</div>
                    <div className={`text-center ${RISK_BADGE[ketiResult.option_a_risk]?.text || 'text-gray-400'}`}>
                      {RISK_BADGE[ketiResult.option_a_risk]?.label || '-'}
                    </div>
                    <div className={`text-center ${RISK_BADGE[ketiResult.option_b_risk]?.text || 'text-gray-400'}`}>
                      {RISK_BADGE[ketiResult.option_b_risk]?.label || '-'}
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3 bg-bg-tertiary rounded mb-4">
                <div className="text-[12px] text-gray-500 mb-1">시뮬레이션 요약</div>
                <div className="text-[13px] text-gray-300 leading-relaxed">{ketiResult.simulation_summary}</div>
              </div>

              <div className="flex gap-2">
                <button className="text-[12px] text-accent-blue hover:underline">[SOP 연계]</button>
                <button className="text-[12px] text-accent-blue hover:underline">[보고서에 반영]</button>
              </div>
            </>
          )}

          {kgsResults.length === 0 && !ketiResult && (
            <div className="text-gray-600 text-xs text-center mt-10 space-y-2">
              <div>[▶ 시뮬레이션 실행]을 눌러 KETI 예측분석을 시작하세요</div>
              <div className="text-gray-700 text-[11px]">
                시나리오 선택 후 실행하면 KGS 위험영향 + KETI 대응안이 표시됩니다
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
