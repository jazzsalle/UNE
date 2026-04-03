// ref: CLAUDE.md §9.2 — 기본 모니터링 (M-MON) 개선
'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';
import { EQUIPMENT_ICONS, SENSOR_TYPE_KR, PHASE_KR, type VisualState } from '@/lib/constants';
import { EventPopup } from '@/components/common/EventPopup';

const ThreeCanvas = dynamic(() => import('@/components/viewer3d/ThreeCanvas').then(m => ({ default: m.ThreeCanvas })), { ssr: false });
const TestbedModel = dynamic(() => import('@/components/viewer3d/TestbedModel').then(m => ({ default: m.TestbedModel })), { ssr: false });
const CameraController = dynamic(() => import('@/components/viewer3d/CameraController').then(m => ({ default: m.CameraController })), { ssr: false });
const EquipmentPOIs = dynamic(() => import('@/components/viewer3d/EquipmentPOI').then(m => ({ default: m.EquipmentPOIs })), { ssr: false });
const EnvironmentScene = dynamic(() => import('@/components/viewer3d/EnvironmentScene').then(m => ({ default: m.EnvironmentScene })), { ssr: false });
const CameraBookmarkInner = dynamic(() => import('@/components/viewer3d/CameraBookmark').then(m => ({ default: m.CameraBookmark })), { ssr: false });
import { CameraControlsOverlay, getSavedCamera, type CameraBookmarkRef } from '@/components/viewer3d/CameraBookmark';

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
  'VAL-601': '벤트스택 #1',
  'VAL-602': '벤트스택 #2',
  'PIP-501': '메인배관',
};

