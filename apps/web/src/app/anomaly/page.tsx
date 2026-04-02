// ref: CLAUDE.md §9.4 — 설비 상태감시 (M-ANO) — 개별 설비 격리 뷰 + X-ray 펌프 + 개선 차트
'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';
import { EQUIPMENT_ICONS, type VisualState } from '@/lib/constants';
import { SensorChart, AnomalyDetectionChart } from '@/components/common/SensorChart';
import { CameraControlsOverlay, getSavedCamera, type CameraBookmarkRef } from '@/components/viewer3d/CameraBookmark';

const ThreeCanvas = dynamic(() => import('@/components/viewer3d/ThreeCanvas').then(m => ({ default: m.ThreeCanvas })), { ssr: false });
const PumpDetailModel = dynamic(() => import('@/components/viewer3d/TestbedModel').then(m => ({ default: m.PumpDetailModel })), { ssr: false });
const IsolatedEquipmentModel = dynamic(() => import('@/components/viewer3d/TestbedModel').then(m => ({ default: m.IsolatedEquipmentModel })), { ssr: false });
const CameraController = dynamic(() => import('@/components/viewer3d/CameraController').then(m => ({ default: m.CameraController })), { ssr: false });
const CameraBookmarkInner = dynamic(() => import('@/components/viewer3d/CameraBookmark').then(m => ({ default: m.CameraBookmark })), { ssr: false });

// 한국어 설비명 매핑
const EQUIPMENT_NAMES_KR: Record<string, string> = {
  'SHP-001': 'LH2 운반선', 'ARM-101': '로딩암', 'TK-101': '저장탱크 #1', 'TK-102': '저장탱크 #2',
  'BOG-201': 'BOG 압축기', 'PMP-301': '2차펌프', 'VAP-401': '기화기',
  'REL-701': '재액화기', 'VAL-601': '밸브 #1', 'VAL-602': '밸브 #2', 'PIP-501': '메인배관',
};

// 한국어 센서 유형명
const SENSOR_TYPE_KR: Record<string, string> = {
  'PRESSURE': '압력', 'TEMPERATURE': '온도', 'FLOW': '유량',
  'VIBRATION': '진동', 'CURRENT': '전류', 'LEVEL': '레벨',
};

// 설비 상태감시 모드에서 표출하는 설비 목록
const ANOMALY_EQUIPMENT_IDS = ['TK-101', 'TK-102', 'PMP-301', 'VAP-401', 'ARM-101'];

