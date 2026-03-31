// ref: CLAUDE.md §9.2 — 기본 모니터링 (M-MON) 세련된 디자인
'use client';
import { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';
import { EQUIPMENT_ICONS, type VisualState } from '@/lib/constants';
import { EventPopup } from '@/components/common/EventPopup';
import { getPresetForEquipment } from '@/components/viewer3d/CameraController';

const ThreeCanvas = dynamic(() => import('@/components/viewer3d/ThreeCanvas').then(m => ({ default: m.ThreeCanvas })), { ssr: false });
const TestbedModel = dynamic(() => import('@/components/viewer3d/TestbedModel').then(m => ({ default: m.TestbedModel })), { ssr: false });
const CameraController = dynamic(() => import('@/components/viewer3d/CameraController').then(m => ({ default: m.CameraController })), { ssr: false });
const EquipmentPOIs = dynamic(() => import('@/components/viewer3d/EquipmentPOI').then(m => ({ default: m.EquipmentPOIs })), { ssr: false });
const EnvironmentScene = dynamic(() => import('@/components/viewer3d/EnvironmentScene').then(m => ({ default: m.EnvironmentScene })), { ssr: false });

const PROCESS_STAGES = [
  { no: 1, name: '하역', ids: ['SHP-001', 'ARM-101'], icon: '⚓' },
  { no: 2, name: '저장·BOG', ids: ['TK-101', 'TK-102', 'BOG-201', 'REL-701'], icon: '🏭' },
  { no: 3, name: '이송', ids: ['PMP-301', 'PIP-501', 'VAL-601', 'VAL-602'], icon: '🔧' },
  { no: 4, name: '기화·송출', ids: ['VAP-401'], icon: '🌡' },
];

export default function MonitoringPage() {
  const [equipment, setEquipment] = useState<any[]>([]);
  const [cameraPreset, setCameraPreset] = useState<string | null>(null);
  const { selectedEquipmentId, setSelectedEquipment, sensorData, showEventPopup, eventContext } = useAppStore();

  useEffect(() => {
    let mounted = true;
    const fetchWithRetry = async (retries = 4, delay = 800) => {
      for (let i = 0; i < retries; i++) {
        try {
          const data = await api.getEquipment();
          if (mounted) setEquipment(data);
          return;
        } catch {
          if (i < retries - 1) await new Promise(r => setTimeout(r, delay * (i + 1)));
        }
      }
    };
    fetchWithRetry();
    return () => { mounted = false; };
  }, []);

  const equipmentStates = useMemo(() => {
    const states: Record<string, VisualState> = {};
    for (const eq of equipment) {
      let worst: VisualState = 'normal';
      for (const s of eq.sensors || []) {
        const data = sensorData[s.sensor_id];
        if (data?.label === 'ANOMALY') { worst = 'critical'; break; }
        if (data?.label === 'WARNING' && worst === 'normal') worst = 'warning';
      }
      states[eq.equipment_id] = worst;
    }
    return states;
  }, [equipment, sensorData]);

  const handleSelectEquipment = (id: string) => {
    setSelectedEquipment(id);
    setCameraPreset(getPresetForEquipment(id));
  };

  const selectedEq = equipment.find((e) => e.equipment_id === selectedEquipmentId);
  const getStatus = (eqId: string): VisualState => equipmentStates[eqId] || 'normal';

  const statusDot = (status: VisualState) => {
    if (status === 'critical' || status === 'emergency') return 'bg-red-500 animate-pulse shadow-sm shadow-red-500/50';
    if (status === 'warning') return 'bg-amber-500';
    return '';
  };

  return (
    <div className="flex h-full">
      {/* 좌측: 공정 흐름 패널 */}
      <aside className="w-[210px] bg-[#0a0e17] border-r border-white/[0.06] overflow-y-auto scrollbar-thin p-3">
        <div className="text-[10px] text-gray-600 font-medium uppercase tracking-wider mb-3">공정 흐름</div>
        {PROCESS_STAGES.map((stage, i) => {
          const stageEq = equipment.filter(e => stage.ids.includes(e.equipment_id));
          const hasWarning = stageEq.some(e => getStatus(e.equipment_id) !== 'normal');
          const hasCritical = stageEq.some(e => getStatus(e.equipment_id) === 'critical');

          return (
            <div key={stage.no} className="mb-1.5">
              <div className={`glass-sm p-2.5 ${
                hasCritical ? 'border-red-500/30 animate-pulseGlow' :
                hasWarning ? 'border-amber-500/30' : ''
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{stage.icon}</span>
                  <span className="text-[10px] font-medium text-gray-400">{stage.no}단계</span>
                  <span className="text-[11px] font-semibold text-white">{stage.name}</span>
                </div>

                {stageEq.map((eq) => {
                  const status = getStatus(eq.equipment_id);
                  const isSelected = selectedEquipmentId === eq.equipment_id;
                  const mainSensor = eq.sensors?.[0];
                  const mainValue = mainSensor ? sensorData[mainSensor.sensor_id]?.value : null;

                  return (
                    <button
                      key={eq.equipment_id}
                      onClick={() => handleSelectEquipment(eq.equipment_id)}
                      className={`sidebar-item flex items-center gap-2 ${isSelected ? 'sidebar-item-active' : ''}`}
                    >
                      <span className="text-xs">{EQUIPMENT_ICONS[eq.equipment_type] || '⚙'}</span>
                      <span className="truncate flex-1 text-left">{eq.equipment_name}</span>
                      {status !== 'normal' && <div className={`w-2 h-2 rounded-full ${statusDot(status)}`} />}
                      {mainValue !== null && mainValue !== undefined && (
                        <span className="text-[9px] text-gray-500 font-mono">{mainValue.toFixed(1)}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {i < PROCESS_STAGES.length - 1 && (
                <div className="flex justify-center py-1">
                  <div className="w-px h-3 bg-gradient-to-b from-cyan-500/30 to-transparent" />
                </div>
              )}
            </div>
          );
        })}
      </aside>

      {/* 중앙: 3D 뷰어 */}
      <main className="flex-1 relative">
        <ThreeCanvas>
          <EnvironmentScene />
          <TestbedModel equipmentStates={equipmentStates} onEquipmentClick={handleSelectEquipment} />
          <EquipmentPOIs
            equipment={equipment}
            equipmentStates={equipmentStates}
            selectedId={selectedEquipmentId}
            onSelect={handleSelectEquipment}
          />
          <CameraController targetPreset={cameraPreset} />
        </ThreeCanvas>

        {/* KPI 대시보드 */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#060a13] via-[#060a13]/95 to-transparent pt-8 pb-2 px-3">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
            {equipment.filter(e => e.is_core).map((eq) => {
              const status = getStatus(eq.equipment_id);
              const mainSensor = eq.sensors?.[0];
              const value = mainSensor ? sensorData[mainSensor.sensor_id]?.value : null;
              const isSelected = selectedEquipmentId === eq.equipment_id;

              return (
                <button
                  key={eq.equipment_id}
                  onClick={() => handleSelectEquipment(eq.equipment_id)}
                  className={`flex-shrink-0 data-card px-3 py-2 min-w-[100px] ${
                    isSelected ? 'border-cyan-500/40 bg-cyan-500/10' :
                    status === 'critical' ? 'border-red-500/30 bg-red-500/5' :
                    status === 'warning' ? 'border-amber-500/30 bg-amber-500/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs">{EQUIPMENT_ICONS[eq.equipment_type]}</span>
                    <span className="text-[10px] font-medium text-gray-300">{eq.equipment_id}</span>
                    {status !== 'normal' && <div className={`w-1.5 h-1.5 rounded-full ml-auto ${statusDot(status)}`} />}
                  </div>
                  {mainSensor && value !== null && value !== undefined && (
                    <div className="text-[11px] font-mono">
                      <span className={status === 'critical' ? 'text-red-400 glow-red' : status === 'warning' ? 'text-amber-400' : 'text-cyan-400'}>{value.toFixed(1)}</span>
                      <span className="text-gray-600 text-[9px] ml-1">{mainSensor.unit}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* 우측: 설비 정보 패널 */}
      <aside className="w-[250px] bg-[#0a0e17] border-l border-white/[0.06] overflow-y-auto scrollbar-thin">
        {selectedEq ? (
          <div className="animate-slideInRight">
            {/* Header */}
            <div className="p-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{EQUIPMENT_ICONS[selectedEq.equipment_type]}</span>
                <div>
                  <div className="text-sm font-bold">{selectedEq.equipment_name}</div>
                  <div className="text-[10px] text-gray-500">{selectedEq.equipment_id} · {selectedEq.zone_id}</div>
                </div>
              </div>
            </div>

            {/* Sensors */}
            <div className="p-3">
              <div className="text-[10px] text-gray-600 font-medium uppercase tracking-wider mb-2">센서 현재값</div>
              <div className="space-y-1.5">
                {selectedEq.sensors?.map((sensor: any) => {
                  const data = sensorData[sensor.sensor_id];
                  const isWarning = data?.label === 'WARNING';
                  const isAnomaly = data?.label === 'ANOMALY';
                  return (
                    <div key={sensor.sensor_id}
                      className={`flex items-center justify-between text-[11px] py-1.5 px-2.5 rounded-lg ${
                        isAnomaly ? 'bg-red-500/10 border border-red-500/20' :
                        isWarning ? 'bg-amber-500/10 border border-amber-500/20' :
                        'bg-white/[0.03]'
                      }`}
                    >
                      <span className="text-gray-400">{sensor.sensor_type}</span>
                      <span className={`font-mono font-medium ${
                        isAnomaly ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-white'
                      }`}>
                        {data ? data.value.toFixed(2) : '—'}
                        <span className="text-gray-600 text-[9px] ml-1">{sensor.unit}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="p-3 border-t border-white/[0.06]">
              <div className="text-[10px] text-gray-600 font-medium uppercase tracking-wider mb-2">분석 모드</div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: '이상탐지', path: '/anomaly', color: 'from-blue-500/20 to-blue-600/10' },
                  { label: '위험예측', path: '/risk', color: 'from-purple-500/20 to-purple-600/10' },
                  { label: '시뮬레이션', path: '/simulation', color: 'from-cyan-500/20 to-cyan-600/10' },
                  { label: 'SOP', path: '/sop', color: 'from-emerald-500/20 to-emerald-600/10' },
                  { label: '이력조회', path: '/history', color: 'from-amber-500/20 to-amber-600/10' },
                ].map((btn) => (
                  <a key={btn.label} href={btn.path}
                    className={`text-center text-[10px] py-2 rounded-lg bg-gradient-to-br ${btn.color} border border-white/[0.06] hover:border-white/[0.15] transition-all text-gray-300 hover:text-white`}>
                    {btn.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-2xl mb-2 opacity-30">⚙</div>
              <div className="text-xs text-gray-600">설비를 선택하세요</div>
            </div>
          </div>
        )}
      </aside>

      {showEventPopup && eventContext && <EventPopup />}
    </div>
  );
}
