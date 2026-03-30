// ref: CLAUDE.md §9.4 — 이상탐지 (M-ANO) 세련된 디자인 + 하단 완성
'use client';
import { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';
import { EQUIPMENT_ICONS } from '@/lib/constants';
import { SensorChart } from '@/components/common/SensorChart';

const ThreeCanvas = dynamic(() => import('@/components/viewer3d/ThreeCanvas').then(m => ({ default: m.ThreeCanvas })), { ssr: false });
const PumpDetailModel = dynamic(() => import('@/components/viewer3d/TestbedModel').then(m => ({ default: m.PumpDetailModel })), { ssr: false });

export default function AnomalyPage() {
  const [equipment, setEquipment] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState('PMP-301');
  const [kogasResult, setKogasResult] = useState<any>(null);
  const [sensorHistory, setSensorHistory] = useState<Record<string, any[]>>({});
  const { eventContext, sensorData } = useAppStore();

  useEffect(() => { api.getEquipment().then(setEquipment).catch(console.error); }, []);

  useEffect(() => {
    const scenarioId = eventContext?.scenario_id || 'SC-02';
    api.getKogas(scenarioId).then(setKogasResult).catch(() => {});
  }, [eventContext]);

  // Accumulate sensor history
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

  const pumpMeshStates = useMemo(() => {
    const states: Record<string, string> = {};
    if (selectedTab === 'PMP-301') {
      const phase = eventContext?.current_phase;
      if (phase === 'FAULT' || phase === 'SECONDARY_IMPACT') {
        states['impeller_stage_03'] = '#FF5722';
        states['impeller_stage_04'] = '#FF5722';
        states['shaft'] = '#FFA726';
      } else if (phase === 'SYMPTOM') {
        states['impeller_stage_03'] = '#FFA726';
      }
    }
    return states;
  }, [selectedTab, eventContext]);

  // Generate mock learning data for anomaly detection chart
  const anomalyChartData = useMemo(() => {
    const mainSensor = selectedEq?.sensors?.[0];
    if (!mainSensor) return [];
    const history = sensorHistory[mainSensor.sensor_id] || [];
    return history.map((d, i) => ({
      time: i,
      actual: d.value,
      predicted: d.value + (Math.random() - 0.5) * 0.5,
      error: Math.abs((Math.random() - 0.5) * 0.5),
      label: d.label,
    }));
  }, [selectedEq, sensorHistory]);

  const renderSensorPanel = (sensors: any[], side: 'left' | 'right') => (
    <div className="w-[22%] border-r border-white/[0.04] p-2 overflow-y-auto scrollbar-thin">
      {sensors.map((s: any) => {
        const data = sensorData[s.sensor_id];
        const history = sensorHistory[s.sensor_id] || [];
        const isAnomaly = data?.label === 'ANOMALY';
        const isWarning = data?.label === 'WARNING';

        return (
          <div key={s.sensor_id} className={`mb-2 glass-sm p-2 ${
            isAnomaly ? '!border-red-500/30' : isWarning ? '!border-amber-500/30' : ''
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-500">{s.sensor_type}</span>
              <span className={`text-[12px] font-mono font-semibold ${
                isAnomaly ? 'text-red-400 glow-red' : isWarning ? 'text-amber-400' : 'text-cyan-400 glow-cyan'
              }`}>
                {data ? data.value.toFixed(2) : '—'}
                <span className="text-[8px] text-gray-600 ml-0.5">{s.unit}</span>
              </span>
            </div>
            <SensorChart data={history} sensorType={s.sensor_type} unit={s.unit} threshold={s.threshold} height={60} compact />
          </div>
        );
      })}
    </div>
  );

  const leftSensors = selectedEq?.sensors?.slice(0, 3) || [];
  const rightSensors = selectedEq?.sensors?.slice(3, 6) || [];

  return (
    <div className="h-full flex flex-col">
      {/* 상단: 3분할 */}
      <div className="flex-[3] flex min-h-0">
        {renderSensorPanel(leftSensors, 'left')}

        {/* 3D 뷰어 */}
        <div className="flex-1 relative">
          <ThreeCanvas>
            <PumpDetailModel meshStates={pumpMeshStates} />
          </ThreeCanvas>

          {/* 센서 고장 인디케이터 오버레이 */}
          <div className="absolute bottom-3 left-3 right-3 flex gap-2">
            {['펌프부하', '모터부하', '펌프반부하', '모터반부하'].map((label, i) => {
              const hasIssue = i < 2 && (eventContext?.current_phase === 'FAULT');
              return (
                <div key={label} className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] ${
                  hasIssue ? 'bg-red-500/15 border border-red-500/30 text-red-400' : 'bg-white/[0.05] border border-white/[0.08] text-gray-500'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${hasIssue ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                  {label}
                </div>
              );
            })}
          </div>
        </div>

        {renderSensorPanel(rightSensors, 'right')}
      </div>

      {/* 설비 탭 */}
      <div className="h-10 border-t border-white/[0.06] flex items-center px-2 gap-0.5 overflow-x-auto scrollbar-thin bg-[#0a0e17]">
        {equipment.filter(e => e.is_core).map((eq) => {
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
              {eq.equipment_id}
              {status === 'ANOMALY' && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-red-500 inline-block animate-pulse" />}
            </button>
          );
        })}
      </div>

      {/* 하단: 이상탐지 상세 (3분할) */}
      <div className="flex-[2] border-t border-white/[0.06] flex min-h-0">
        {/* 좌: 이상탐지 그래프 */}
        <div className="flex-1 border-r border-white/[0.04] p-3 overflow-y-auto scrollbar-thin">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-gray-500 font-medium">이상탐지 그래프 (실측 vs 학습)</span>
            <div className="flex gap-3 text-[9px]">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-cyan-400 inline-block rounded" />실측값</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-400 inline-block rounded" />학습값</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-400/50 inline-block rounded" />오차</span>
            </div>
          </div>
          {anomalyChartData.length > 0 ? (
            <div className="bg-white/[0.02] rounded-lg p-2 h-[calc(100%-30px)]">
              <SensorChart
                data={anomalyChartData.map(d => ({ elapsed_sec: d.time, value: d.actual, label: d.label }))}
                sensorType="실측 vs 학습"
                unit=""
                height={120}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600 text-[11px]">에뮬레이터 실행 시 데이터 표시</div>
          )}
        </div>

        {/* 중: 상세 테이블 */}
        <div className="w-[30%] border-r border-white/[0.04] p-3 overflow-y-auto scrollbar-thin">
          <span className="text-[10px] text-gray-500 font-medium">시간별 상세</span>
          <div className="mt-2">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-gray-600">
                  <th className="text-left py-1">시간</th>
                  <th className="text-right">기준값</th>
                  <th className="text-right">학습값</th>
                  <th className="text-right">오차</th>
                </tr>
              </thead>
              <tbody>
                {anomalyChartData.slice(-15).reverse().map((d, i) => (
                  <tr key={i} className={`border-t border-white/[0.03] ${d.label === 'ANOMALY' ? 'bg-red-500/5' : ''}`}>
                    <td className="py-1 text-gray-400">{d.time}s</td>
                    <td className="text-right text-white font-mono">{d.actual.toFixed(2)}</td>
                    <td className="text-right text-purple-400 font-mono">{d.predicted.toFixed(2)}</td>
                    <td className={`text-right font-mono ${d.error > 0.3 ? 'text-red-400' : 'text-gray-500'}`}>
                      {d.error.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 우: 진단 데이터 */}
        <div className="w-[30%] p-3 overflow-y-auto scrollbar-thin">
          <span className="text-[10px] text-gray-500 font-medium">이상탐지 진단 결과</span>
          <div className="mt-3 space-y-3">
            <div className="glass-sm p-2.5">
              <div className="text-[9px] text-gray-500 mb-1">비교 구간 (정상 패턴)</div>
              <div className="h-10 bg-emerald-500/5 border border-emerald-500/10 rounded flex items-center justify-center text-[10px] text-emerald-400">
                ━━━━━━━ 안정 패턴 ━━━━━━━
              </div>
            </div>
            <div className="glass-sm p-2.5">
              <div className="text-[9px] text-gray-500 mb-1">이상탐지 구간</div>
              <div className="h-10 bg-red-500/5 border border-red-500/10 rounded flex items-center justify-center text-[10px] text-red-400">
                ━━━/\━━━/\━━ 이상 패턴 ━━
              </div>
            </div>
            {kogasResult && (
              <div className="glass-sm p-2.5">
                <div className="text-[9px] text-gray-500 mb-2">AI 진단 결과</div>
                <div className="text-[11px] text-white leading-relaxed">
                  [{sensorHistory[selectedEq?.sensors?.[0]?.sensor_id]?.length || 0}개 샘플] 구간에서{' '}
                  <span className="text-red-400 font-medium">{kogasResult.fault_name}</span> 감지.{' '}
                  확신도 <span className="text-cyan-400 font-mono">{(kogasResult.diagnosis_confidence * 100).toFixed(0)}%</span>
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
            <span className="text-gray-400">KOGAS</span>
          </div>
          <div className="h-4 w-px bg-white/[0.08]" />
          <span className="text-gray-300">고장: <b className="text-white">{kogasResult.fault_name}</b></span>
          <span className="text-gray-300">확신도: <b className="text-cyan-400">{(kogasResult.diagnosis_confidence * 100).toFixed(0)}%</b></span>
          <span className="text-gray-300">의심부위: <b className="text-amber-400">{kogasResult.suspected_part}</b></span>

          <div className="ml-auto flex gap-1.5">
            {['위험예측', '시뮬레이션', 'SOP', '이력조회'].map(l => (
              <a key={l} href={`/${l === '위험예측' ? 'risk' : l === '시뮬레이션' ? 'simulation' : l === 'SOP' ? 'sop' : 'history'}`}
                className="px-2 py-0.5 rounded text-[10px] bg-white/[0.05] text-gray-400 hover:text-white hover:bg-white/[0.1] transition-colors">
                {l}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