// 설비 자산 정보 (설계 제원)
const EQUIPMENT_SPECS: Record<string, { items: { label: string; value: string }[] }> = {
  'SHP-001': { items: [{ label: '선박 용량', value: '20,000 m³' }, { label: '흘수', value: '11.5 m' }, { label: '전장', value: '230 m' }] },
  'ARM-101': { items: [{ label: '설계 압력', value: '10 barg' }, { label: '호스 직경', value: '16 inch' }, { label: 'ESD 작동시간', value: '< 30s' }] },
  'TK-101':  { items: [{ label: '설계 압력', value: '0.7 barg' }, { label: '용량', value: '10,000 m³' }, { label: '누출관 크기', value: '4 inch' }, { label: '설계 온도', value: '-253℃' }] },
  'TK-102':  { items: [{ label: '설계 압력', value: '0.7 barg' }, { label: '용량', value: '10,000 m³' }, { label: '누출관 크기', value: '4 inch' }, { label: '설계 온도', value: '-253℃' }] },
  'BOG-201': { items: [{ label: '설계 압력', value: '12.5 barg' }, { label: '유량', value: '5,000 Nm³/h' }, { label: '모터 출력', value: '500 kW' }, { label: '회전수', value: '3,600 RPM' }] },
  'PMP-301': { items: [{ label: '설계 압력', value: '15 barg' }, { label: '양정', value: '120 m' }, { label: '정격 유량', value: '150 m³/h' }, { label: '모터 출력', value: '250 kW' }] },
  'VAP-401': { items: [{ label: '설계 압력', value: '10 barg' }, { label: '처리 용량', value: '100 m³/h' }, { label: '열교환 면적', value: '850 m²' }, { label: '출구 온도', value: '5℃ 이상' }] },
  'REL-701': { items: [{ label: '설계 압력', value: '15 barg' }, { label: '처리 용량', value: '2,000 Nm³/h' }, { label: '냉매', value: 'LN2' }] },
  'VAL-601': { items: [{ label: '설계 압력', value: '16 barg' }, { label: '밸브 구경', value: '12 inch' }, { label: '작동 방식', value: '공압식 자동' }] },
  'VAL-602': { items: [{ label: '설계 압력', value: '16 barg' }, { label: '밸브 구경', value: '12 inch' }, { label: '작동 방식', value: '공압식 자동' }] },
  'PIP-501': { items: [{ label: '설계 압력', value: '15 barg' }, { label: '배관 직경', value: '12 inch' }, { label: '재질', value: 'SUS 316L' }, { label: '단열', value: '진공 이중관' }] },
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
  const cameraRef = useRef<CameraBookmarkRef | null>(null);
  const savedCamera = useMemo(() => getSavedCamera('monitoring'), []);
  const [monitorPanelOpen, setMonitorPanelOpen] = useState(true);
  const [monitorSelectedEq, setMonitorSelectedEq] = useState<string | null>(null);
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

  const statusBorder = (status: VisualState) => {
    if (status === 'critical' || status === 'emergency') return 'border-red-500/40';
    if (status === 'warning') return 'border-amber-500/30';
    if (status === 'affected') return 'border-yellow-500/30';
    return 'border-white/[0.06]';
  };

  const currentPhase = eventContext?.current_phase;
  const triggerEqId = eventContext?.trigger_equipment_id;

  // 벤트스택 비상 경로 활성화: BOG 과압 또는 벤트스택 이상 시
  const ventStackActive = useMemo(() => {
    const bogStatus = equipmentStates['BOG-201'];
    const tk101Status = equipmentStates['TK-101'];
    const val601Status = equipmentStates['VAL-601'];
    return (bogStatus === 'critical' || bogStatus === 'emergency') ||
           (tk101Status === 'critical' || tk101Status === 'emergency') ||
           (val601Status === 'warning' || val601Status === 'critical' || val601Status === 'emergency');
  }, [equipmentStates]);

  // 모니터링 패널용 설비 (monitorSelectedEq 또는 첫번째 설비)
  const monitorEq = monitorSelectedEq
    ? equipment.find(e => e.equipment_id === monitorSelectedEq)
    : equipment.find(e => e.is_core);

  return (
    <div className="flex h-full">
      {/* 좌측: 공정 흐름 패널 */}
      <aside className="w-[210px] bg-[#0a0e17] border-r border-white/[0.06] overflow-y-auto scrollbar-thin p-3">
        <div className="text-[10px] text-gray-600 font-medium tracking-wider mb-3">공정 흐름</div>
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

              {/* 2단계→3단계 사이: 벤트스택 비상 경로 인디케이터 */}
              {stage.no === 2 && ventStackActive && (
                <div className="my-1.5 mx-1 p-2 rounded border border-red-500/40 bg-red-500/5 animate-pulse">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px]">🔴</span>
                    <span className="text-[9px] font-bold text-red-400 tracking-wide">벤트스택 비상 경로</span>
                  </div>
                  <div className="text-[8px] text-red-300/70 leading-relaxed">
                    BOG 과압 → 안전밸브(PSV) 개방 대기
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="flex-1 h-0.5 bg-gradient-to-r from-red-500/60 via-orange-500/40 to-yellow-500/30 rounded" />
                    <span className="text-[7px] text-red-400/60">VAL-601</span>
                  </div>
                </div>
              )}

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
        <div className="relative w-full h-full">
          <CameraControlsOverlay controlRef={cameraRef} pageId="monitoring" />
          <ThreeCanvas initialPosition={savedCamera?.position} initialTarget={savedCamera?.target}>
            <EnvironmentScene />
            <TestbedModel equipmentStates={equipmentStates} onEquipmentClick={handleSelectEquipment} enableAmbientAnimations />
            <EquipmentPOIs
              equipment={equipment}
              equipmentStates={equipmentStates}
              selectedId={selectedEquipmentId}
              onSelect={handleSelectEquipment}
              sensorData={sensorData}
            />
            <CameraController targetEquipmentId={cameraTarget} />
            <CameraBookmarkInner pageId="monitoring" controlRef={cameraRef} />
          </ThreeCanvas>

          {/* 핵심설비 실시간 상태 패널 (좌측 하단 오버레이) */}
          <div className={`absolute left-2 bottom-2 z-10 transition-all duration-300 ${monitorPanelOpen ? 'w-[320px]' : 'w-[40px]'}`}>
            {monitorPanelOpen ? (
              <div className="bg-[#0a0e17]/95 backdrop-blur-md border border-white/[0.08] rounded-lg overflow-hidden shadow-2xl">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
                  <span className="text-[11px] font-bold text-cyan-400">핵심설비 실시간 상태</span>
                  <button onClick={() => setMonitorPanelOpen(false)} className="text-gray-500 hover:text-white text-xs">✕</button>
                </div>

                {/* 설비 탭 */}
                <div className="flex flex-wrap gap-0.5 px-2 py-1.5 border-b border-white/[0.06]">
                  {equipment.filter(e => e.is_core).map((eq) => {
                    const st = getStatus(eq.equipment_id);
                    const isActive = monitorSelectedEq === eq.equipment_id || (!monitorSelectedEq && eq === equipment.find(e => e.is_core));
                    return (
                      <button
                        key={eq.equipment_id}
                        onClick={() => setMonitorSelectedEq(eq.equipment_id)}
                        className={`px-1.5 py-0.5 rounded text-[9px] transition-all border ${
                          isActive ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' :
                          st === 'critical' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                          st === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                          'border-white/[0.06] text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {EQUIPMENT_NAMES_KR[eq.equipment_id]?.replace(/\s*#\d+/, '') || eq.equipment_id}
                      </button>
                    );
                  })}
                </div>

                {/* 선택 설비 상세 */}
                {monitorEq && (
                  <div className="p-2.5">
                    {/* 설비 헤더 */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">{EQUIPMENT_ICONS[monitorEq.equipment_type]}</span>
                      <span className="text-[12px] font-bold text-white">
                        {EQUIPMENT_NAMES_KR[monitorEq.equipment_id] || monitorEq.equipment_name}
                      </span>
                      <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded ${
                        getStatus(monitorEq.equipment_id) === 'critical' ? 'bg-red-500/20 text-red-400' :
                        getStatus(monitorEq.equipment_id) === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {getStatus(monitorEq.equipment_id) === 'critical' ? '이상' :
                         getStatus(monitorEq.equipment_id) === 'warning' ? '경고' : '정상'}
                      </span>
                    </div>

                    {/* 센서값 테이블 */}
                    <table className="w-full text-[10px] mb-2">
                      <thead>
                        <tr className="text-gray-500 border-b border-white/[0.06]">
                          <th className="text-left py-1 font-medium">항목</th>
                          <th className="text-right py-1 font-medium">수치</th>
                          <th className="text-right py-1 font-medium">위험도</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monitorEq.sensors?.map((sensor: any) => {
                          const data = sensorData[sensor.sensor_id];
                          const isAnomaly = data?.label === 'ANOMALY';
                          const isWarning = data?.label === 'WARNING';
                          return (
                            <tr key={sensor.sensor_id} className="border-b border-white/[0.03]">
                              <td className="py-1.5 text-gray-300">{SENSOR_TYPE_KR[sensor.sensor_type] || sensor.sensor_type}</td>
                              <td className={`py-1.5 text-right font-mono font-medium ${
                                isAnomaly ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-white'
                              }`}>
                                {data ? data.value.toFixed(2) : '—'} <span className="text-gray-600">{sensor.unit}</span>
                              </td>
                              <td className="py-1.5 text-right">
                                <div className="flex justify-end">
                                  <div className={`w-14 h-1.5 rounded-full overflow-hidden bg-white/[0.06]`}>
                                    <div className={`h-full rounded-full transition-all ${
                                      isAnomaly ? 'bg-red-500 w-full' :
                                      isWarning ? 'bg-amber-500 w-3/4' :
                                      'bg-emerald-500 w-1/4'
                                    }`} style={{ width: isAnomaly ? '100%' : isWarning ? '75%' : '25%' }} />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* BOG 등 특수 알림 */}
                    {getStatus(monitorEq.equipment_id) !== 'normal' && (
                      <div className={`text-[9px] px-2 py-1.5 rounded border ${
                        getStatus(monitorEq.equipment_id) === 'critical'
                          ? 'bg-red-500/10 border-red-500/20 text-red-300'
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                      }`}>
                        ⚡ {EQUIPMENT_NAMES_KR[monitorEq.equipment_id]} 이상상태 알람 발생
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setMonitorPanelOpen(true)}
                className="w-10 h-10 rounded-lg bg-[#0a0e17]/90 backdrop-blur-md border border-white/[0.08] flex items-center justify-center text-cyan-400 hover:bg-cyan-500/10 transition-all"
                title="실시간 상태 패널"
              >
                📊
              </button>
            )}
          </div>
        </div>
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

            {/* 설비 자산 정보 */}
            {EQUIPMENT_SPECS[selectedEq.equipment_id] && (
              <div className="p-3 border-b border-white/[0.06]">
                <div className="text-[10px] text-gray-600 font-medium tracking-wider mb-2">설비 제원</div>
                <div className="space-y-1">
                  {EQUIPMENT_SPECS[selectedEq.equipment_id].items.map((spec) => (
                    <div key={spec.label} className="flex items-center justify-between text-[10px] py-1 px-2 rounded bg-white/[0.02]">
                      <span className="text-gray-500">{spec.label}</span>
                      <span className="text-gray-200 font-mono">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 센서 현재값 */}
            <div className="p-3 border-b border-white/[0.06]">
              <div className="text-[10px] text-gray-600 font-medium tracking-wider mb-2">센서 현재값</div>
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
                      <span className="text-gray-400">{SENSOR_TYPE_KR[sensor.sensor_type] || sensor.sensor_type}</span>
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

            {/* 분석 모드 버튼 */}
            <div className="p-3 border-b border-white/[0.06]">
              <div className="text-[10px] text-gray-600 font-medium tracking-wider mb-2">분석 모드</div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: '설비 상태감시', path: '/anomaly', color: 'from-blue-500/20 to-blue-600/10' },
                  { label: '상호영향 위험예측', path: '/risk', color: 'from-purple-500/20 to-purple-600/10' },
                  { label: '시뮬레이션', path: '/simulation', color: 'from-cyan-500/20 to-cyan-600/10' },
                  { label: '디지털 SOP', path: '/sop', color: 'from-emerald-500/20 to-emerald-600/10' },
                  { label: '이력관리', path: '/history', color: 'from-amber-500/20 to-amber-600/10' },
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
            <div className="text-[10px] text-gray-600 font-medium tracking-wider">
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
                    <div className="text-gray-600 text-[9px]">{PHASE_KR[alarm.phase] || alarm.phase}</div>
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
