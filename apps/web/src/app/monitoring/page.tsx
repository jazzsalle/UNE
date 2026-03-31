// ref: CLAUDE.md §9.2 — 기본 모니터링 (M-MON) 개선
'use client';
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';
import { EQUIPMENT_ICONS, type VisualState } from '@/lib/constants';
import { EventPopup } from '@/components/common/EventPopup';
// getPresetForEquipment now just returns the equipment ID itself

const ThreeCanvas = dynamic(() => import('@/components/viewer3d/ThreeCanvas').then(m => ({ default: m.ThreeCanvas })), { ssr: false });
const TestbedModel = dynamic(() => import('@/components/viewer3d/TestbedModel').then(m => ({ default: m.TestbedModel })), { ssr: false });
const CameraController = dynamic(() => import('@/components/viewer3d/CameraController').then(m => ({ default: m.CameraController })), { ssr: false });
const EquipmentPOIs = dynamic(() => import('@/components/viewer3d/EquipmentPOI').then(m => ({ default: m.EquipmentPOIs })), { ssr: false });
const EnvironmentScene = dynamic(() => import('@/components/viewer3d/EnvironmentScene').then(m => ({ default: m.EnvironmentScene })), { ssr: false });

// 한국어 설비명 매핑
const EQUIPMENT_NAMES_KR: Record<string, string> = {
  'SHP-001': 'LH2 운반선',
  'ARM-101': '로딩암',
  'TK-101':  '저장탱크 #1',
  'TK-102':  '저장탱크 #2',
  'BOG-201': 'BOG 압축기',
  'PMP-301': '이송펌프',
  'VAP-401': '기화기',
  'REL-701': '재액화기',
  'VAL-601': '밸브 #1',
  'VAL-602': '밸브 #2',
  'PIP-501': '메인배관',
};

const PROCESS_STAGES = [
  { no: 1, name: '하역', ids: ['SHP-001', 'ARM-101'], icon: '⚓' },
  { no: 2, name: '저장·BOG', ids: ['TK-101', 'TK-102', 'BOG-201', 'REL-701'], icon: '🏭' },
  { no: 3, name: '이송', ids: ['PMP-301', 'PIP-501', 'VAL-601', 'VAL-602'], icon: '🔧' },
  { no: 4, name: '기화·송출', ids: ['VAP-401'], icon: '🌡' },
];

