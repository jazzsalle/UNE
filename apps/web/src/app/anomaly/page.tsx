// ref: CLAUDE.md §9.4 — 이상탐지 (M-ANO)
'use client';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';
import { EQUIPMENT_ICONS } from '@/lib/constants';

export default function AnomalyPage() {
  const [equipment, setEquipment] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState('PMP-301');
  const [kogasResult, setKogasResult] = useState<any>(null);
  const { eventContext, sensorData } = useAppStore();

  useEffect(() => {
    api.getEquipment().then(setEquipment).catch(console.error);
  }, []);

  useEffect(() => {
    const scenarioId = eventContext?.scenario_id || 'SC-02';
    api.getKogas(scenarioId).then(setKogasResult).catch(() => {});
  }, [eventContext]);

  const selectedEq = equipment.find((e) => e.equipment_id === selectedTab);

  return (
    <div className="h-full flex flex-col">
      {/* 상단: 3분할 (센서차트 + 3D + 센서차트) */}
      <div className="flex-1 flex min-h-0">
        <div className="w-[25%] border-r border-gray-700 p-3 overflow-y-auto">
          <h4 className="text-xs text-gray-400 mb-2">좌측 센서</h4>
          {selectedEq?.sensors?.slice(0, 4).map((s: any) => {
            const data = sensorData[s.sensor_id];
            return (
              <div key={s.sensor_id} className="mb-3 bg-bg-tertiary rounded p-2">
                <div className="text-[10px] text-gray-400">{s.sensor_type}</div>
                <div className="text-lg font-mono text-white">{data ? data.value.toFixed(2) : '—'} <span className="text-xs text-gray-500">{s.unit}</span></div>
                <div className="h-8 bg-gray-800 rounded mt-1 flex items-end px-1">
                  <div className="w-full h-4 bg-accent-cyan/30 rounded" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex-1 flex items-center justify-center bg-bg-primary">
          <div className="text-center text-gray-500 text-sm">
            <div className="text-4xl mb-2">🔧</div>
            <div>3D 설비 상세 뷰어</div>
            <div className="text-xs text-gray-600 mt-1">{selectedTab === 'PMP-301' ? 'secondary_pump.glb' : selectedTab}</div>
          </div>
        </div>

        <div className="w-[25%] border-l border-gray-700 p-3 overflow-y-auto">
          <h4 className="text-xs text-gray-400 mb-2">우측 센서</h4>
          {selectedEq?.sensors?.slice(4, 8).map((s: any) => {
            const data = sensorData[s.sensor_id];
            return (
              <div key={s.sensor_id} className="mb-3 bg-bg-tertiary rounded p-2">
                <div className="text-[10px] text-gray-400">{s.sensor_type}</div>
                <div className="text-lg font-mono text-white">{data ? data.value.toFixed(2) : '—'} <span className="text-xs text-gray-500">{s.unit}</span></div>
                <div className="h-8 bg-gray-800 rounded mt-1 flex items-end px-1">
                  <div className="w-full h-4 bg-accent-cyan/30 rounded" />
                </div>
              </div>
            );
          })}
        </div>
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
        </div>
      )}
    </div>
  );
}
