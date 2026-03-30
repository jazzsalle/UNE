// ref: CLAUDE.md §9.2 — 기본 모니터링 (M-MON)
'use client';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';
import { EQUIPMENT_ICONS, SEVERITY_COLORS } from '@/lib/constants';
import { EventPopup } from '@/components/common/EventPopup';

export default function MonitoringPage() {
  const [equipment, setEquipment] = useState<any[]>([]);
  const { selectedEquipmentId, setSelectedEquipment, sensorData, showEventPopup, eventContext } = useAppStore();

  useEffect(() => {
    api.getEquipment().then(setEquipment).catch(console.error);
  }, []);

  const selectedEq = equipment.find((e) => e.equipment_id === selectedEquipmentId);
  const getStatus = (eqId: string) => {
    const sensors = equipment.find((e) => e.equipment_id === eqId)?.sensors || [];
    for (const s of sensors) {
      const data = sensorData[s.sensor_id];
      if (data?.label === 'ANOMALY') return 'critical';
      if (data?.label === 'WARNING') return 'warning';
    }
    return 'normal';
  };

  return (
    <div className="flex h-full">
      {/* 좌측: 공정 흐름 패널 */}
      <aside className="w-[200px] bg-bg-secondary border-r border-gray-700 overflow-y-auto p-3">
        <h3 className="text-xs font-bold text-gray-400 mb-3">공정 흐름</h3>
        {['하역', '저장·BOG', '이송', '기화·송출'].map((stage, i) => {
          const stageEquipment = equipment.filter((e) => {
            const map: Record<number, string[]> = {
              0: ['SHP-001', 'ARM-101'],
              1: ['TK-101', 'TK-102', 'BOG-201', 'REL-701'],
              2: ['PMP-301', 'PIP-501', 'VAL-601', 'VAL-602'],
              3: ['VAP-401'],
            };
            return map[i]?.includes(e.equipment_id);
          });
          const hasWarning = stageEquipment.some((e) => getStatus(e.equipment_id) !== 'normal');

          return (
            <div key={stage} className={`mb-2 rounded border ${hasWarning ? 'border-orange-500' : 'border-gray-700'} p-2`}>
              <div className="text-[10px] text-gray-500 mb-1">{i + 1}단계: {stage}</div>
              {stageEquipment.map((eq) => {
                const status = getStatus(eq.equipment_id);
                const isSelected = selectedEquipmentId === eq.equipment_id;
                return (
                  <button
                    key={eq.equipment_id}
                    onClick={() => setSelectedEquipment(eq.equipment_id)}
                    className={`w-full text-left text-[11px] px-2 py-1 rounded mb-0.5 flex items-center gap-1 transition-colors ${
                      isSelected ? 'bg-accent-blue/20 text-white' : 'text-gray-300 hover:bg-bg-tertiary'
                    }`}
                  >
                    <span>{EQUIPMENT_ICONS[eq.equipment_type] || '⚙'}</span>
                    <span className="truncate">{eq.equipment_name}</span>
                    {status !== 'normal' && (
                      <span className={`ml-auto w-2 h-2 rounded-full ${status === 'critical' ? 'bg-red-500' : 'bg-orange-500'}`} />
                    )}
                  </button>
                );
              })}
              {i < 3 && <div className="text-center text-gray-600 text-[10px]">↓</div>}
            </div>
          );
        })}
      </aside>

      {/* 중앙: 3D 뷰어 영역 (placeholder) */}
      <main className="flex-1 relative bg-bg-primary flex items-center justify-center">
        <div className="text-gray-500 text-sm">
          <div className="text-center mb-2">🏗 3D 뷰어</div>
          <div className="text-xs text-gray-600">GLB 모델 로딩 영역</div>
          <div className="text-xs text-gray-600 mt-1">(Phase 2에서 Three.js 구현)</div>
        </div>

        {/* KPI 대시보드 하단 */}
        <div className="absolute bottom-0 left-0 right-0 bg-bg-secondary/90 border-t border-gray-700 p-2">
          <div className="flex gap-2 overflow-x-auto">
            {equipment.filter((e) => e.is_core).map((eq) => {
              const status = getStatus(eq.equipment_id);
              const mainSensor = eq.sensors?.[0];
              const value = mainSensor ? sensorData[mainSensor.sensor_id]?.value : null;
              return (
                <button
                  key={eq.equipment_id}
                  onClick={() => setSelectedEquipment(eq.equipment_id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded text-[10px] border transition-colors ${
                    status === 'critical' ? 'border-red-500 bg-red-500/10' :
                    status === 'warning' ? 'border-orange-500 bg-orange-500/10' :
                    'border-gray-700 bg-bg-tertiary'
                  }`}
                >
                  <div className="font-medium">{EQUIPMENT_ICONS[eq.equipment_type]} {eq.equipment_id}</div>
                  {mainSensor && value !== null && (
                    <div className="text-gray-400 mt-0.5">{value?.toFixed(1)} {mainSensor.unit}</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* 우측: 정보 패널 */}
      <aside className="w-[240px] bg-bg-secondary border-l border-gray-700 overflow-y-auto p-3">
        {selectedEq ? (
          <>
            <h3 className="text-sm font-bold mb-2">{EQUIPMENT_ICONS[selectedEq.equipment_type]} {selectedEq.equipment_name}</h3>
            <div className="text-[10px] text-gray-500 mb-3">{selectedEq.equipment_id} · {selectedEq.zone_id}</div>

            <h4 className="text-xs text-gray-400 mb-2">센서 현재값</h4>
            {selectedEq.sensors?.map((sensor: any) => {
              const data = sensorData[sensor.sensor_id];
              const isWarning = data?.label === 'WARNING';
              const isAnomaly = data?.label === 'ANOMALY';
              return (
                <div key={sensor.sensor_id} className={`flex justify-between text-[11px] py-1 px-2 rounded mb-0.5 ${
                  isAnomaly ? 'bg-red-500/10 text-red-400' : isWarning ? 'bg-orange-500/10 text-orange-400' : 'text-gray-300'
                }`}>
                  <span>{sensor.sensor_type}</span>
                  <span>{data ? `${data.value.toFixed(2)} ${sensor.unit}` : '—'}</span>
                </div>
              );
            })}

            <div className="mt-4 flex flex-col gap-1">
              {['이상탐지', '위험예측', '시뮬레이션', 'SOP', '이력조회'].map((label) => (
                <button key={label} className="text-[10px] text-accent-blue hover:underline text-left">[{label}]</button>
              ))}
            </div>
          </>
        ) : (
          <div className="text-gray-500 text-xs text-center mt-10">설비를 선택하세요</div>
        )}
      </aside>

      {/* 이벤트 팝업 */}
      {showEventPopup && eventContext && <EventPopup />}
    </div>
  );
}