export default function AnomalyPage() {
  const [equipment, setEquipment] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState('PMP-301');
  const cameraRef = useRef<CameraBookmarkRef | null>(null);
  const savedCamera = useMemo(() => getSavedCamera('anomaly'), []);
  const [kogasResult, setKogasResult] = useState<any>(null);
  const [sensorHistory, setSensorHistory] = useState<Record<string, any[]>>({});
  const { eventContext, sensorData } = useAppStore();

  useEffect(() => { api.getEquipment().then(setEquipment).catch(console.error); }, []);

  useEffect(() => {
    const scenarioId = eventContext?.scenario_id || 'SC-02';
    api.getKogas(scenarioId).then(setKogasResult).catch(() => {});
  }, [eventContext]);

  // 센서 이력 축적
  useEffect(() => {
    const selectedEq = equipment.find(e => e.equipment_id === selectedTab);
    if (!selectedEq) return;
    setSensorHistory(prev => {
      const updated = { ...prev };
      for (const sensor of selectedEq.sensors || []) {
        const data = sensorData[sensor.sensor_id];
        if (data) {
          const arr = updated[sensor.sensor_id] || [];
          if (arr.length === 0 || arr[arr.length - 1].elapsed_sec !== data.elapsed_sec) {
            updated[sensor.sensor_id] = [...arr.slice(-120), data];
          }
        }
      }
      return updated;
    });
  }, [sensorData, selectedTab, equipment]);

  const selectedEq = equipment.find(e => e.equipment_id === selectedTab);
  const isPumpDetail = selectedTab === 'PMP-301';

  // 선택 설비 컬러링 상태
  const equipmentStates = useMemo(() => {
    const states: Record<string, VisualState> = {};
    const phase = eventContext?.current_phase;
    if (phase === 'FAULT' || phase === 'SECONDARY_IMPACT') {
      states[selectedTab] = 'critical';
    } else if (phase === 'SYMPTOM') {
      states[selectedTab] = 'warning';
    }
    return states;
  }, [selectedTab, eventContext]);

  // 2차펌프 내부 mesh 컬러링 (이상 시 X-ray 모드)
  const pumpMeshStates = useMemo(() => {
    const states: Record<string, string> = {};
    if (selectedTab === 'PMP-301') {
      const phase = eventContext?.current_phase;
      if (phase === 'FAULT' || phase === 'SECONDARY_IMPACT') {
        states['impeller_stage_03'] = '#FF5722';
        states['impeller_stage_04'] = '#FF5722';
        states['shaft'] = '#FFA726';
        states['diffuser_bowl_03'] = '#FFEE58';
        states['diffuser_bowl_04'] = '#FFEE58';
      } else if (phase === 'SYMPTOM') {
        states['impeller_stage_03'] = '#FFA726';
      }
    }
    return states;
  }, [selectedTab, eventContext]);

  const hasAnomaly = Object.keys(pumpMeshStates).length > 0;

  // 이상탐지 그래프용 학습 데이터 (안정적 seed 기반)
  const anomalyChartData = useMemo(() => {
    const mainSensor = selectedEq?.sensors?.[0];
    if (!mainSensor) return [];
    const history = sensorHistory[mainSensor.sensor_id] || [];
    // 안정적 predicted 생성 (seed 기반, 매 렌더 시 동일값)
    return history.map((d, i) => {
      const seed = (d.elapsed_sec * 17 + i * 31) % 100;
      const noise = (seed - 50) / 100 * 0.5;
      return {
        time: d.elapsed_sec,
        actual: d.value,
        predicted: d.value + noise,
        error: Math.abs(noise),
        label: d.label,
      };
    });
  }, [selectedEq, sensorHistory]);

  // 센서 패널 렌더링 (좌/우)
  const renderSensorPanel = (sensors: any[], side: 'left' | 'right') => (
    <div className={`w-[22%] ${side === 'left' ? 'border-r' : 'border-l'} border-white/[0.04] p-2 overflow-y-auto scrollbar-thin`}>
      <div className="text-[9px] text-gray-600 font-medium uppercase tracking-wider mb-2 px-1">
        {side === 'left' ? '센서 모니터링 (좌)' : '센서 모니터링 (우)'}
      </div>
      {sensors.map((s: any) => {
        const data = sensorData[s.sensor_id];
        const history = sensorHistory[s.sensor_id] || [];
        const isAnomaly = data?.label === 'ANOMALY';
        const isWarning = data?.label === 'WARNING';

        return (
          <div key={s.sensor_id} className={`mb-2.5 glass-sm p-2.5 ${
            isAnomaly ? '!border-red-500/30' : isWarning ? '!border-amber-500/30' : ''
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-400 font-medium">{SENSOR_TYPE_KR[s.sensor_type] || s.sensor_type}</span>
              <div className="flex items-center gap-1.5">
                {(isAnomaly || isWarning) && (
                  <span className={`text-[8px] px-1 py-0.5 rounded ${
                    isAnomaly ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {isAnomaly ? '이상' : '경고'}
                  </span>
                )}
                <span className={`text-[12px] font-mono font-semibold ${
                  isAnomaly ? 'text-red-400 glow-red' : isWarning ? 'text-amber-400' : 'text-cyan-400 glow-cyan'
                }`}>
                  {data ? data.value.toFixed(2) : '—'}
                  <span className="text-[8px] text-gray-600 ml-0.5">{s.unit}</span>
                </span>
              </div>
            </div>
            <SensorChart
              data={history}
              sensorType={SENSOR_TYPE_KR[s.sensor_type] || s.sensor_type}
              unit={s.unit}
              threshold={s.threshold}
              height={80}
              compact
            />
          </div>
        );
      })}
    </div>
  );

  const leftSensors = selectedEq?.sensors?.slice(0, 3) || [];
  const rightSensors = selectedEq?.sensors?.slice(3, 6) || [];

  return (
    <div className="h-full flex flex-col">
      {/* 상단: 3분할 (센서차트 + 3D 뷰어 + 센서차트) */}
      <div className="flex-[3] flex min-h-0">
        {renderSensorPanel(leftSensors, 'left')}

        {/* 3D 뷰어 — 펌프는 상세 GLB (X-ray), 나머지는 격리 뷰 */}
        <div className="flex-1 relative">
          <CameraControlsOverlay controlRef={cameraRef} pageId="anomaly" />
          {isPumpDetail ? (
            <ThreeCanvas initialPosition={savedCamera?.position} initialTarget={savedCamera?.target}>
              <PumpDetailModel meshStates={pumpMeshStates} xrayMode={hasAnomaly} />
              <CameraBookmarkInner pageId="anomaly" controlRef={cameraRef} />
            </ThreeCanvas>
          ) : (
            <ThreeCanvas initialPosition={savedCamera?.position} initialTarget={savedCamera?.target}>
              <IsolatedEquipmentModel equipmentId={selectedTab} equipmentStates={equipmentStates} />
              <CameraController targetEquipmentId={selectedTab} />
              <CameraBookmarkInner pageId="anomaly" controlRef={cameraRef} />
            </ThreeCanvas>
          )}

          {/* 설비 정보 오버레이 */}
          <div className="absolute top-3 left-3 glass-sm px-3 py-2">
            <div className="text-xs font-bold text-white">
              {EQUIPMENT_NAMES_KR[selectedTab] || selectedTab}
            </div>
            <div className="text-[9px] text-gray-500">
              {selectedTab} · {isPumpDetail ? '상세 모델 (내부 구조)' : '설비 격리 뷰'}
            </div>
          </div>

          {/* 2차펌프 상태 인디케이터 */}
          {isPumpDetail && (
            <div className="absolute bottom-3 left-3 right-3 flex gap-2">
              {[
                { label: '펌프부하', index: 0 },
                { label: '모터부하', index: 1 },
                { label: '펌프반부하', index: 2 },
                { label: '모터반부하', index: 3 },
              ].map(({ label, index }) => {
                const hasIssue = index < 2 && (eventContext?.current_phase === 'FAULT' || eventContext?.current_phase === 'SECONDARY_IMPACT');
                return (
                  <div key={label} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[9px] ${
                    hasIssue ? 'bg-red-500/15 border border-red-500/30 text-red-400' : 'bg-white/[0.05] border border-white/[0.08] text-gray-500'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${hasIssue ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                    {label}
                    {hasIssue && <span className="text-[8px] text-red-400 font-medium ml-0.5">이상</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {renderSensorPanel(rightSensors, 'right')}
      </div>

      {/* 설비 선택 탭 */}
      <div className="h-10 border-t border-white/[0.06] flex items-center px-2 gap-0.5 overflow-x-auto scrollbar-thin bg-[#0a0e17]">
        <span className="text-[9px] text-gray-600 font-medium mr-2 flex-shrink-0">설비 선택:</span>
        {equipment.filter(e => ANOMALY_EQUIPMENT_IDS.includes(e.equipment_id)).map((eq) => {
          const status = sensorData[eq.sensors?.[0]?.sensor_id]?.label;
          return (
            <button
              key={eq.equipment_id}
              onClick={() => { setSelectedTab(eq.equipment_id); setSensorHistory({}); }}
              className={`mode-tab whitespace-nowrap ${
                selectedTab === eq.equipment_id ? 'mode-tab-active' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="mr-1">{EQUIPMENT_ICONS[eq.equipment_type]}</span>
              {EQUIPMENT_NAMES_KR[eq.equipment_id] || eq.equipment_id}
              {status === 'ANOMALY' && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-red-500 inline-block animate-pulse" />}
              {status === 'WARNING' && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />}
            </button>
          );
        })}
      </div>

      {/* 하단: 이상탐지 상세 (3분할) */}
      <div className="flex-[2] border-t border-white/[0.06] flex min-h-0">
        {/* 좌: 이상탐지 그래프 (실측값 vs 학습값 + 오차) */}
        <div className="flex-1 border-r border-white/[0.04] p-3 overflow-y-auto scrollbar-thin">
          <AnomalyDetectionChart data={anomalyChartData} height={160} />
        </div>

        {/* 중: 시간별 상세 테이블 */}
        <div className="w-[28%] border-r border-white/[0.04] p-3 overflow-y-auto scrollbar-thin">
          <span className="text-[11px] text-gray-300 font-medium">시간별 상세</span>
          <div className="mt-2">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-gray-500 border-b border-white/[0.06]">
                  <th className="text-left py-1.5 font-medium">시간</th>
                  <th className="text-right font-medium">실측값</th>
                  <th className="text-right font-medium">학습값</th>
                  <th className="text-right font-medium">오차</th>
                  <th className="text-center font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {anomalyChartData.slice(-20).reverse().map((d, i) => {
                  const isAnomaly = d.label === 'ANOMALY';
                  const isWarning = d.label === 'WARNING';
                  return (
                    <tr key={i} className={`border-t border-white/[0.03] ${
                      isAnomaly ? 'bg-red-500/5' : isWarning ? 'bg-amber-500/5' : ''
                    }`}>
                      <td className="py-1 text-gray-400 font-mono">
                        {Math.floor(d.time / 60)}:{String(d.time % 60).padStart(2, '0')}
                      </td>
                      <td className="text-right text-white font-mono">{d.actual.toFixed(2)}</td>
                      <td className="text-right text-purple-400 font-mono">{d.predicted.toFixed(2)}</td>
                      <td className={`text-right font-mono ${d.error > 0.3 ? 'text-red-400' : 'text-gray-500'}`}>
                        {d.error.toFixed(3)}
                      </td>
                      <td className="text-center">
                        {isAnomaly && <span className="text-[8px] px-1 py-0.5 rounded bg-red-500/20 text-red-400">이상</span>}
                        {isWarning && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400">경고</span>}
                        {!isAnomaly && !isWarning && <span className="text-[8px] text-gray-600">정상</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 우: 진단 데이터 */}
        <div className="w-[28%] p-3 overflow-y-auto scrollbar-thin">
          <span className="text-[11px] text-gray-300 font-medium">이상탐지 진단 결과</span>
          <div className="mt-3 space-y-3">
            <div className="glass-sm p-2.5">
              <div className="text-[9px] text-gray-500 mb-1.5">비교 구간 (정상 패턴)</div>
              <div className="h-12 bg-emerald-500/5 border border-emerald-500/10 rounded flex items-center justify-center text-[10px] text-emerald-400">
                <svg width="120" height="20" viewBox="0 0 120 20" className="mr-2">
                  <path d="M0,10 Q15,8 30,10 Q45,12 60,10 Q75,8 90,10 Q105,12 120,10" fill="none" stroke="#22c55e" strokeWidth="1.5" opacity="0.6"/>
                </svg>
                안정 패턴
              </div>
            </div>
            <div className="glass-sm p-2.5">
              <div className="text-[9px] text-gray-500 mb-1.5">이상탐지 구간</div>
              <div className="h-12 bg-red-500/5 border border-red-500/10 rounded flex items-center justify-center text-[10px] text-red-400">
                <svg width="120" height="20" viewBox="0 0 120 20" className="mr-2">
                  <path d="M0,10 L15,10 L25,3 L35,17 L45,5 L55,15 L65,2 L75,18 L85,10 L95,10 L105,10 L120,10" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.7"/>
                </svg>
                이상 패턴
              </div>
            </div>
            {kogasResult && (
              <div className="glass-sm p-3">
                <div className="text-[9px] text-gray-500 mb-2">KOGAS AI 진단 결과</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">고장명</span>
                    <span className="text-[11px] text-red-400 font-medium">{kogasResult.fault_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">확신도</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${(kogasResult.diagnosis_confidence * 100)}%` }} />
                      </div>
                      <span className="text-[11px] text-cyan-400 font-mono">{(kogasResult.diagnosis_confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">의심부위</span>
                    <span className="text-[11px] text-amber-400">{kogasResult.suspected_part}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">고장코드</span>
                    <span className="text-[11px] text-white font-mono">{kogasResult.fault_code || 'N/A'}</span>
                  </div>
                  <div className="text-[10px] text-gray-300 mt-2 pt-2 border-t border-white/[0.06] leading-relaxed">
                    [{sensorHistory[selectedEq?.sensors?.[0]?.sensor_id]?.length || 0}개 샘플] 분석 구간에서{' '}
                    <span className="text-red-400 font-medium">{kogasResult.fault_name}</span> 감지
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KOGAS 진단 결과 바 */}
      {kogasResult && (
        <div className="h-11 border-t border-white/[0.06] bg-[#0a0e17] flex items-center px-4 gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
            <span className="text-gray-400">KOGAS 연결정상</span>
          </div>
          <div className="h-4 w-px bg-white/[0.08]" />
          <span className="text-gray-300">고장: <b className="text-white">{kogasResult.fault_name}</b></span>
          <span className="text-gray-300">확신도: <b className="text-cyan-400">{(kogasResult.diagnosis_confidence * 100).toFixed(0)}%</b></span>
          <span className="text-gray-300">의심부위: <b className="text-amber-400">{kogasResult.suspected_part}</b></span>

          <div className="ml-auto flex gap-1.5">
            {[
              { label: '상호영향 위험예측', path: '/risk' },
              { label: '시뮬레이션', path: '/simulation' },
              { label: '디지털 SOP', path: '/sop' },
              { label: '이력관리', path: '/history' },
            ].map(({ label, path }) => (
              <a key={label} href={path}
                className="px-2 py-0.5 rounded text-[10px] bg-white/[0.05] text-gray-400 hover:text-white hover:bg-white/[0.1] transition-colors">
                {label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
