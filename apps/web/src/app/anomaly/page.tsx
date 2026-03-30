// ref: CLAUDE.md §9.4 — 이상탐지 (M-ANO)
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

  useEffect(() => {
    api.getEquipment().then(setEquipment).catch(console.error);
  }, []);

  useEffect(() => {
    const scenarioId = eventContext?.scenario_id || 'SC-02';
    api.getKogas(scenarioId).then(setKogasResult).catch(() => {});
  }, [eventContext]);

  // Accumulate sensor history from SSE
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
            updated[sensor.sensor_id] = [...arr.slice(-60), data];
          }
        }
      }
      return updated;
    });
  }, [sensorData, selectedTab, equipment]);

  const selectedEq = equipment.find((e) => e.equipment_id === selectedTab);

  // Pump mesh coloring states for M-ANO
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

  const renderSensorPanel = (sensors: any[], label: string) => (
    <div className="w-[25%] border-r border-gray-700 p-2 overflow-y-auto">
      <h4 className="text-[10px] text-gray-500 mb-2">{label}</h4>
      {sensors.map((s: any) => {
        const data = sensorData[s.sensor_id];
        const history = sensorHistory[s.sensor_id] || [];
        return (
          <div key={s.sensor_id} className="mb-2">
            <div className="flex justify-between text-[10px] px-1 mb-0.5">
              <span className="text-gray-400">{s.sensor_type}</span>
              <span className={`font-mono ${data?.label === 'ANOMALY' ? 'text-red-400' : data?.label === 'WARNING' ? 'text-orange-400' : 'text-white'}`}>
                {data ? data.value.toFixed(2) : '—'} {s.unit}
              </span>
            </div>
            <SensorChart
              data={history}
              sensorType={s.sensor_type}
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
      {/* 상단: 3분할 (센서차트 + 3D + 센서차트) */}
      <div className="flex-1 flex min-h-0">
        {renderSensorPanel(leftSensors, '좌측 센서')}

        <div className="flex-1 bg-bg-primary">
          <ThreeCanvas>
            <PumpDetailModel meshStates={pumpMeshStates} />
          </ThreeCanvas>
        </div>

        {renderSensorPanel(rightSensors, '우측 센서')}
      </div>

      {/* 설비 탭 */}
      <div className="h-10 border-t border-gray-700 flex items-center px-2 gap-1 overflow-x-auto bg-bg-secondary">
        {equipment.filter(e => e.is_core).map((eq) => (
          <button
            key={eq.equipment_id}
            onClick={() => setSelectedTab(eq.equipment_id)}
            className={`px-3 py-1 text-[10px] rounded whitespace-nowrap ${
              selectedTab === eq.equipment_id ? 'bg-accent-blue text-white' : 'text-gray-400 hover:bg-bg-tertiary'
            }`}
          >
            {EQUIPMENT_ICONS[eq.equipment_type]} {eq.equipment_id}
          </button>
        ))}
      </div>

      {/* KOGAS 진단 결과 바 */}
      {kogasResult && (
        <div className="h-12 border-t border-gray-700 bg-bg-tertiary flex items-center px-4 gap-4 text-xs">
          <span className="text-green-400">🟢 KOGAS 연결정상</span>
          <span className="text-gray-300">고장명: <b>{kogasResult.fault_name}</b></span>
          <span className="text-gray-300">확신도: <b>{(kogasResult.diagnosis_confidence * 100).toFixed(0)}%</b></span>
          <span className="text-gray-300">의심부위: <b>{kogasResult.suspected_part}</b></span>
          <div className="ml-auto flex gap-2">
            {['위험예측', '시뮬레이션', 'SOP', '이력조회'].map(l => (
              <button key={l} className="text-accent-blue hover:underline text-[10px]">[{l}]</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
