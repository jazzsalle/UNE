// ref: CLAUDE.md §9.5 — 시뮬레이션/의사결정지원 (M-SIM) 3D 통합
'use client';
import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';
// CameraController now uses equipment IDs directly
import type { VisualState } from '@/lib/constants';

const ThreeCanvas = dynamic(() => import('@/components/viewer3d/ThreeCanvas').then(m => ({ default: m.ThreeCanvas })), { ssr: false });
const TestbedModel = dynamic(() => import('@/components/viewer3d/TestbedModel').then(m => ({ default: m.TestbedModel })), { ssr: false });
const CameraController = dynamic(() => import('@/components/viewer3d/CameraController').then(m => ({ default: m.CameraController })), { ssr: false });

export default function SimulationPage() {
  const { eventContext, setSelectedEquipment } = useAppStore();
  const [kgsResults, setKgsResults] = useState<any[]>([]);
  const [ketiResult, setKetiResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'event' | 'manual'>('event');
  const [simTime, setSimTime] = useState(0);
  const [simRunning, setSimRunning] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<string | null>(null);
  const [appliedOption, setAppliedOption] = useState<'A' | 'B' | null>(null);

  // 수동 실행 파라미터
  const [manualParams, setManualParams] = useState({
    scenario_id: 'SC-01', trigger_equipment: 'BOG-201',
    initial_pressure: 12.5, duration_hr: 2, temp_deviation: 5, flow_change: -40,
  });

  const scenarioId = tab === 'event' ? (eventContext?.scenario_id || 'SC-01') : manualParams.scenario_id;

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

  // 시간축 기반 3D 컬러링
  const equipmentStates = useMemo(() => {
    const states: Record<string, VisualState> = {};
    if (appliedOption) {
      // 대응안 적용 후: 점진적 정상화
      for (const r of kgsResults) {
        states[r.affected_equipment_id] = simTime > 30 ? 'normal' : 'warning';
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
  }, [kgsResults, simTime, appliedOption]);

  const handleEquipmentClick = (id: string) => {
    setSelectedEquipment(id);
    setCameraTarget(id);
  };

  const progress = ketiResult?.expected_stabilization_min ? (simTime / ketiResult.expected_stabilization_min) * 100 : 0;

  return (
    <div className="h-full flex flex-col">
      {/* 탭 + 입력 */}
      <div className="bg-bg-secondary border-b border-gray-700 px-4 py-2">
        <div className="flex gap-2 mb-2">
          <button onClick={() => setTab('event')} className={`text-xs px-3 py-1 rounded ${tab === 'event' ? 'bg-accent-blue text-white' : 'text-gray-400'}`}>이벤트 연계</button>
          <button onClick={() => setTab('manual')} className={`text-xs px-3 py-1 rounded ${tab === 'manual' ? 'bg-accent-blue text-white' : 'text-gray-400'}`}>수동 실행</button>
        </div>

        {tab === 'manual' && (
          <div className="flex gap-3 mb-2 text-[10px]">
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
          <span className="text-gray-400">시나리오: <b className="text-white">{scenarioId}</b></span>
          <span className="text-green-400">🟢 KETI 연결정상</span>
          {!simRunning ? (
            <button onClick={handleRun} disabled={loading} className="bg-accent-green text-black px-4 py-1 rounded font-medium">
              {loading ? '실행중...' : '▶ 시뮬레이션 실행'}
            </button>
          ) : (
            <>
              <button onClick={handleStop} className="bg-yellow-500 text-black px-3 py-1 rounded text-xs">⏸ 일시정지</button>
              <button onClick={handleReset} className="bg-accent-red text-white px-3 py-1 rounded text-xs">⏹ 중지</button>
            </>
          )}
          <button onClick={handleReset} className="text-gray-400 hover:text-white text-xs">↻ 초기화</button>

          {simRunning && (
            <div className="flex-1 flex items-center gap-2 ml-4">
              <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                <div className="bg-accent-cyan h-1.5 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
              </div>
              <span className="text-gray-400 text-[10px]">{simTime}분/{ketiResult?.expected_stabilization_min || '?'}분</span>
            </div>
          )}
        </div>
      </div>

      {/* 2분할: 3D + 결과 */}
      <div className="flex-1 flex min-h-0">
        {/* 3D 뷰어 + 타임라인 */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 bg-bg-primary">
            <ThreeCanvas>
              <TestbedModel equipmentStates={equipmentStates} onEquipmentClick={handleEquipmentClick} />
              <CameraController targetEquipmentId={cameraTarget} />
            </ThreeCanvas>
          </div>

          {/* 타임라인 스크러버 */}
          {kgsResults.length > 0 && (
            <div className="h-12 bg-bg-secondary border-t border-gray-700 flex items-center px-4 gap-3">
              <span className="text-[10px] text-gray-500">시뮬레이션 시간:</span>
              <input
                type="range" min={0} max={ketiResult?.expected_stabilization_min || 60} value={simTime}
                onChange={(e) => setSimTime(Number(e.target.value))}
                className="flex-1 h-1 accent-cyan-500"
              />
              <span className="text-[10px] text-gray-400 font-mono w-16">{simTime}분</span>
              {appliedOption && (
                <span className="text-[10px] text-green-400">Option {appliedOption} 적용됨</span>
              )}
            </div>
          )}
        </div>

        {/* 결과 패널 */}
        <div className="w-[400px] border-l border-gray-700 p-3 overflow-y-auto">
          {kgsResults.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs text-gray-400 mb-2 font-medium">KGS 위험영향 결과</h4>
              {kgsResults.map((r) => (
                <div key={r.analysis_id} className="text-[11px] mb-1.5 flex items-center gap-2 p-1.5 rounded bg-bg-tertiary">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color_2d || '#666' }} />
                  <span className="text-white font-medium">{r.affected_equipment_id}</span>
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
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className={`p-3 rounded border transition-colors cursor-pointer ${
                  appliedOption === 'A' ? 'border-green-500 bg-green-500/10' : 'border-gray-700 bg-bg-tertiary hover:border-gray-500'
                }`} onClick={() => setAppliedOption('A')}>
                  <div className="text-[10px] text-gray-500 mb-1">Option A</div>
                  <div className="text-[11px] text-white mb-2">{ketiResult.recommended_option_a}</div>
                  <button onClick={(e) => { e.stopPropagation(); setAppliedOption('A'); }}
                    className="text-[10px] bg-accent-blue text-white px-2 py-0.5 rounded w-full">적용 ▶</button>
                </div>
                <div className={`p-3 rounded border transition-colors cursor-pointer ${
                  appliedOption === 'B' ? 'border-green-500 bg-green-500/10' : 'border-gray-700 bg-bg-tertiary hover:border-gray-500'
                }`} onClick={() => setAppliedOption('B')}>
                  <div className="text-[10px] text-gray-500 mb-1">Option B</div>
                  <div className="text-[11px] text-white mb-2">{ketiResult.recommended_option_b}</div>
                  <button onClick={(e) => { e.stopPropagation(); setAppliedOption('B'); }}
                    className="text-[10px] bg-accent-blue text-white px-2 py-0.5 rounded w-full">적용 ▶</button>
                </div>
              </div>

              <div className="p-3 bg-bg-tertiary rounded mb-4">
                <div className="text-[10px] text-gray-500 mb-1">시뮬레이션 요약</div>
                <div className="text-[11px] text-gray-300">{ketiResult.simulation_summary}</div>
                {ketiResult.expected_stabilization_min && (
                  <div className="text-[10px] text-accent-cyan mt-1">예상 안정화: {ketiResult.expected_stabilization_min}분</div>
                )}
              </div>

              <div className="flex gap-2">
                <button className="text-[10px] text-accent-blue hover:underline">[SOP 연계]</button>
                <button className="text-[10px] text-accent-blue hover:underline">[보고서에 반영]</button>
              </div>
            </>
          )}

          {kgsResults.length === 0 && !ketiResult && (
            <div className="text-gray-600 text-xs text-center mt-10">
              [▶ 시뮬레이션 실행]을 눌러 시작하세요
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