export default function MonitoringPage() {
  const [equipment, setEquipment] = useState<any[]>([]);
  const [cameraTarget, setCameraTarget] = useState<string | null>(null);
  const { selectedEquipmentId, setSelectedEquipment, sensorData, showEventPopup, eventContext, alarms, acknowledgeAlarm, removeAlarm } = useAppStore();

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
    // Add affected equipment from event context
    if (eventContext?.affected_equipment_ids) {
      for (const id of eventContext.affected_equipment_ids) {
        if (states[id] === 'normal') states[id] = 'affected';
      }
    }
    return states;
  }, [equipment, sensorData, eventContext]);

  const handleSelectEquipment = (id: string) => {
    setSelectedEquipment(id);
    setCameraTarget(id);
  };

  const selectedEq = equipment.find((e) => e.equipment_id === selectedEquipmentId);
  const getStatus = (eqId: string): VisualState => equipmentStates[eqId] || 'normal';

  const statusDot = (status: VisualState) => {
    if (status === 'critical' || status === 'emergency') return 'bg-red-500 animate-pulse shadow-sm shadow-red-500/50';
    if (status === 'warning') return 'bg-amber-500';
    if (status === 'affected') return 'bg-yellow-400';
    return '';
  };

  // Phase-based stage status
  const currentPhase = eventContext?.current_phase;
  const triggerEqId = eventContext?.trigger_equipment_id;

  return (
    <div className="flex h-full">
      {/* 좌측: 공정 흐름 패널 */}
      <aside className="w-[210px] bg-[#0a0e17] border-r border-white/[0.06] overflow-y-auto scrollbar-thin p-3">
        <div className="text-[10px] text-gray-600 font-medium uppercase tracking-wider mb-3">공정 흐름</div>
        {PROCESS_STAGES.map((stage, i) => {
          const stageEq = equipment.filter(e => stage.ids.includes(e.equipment_id));
          const hasWarning = stageEq.some(e => getStatus(e.equipment_id) !== 'normal');
          const hasCritical = stageEq.some(e => getStatus(e.equipment_id) === 'critical' || getStatus(e.equipment_id) === 'emergency');
          const hasAffected = stageEq.some(e => getStatus(e.equipment_id) === 'affected');
          const hasTrigger = stageEq.some(e => e.equipment_id === triggerEqId);

          return (
            <div key={stage.no} className="mb-1.5">
              <div className={`glass-sm p-2.5 transition-all duration-500 ${
                hasCritical ? 'border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-pulseGlow' :
                hasTrigger && currentPhase === 'SYMPTOM' ? 'border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.1)]' :
                hasAffected ? 'border-yellow-500/30' :
                hasWarning ? 'border-amber-500/30' : ''
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{stage.icon}</span>
                  <span className="text-[10px] font-medium text-gray-400">{stage.no}단계</span>
                  <span className="text-[11px] font-semibold text-white">{stage.name}</span>
                  {hasCritical && <span className="ml-auto text-[8px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold animate-pulse">위험</span>}
                  {!hasCritical && hasAffected && <span className="ml-auto text-[8px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-bold">영향</span>}
                </div>

                {stageEq.map((eq) => {
                  const status = getStatus(eq.equipment_id);
                  const isSelected = selectedEquipmentId === eq.equipment_id;
                  const isTrigger = eq.equipment_id === triggerEqId;
                  const mainSensor = eq.sensors?.[0];
                  const mainValue = mainSensor ? sensorData[mainSensor.sensor_id]?.value : null;

                  return (
                    <button
                      key={eq.equipment_id}
                      onClick={() => handleSelectEquipment(eq.equipment_id)}
                      className={`sidebar-item flex items-center gap-2 transition-all duration-300 ${
                        isSelected ? 'sidebar-item-active' :
                        isTrigger && status !== 'normal' ? '!bg-red-500/10 !border-red-500/20' : ''
                      }`}
                    >
                      <span className="text-xs">{EQUIPMENT_ICONS[eq.equipment_type] || '⚙'}</span>
                      <span className="truncate flex-1 text-left text-[10px]">
                        {EQUIPMENT_NAMES_KR[eq.equipment_id] || eq.equipment_name}
                      </span>
                      {status !== 'normal' && <div className={`w-2 h-2 rounded-full ${statusDot(status)}`} />}
                      {mainValue !== null && mainValue !== undefined && (
                        <span className={`text-[9px] font-mono ${
                          status === 'critical' ? 'text-red-400' :
                          status === 'warning' ? 'text-amber-400' : 'text-gray-500'
                        }`}>{mainValue.toFixed(1)}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {i < PROCESS_STAGES.length - 1 && (
                <div className="flex justify-center py-1">
                  <div className={`w-px h-3 transition-colors duration-500 ${
                    hasCritical || hasAffected
                      ? 'bg-gradient-to-b from-red-500/50 to-amber-500/30'
                      : 'bg-gradient-to-b from-cyan-500/30 to-transparent'
                  }`} />
                </div>
              )}
            </div>
          );
        })}
      </aside>

      {/* 중앙: 3D 뷰어 */}
      <main className="flex-1 relative">
        {/* KPI 대시보드 (상단 중앙) */}
        <div className="absolute top-0 left-0 right-0 z-10 flex justify-center pt-2 px-3 pointer-events-none">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1 pointer-events-auto">
            {equipment.filter(e => e.is_core).map((eq) => {
              const status = getStatus(eq.equipment_id);
              const mainSensor = eq.sensors?.[0];
              const value = mainSensor ? sensorData[mainSensor.sensor_id]?.value : null;
              const isSelected = selectedEquipmentId === eq.equipment_id;
              const isAnomalous = status === 'critical' || status === 'emergency';

              return (
                <button
                  key={eq.equipment_id}
                  onClick={() => handleSelectEquipment(eq.equipment_id)}
                  className={`flex-shrink-0 px-3 py-1.5 min-w-[90px] rounded-lg border backdrop-blur-md transition-all duration-300 ${
                    isSelected ? 'border-cyan-500/50 bg-cyan-500/15' :
                    isAnomalous ? 'border-red-500/40 bg-red-500/10 animate-pulse' :
                    status === 'warning' ? 'border-amber-500/40 bg-amber-500/10' :
                    'border-white/[0.08] bg-[#0c1220]/80'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px]">{EQUIPMENT_ICONS[eq.equipment_type]}</span>
                    <span className="text-[9px] font-medium text-gray-300">
                      {EQUIPMENT_NAMES_KR[eq.equipment_id] || eq.equipment_id}
                    </span>
                    {status !== 'normal' && <div className={`w-1.5 h-1.5 rounded-full ml-auto ${statusDot(status)}`} />}
                  </div>
                  {mainSensor && value !== null && value !== undefined && (
                    <div className="text-[11px] font-mono text-center">
                      <span className={
                        isAnomalous ? 'text-red-400 glow-red' :
                        status === 'warning' ? 'text-amber-400' : 'text-cyan-400'
                      }>{value.toFixed(1)}</span>
                      <span className="text-gray-600 text-[8px] ml-0.5">{mainSensor.unit}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <ThreeCanvas>
          <EnvironmentScene />
          <TestbedModel equipmentStates={equipmentStates} onEquipmentClick={handleSelectEquipment} />
          <EquipmentPOIs
            equipment={equipment}
            equipmentStates={equipmentStates}
            selectedId={selectedEquipmentId}
            onSelect={handleSelectEquipment}
            sensorData={sensorData}
          />
          <CameraController targetEquipmentId={cameraTarget} />
        </ThreeCanvas>
      </main>

      {/* 우측: 설비 정보 + 알람 이력 패널 */}
      <aside className="w-[260px] bg-[#0a0e17] border-l border-white/[0.06] overflow-y-auto scrollbar-thin flex flex-col">
        {selectedEq ? (
          <div className="animate-slideInRight flex-shrink-0">
            {/* Header */}
            <div className="p-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{EQUIPMENT_ICONS[selectedEq.equipment_type]}</span>
                <div>
                  <div className="text-sm font-bold">{EQUIPMENT_NAMES_KR[selectedEq.equipment_id] || selectedEq.equipment_name}</div>
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
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="text-2xl mb-2 opacity-30">⚙</div>
              <div className="text-xs text-gray-600">설비를 선택하세요</div>
            </div>
          </div>
        )}

        {/* 알람 이력 패널 */}
        <div className="flex-1 border-t border-white/[0.06] flex flex-col min-h-0">
          <div className="p-3 flex items-center justify-between">
            <div className="text-[10px] text-gray-600 font-medium uppercase tracking-wider">
              알람 이력
              {alarms.filter(a => !a.acknowledged).length > 0 && (
                <span className="ml-1.5 text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                  {alarms.filter(a => !a.acknowledged).length}
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 space-y-1">
            {alarms.length === 0 ? (
              <div className="text-center text-gray-600 text-[10px] py-4">알람 없음</div>
            ) : (
              alarms.slice(0, 30).map((alarm) => (
                <div
                  key={alarm.id}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] transition-all duration-300 group ${
                    !alarm.acknowledged
                      ? alarm.label === 'ANOMALY'
                        ? 'bg-red-500/10 border border-red-500/20 animate-[blink_2s_ease-in-out_3]'
                        : 'bg-amber-500/10 border border-amber-500/20 animate-[blink_2s_ease-in-out_3]'
                      : 'bg-white/[0.02] border border-white/[0.04] opacity-50'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    alarm.label === 'ANOMALY' ? 'bg-red-500' : 'bg-amber-500'
                  } ${!alarm.acknowledged ? 'animate-pulse' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className={`font-medium truncate ${alarm.acknowledged ? 'text-gray-500' : 'text-white'}`}>
                        {alarm.sensor_id}
                      </span>
                      <span className={`font-mono ${alarm.acknowledged ? 'text-gray-600' : alarm.label === 'ANOMALY' ? 'text-red-400' : 'text-amber-400'}`}>
                        {alarm.value?.toFixed(1)}
                      </span>
                    </div>
                    <div className="text-gray-600 text-[9px]">{alarm.phase}</div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!alarm.acknowledged && (
                      <button
                        onClick={() => acknowledgeAlarm(alarm.id)}
                        className="text-[8px] px-1.5 py-0.5 rounded bg-white/[0.05] text-gray-400 hover:text-white hover:bg-white/[0.1]"
                        title="확인"
                      >
                        ✓
                      </button>
                    )}
                    <button
                      onClick={() => removeAlarm(alarm.id)}
                      className="text-[8px] px-1 py-0.5 rounded bg-white/[0.05] text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                      title="삭제"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {showEventPopup && eventContext && <EventPopup />}
    </div>
  );
}
