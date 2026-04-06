// ref: CLAUDE.md §9.2 — 기본 모니터링 (M-MON) 개선
'use client';
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';
import { EQUIPMENT_ICONS, SENSOR_TYPE_KR, PHASE_KR, SEVERITY_KR, type VisualState } from '@/lib/constants';

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
  'SWP-001': '해수펌프',
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
  'SWP-001': { items: [{ label: '설계 유량', value: '500 m³/h' }, { label: '양정', value: '25 m' }, { label: '모터 출력', value: '75 kW' }, { label: '용도', value: '기화기 해수 공급' }] },
};

const PROCESS_STAGES = [
  { name: '하역', ids: ['SHP-001', 'ARM-101'] },
  { name: '저장·BOG', ids: ['TK-101', 'TK-102', 'BOG-201', 'REL-701'] },
  { name: '이송', ids: ['PMP-301', 'PIP-501', 'VAL-601', 'VAL-602'] },
  { name: '기화·송출', ids: ['VAP-401', 'SWP-001'] },
];

// 센서 ID → 한글 설명 변환
const SENSOR_TYPE_ABBR: Record<string, string> = {
  PRE: '압력', TMP: '온도', FLO: '유량', VIB: '진동', CUR: '전류', LVL: '레벨',
};
function sensorIdToKorean(sensorId: string): string {
  const parts = sensorId.split('-');
  if (parts.length >= 3) {
    const eqId = parts.slice(0, 2).join('-');
    const typeAbbr = parts[2];
    const eqName = EQUIPMENT_NAMES_KR[eqId] || eqId;
    const typeName = SENSOR_TYPE_ABBR[typeAbbr] || typeAbbr;
    return `${eqName} ${typeName}`;
  }
  return sensorId;
}

export default function MonitoringPage() {
  const [equipment, setEquipment] = useState<any[]>([]);
  const [cameraTarget, setCameraTarget] = useState<string | null>(null);
  const cameraRef = useRef<CameraBookmarkRef | null>(null);
  const savedCamera = useMemo(() => getSavedCamera('monitoring'), []);
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'none' | 'flow' | 'info'>('none');
  const [showHelp, setShowHelp] = useState(false);

  // 이벤트 팝업 드래그 상태
  const [eventPopupPos, setEventPopupPos] = useState<{ x: number; y: number } | null>(null);
  const eventDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const { selectedEquipmentId, setSelectedEquipment, sensorData, showEventPopup, setShowEventPopup, eventContext, alarms, acknowledgeAlarm, removeAlarm, setShowSopPanel } = useAppStore();

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

  const currentPhase = eventContext?.current_phase;
  const triggerEqId = eventContext?.trigger_equipment_id;

  // 벤트스택 비상 경로 활성화
  const ventStackActive = useMemo(() => {
    const bogStatus = equipmentStates['BOG-201'];
    const tk101Status = equipmentStates['TK-101'];
    const val601Status = equipmentStates['VAL-601'];
    return (bogStatus === 'critical' || bogStatus === 'emergency') ||
           (tk101Status === 'critical' || tk101Status === 'emergency') ||
           (val601Status === 'warning' || val601Status === 'critical' || val601Status === 'emergency');
  }, [equipmentStates]);

  // 모니터링 대상 설비 목록 (EQUIPMENT_NAMES_KR에 등록된 설비 전체)
  const monitoredEquipment = useMemo(() => {
    const knownIds = Object.keys(EQUIPMENT_NAMES_KR);
    return equipment.filter(e => knownIds.includes(e.equipment_id));
  }, [equipment]);

  // Overview 통계
  const overviewStats = useMemo(() => {
    const total = monitoredEquipment.length;
    const normalCount = monitoredEquipment.filter(e => getStatus(e.equipment_id) === 'normal').length;
    const warningCount = monitoredEquipment.filter(e => getStatus(e.equipment_id) === 'warning' || getStatus(e.equipment_id) === 'affected').length;
    const criticalCount = monitoredEquipment.filter(e => getStatus(e.equipment_id) === 'critical' || getStatus(e.equipment_id) === 'emergency').length;
    const activeAlarms = alarms.filter(a => !a.acknowledged).length;
    return { total, normalCount, warningCount, criticalCount, activeAlarms };
  }, [monitoredEquipment, equipmentStates, alarms]);

  // 이벤트 팝업 기본 위치 (우측 패널 바로 왼쪽)
  const getEventPopupDefaultPos = useCallback(() => {
    const rightPanels = document.querySelectorAll('aside');
    // 마지막 aside (우측 패널) 찾기
    const rightPanel = rightPanels[rightPanels.length - 1];
    if (rightPanel) {
      const rect = rightPanel.getBoundingClientRect();
      return { x: Math.max(10, rect.left - 360), y: Math.max(10, rect.top + 10) };
    }
    return { x: Math.max(10, window.innerWidth - 640), y: 80 };
  }, []);

  // 이벤트 팝업 드래그 핸들러
  const handleEventDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    const currentPos = eventPopupPos || getEventPopupDefaultPos();
    eventDragRef.current = { startX: clientX, startY: clientY, origX: currentPos.x, origY: currentPos.y };

    const handleMove = (ev: MouseEvent) => {
      if (!eventDragRef.current) return;
      const dx = ev.clientX - eventDragRef.current.startX;
      const dy = ev.clientY - eventDragRef.current.startY;
      setEventPopupPos({
        x: Math.max(0, Math.min(window.innerWidth - 360, eventDragRef.current.origX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 200, eventDragRef.current.origY + dy)),
      });
    };
    const handleUp = () => {
      eventDragRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [eventPopupPos, getEventPopupDefaultPos]);

  // 이벤트 팝업 위치 초기화 (새 이벤트 시)
  useEffect(() => {
    if (showEventPopup) setEventPopupPos(null);
  }, [showEventPopup]);

  return (
    <div className="flex h-full relative">
      {/* 모바일 하단 탭 (< lg) */}
      <div className="lg:hidden fixed bottom-11 sm:bottom-11 left-0 right-0 z-[50] flex bg-[#0a0e17]/95 backdrop-blur-md border-t border-white/[0.06]">
        <button
          onClick={() => setMobilePanel(mobilePanel === 'flow' ? 'none' : 'flow')}
          className={`flex-1 py-2.5 text-[11px] font-medium ${mobilePanel === 'flow' ? 'text-cyan-400 bg-cyan-500/10' : 'text-gray-500'}`}
        >
          공정 흐름
        </button>
        <button
          onClick={() => setMobilePanel(mobilePanel === 'info' ? 'none' : 'info')}
          className={`flex-1 py-2.5 text-[11px] font-medium border-l border-white/[0.06] ${mobilePanel === 'info' ? 'text-cyan-400 bg-cyan-500/10' : 'text-gray-500'}`}
        >
          설비 정보 {alarms.filter(a => !a.acknowledged).length > 0 && (
            <span className="ml-1 text-[9px] bg-red-500/20 text-red-400 px-1 rounded-full">{alarms.filter(a => !a.acknowledged).length}</span>
          )}
        </button>
      </div>

      {/* 좌측: 공정 흐름 패널 — desktop: 사이드바, mobile/tablet: 바텀시트 */}
      <aside className={`
        lg:relative lg:w-[210px] lg:block
        ${mobilePanel === 'flow'
          ? 'fixed inset-x-0 bottom-[calc(2.75rem+2.75rem)] sm:bottom-[calc(2.75rem+2.75rem)] top-auto z-[50] max-h-[50vh] rounded-t-xl'
          : 'hidden lg:block'
        }
        bg-[#0a0e17] border-r border-white/[0.06] overflow-y-auto scrollbar-thin p-3
      `}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[12px] text-gray-600 font-medium tracking-wider">공정 흐름</div>
          <button onClick={() => setShowHelp(!showHelp)}
            className="text-[10px] text-gray-600 hover:text-cyan-400 border border-gray-700 hover:border-cyan-500/30 px-1.5 py-0.5 rounded transition-all"
            title="도움말">?</button>
        </div>
        {showHelp && (
          <div className="mb-3 p-2.5 bg-gray-800/80 rounded border border-gray-600 text-[11px] space-y-2">
            <div className="text-cyan-400 font-bold text-[12px] mb-1">전주기 운전 모니터링</div>
            <ul className="text-gray-400 space-y-1 list-disc ml-3">
              <li><b className="text-white">좌측 공정 흐름 패널</b>: 4단계 공정(하역→저장→이송→기화)을 따라 설비 상태를 한눈에 파악</li>
              <li><b className="text-white">3D 뷰어</b>: 테스트베드 전체를 조망하며, 설비 클릭 시 카메라 이동 + 상세 정보 표시</li>
              <li><b className="text-white">KPI 대시보드</b>: 하단에 핵심 설비의 대표 센서값을 실시간 표시</li>
              <li><b className="text-white">이벤트 팝업</b>: 이상 발생 시 자동 표시되며, 각 모드로 전환 가능</li>
              <li><b className="text-white">시나리오 에뮬레이터</b>: 하단 바에서 시나리오를 선택하고 재생하면 전체 시스템이 연동됨</li>
            </ul>
            <div className="text-gray-500 text-[10px] mt-1 border-t border-gray-700 pt-1">
              설비 아이콘 또는 KPI 카드를 클릭하면 3D 카메라가 해당 설비로 이동합니다.
            </div>
          </div>
        )}
        {PROCESS_STAGES.map((stage, i) => {
          const stageEq = equipment.filter(e => stage.ids.includes(e.equipment_id));
          const hasWarning = stageEq.some(e => getStatus(e.equipment_id) !== 'normal');
          const hasCritical = stageEq.some(e => getStatus(e.equipment_id) === 'critical' || getStatus(e.equipment_id) === 'emergency');
          const hasAffected = stageEq.some(e => getStatus(e.equipment_id) === 'affected');
          const hasTrigger = stageEq.some(e => e.equipment_id === triggerEqId);

          return (
            <div key={stage.name} className="mb-1.5">
              <div className={`glass-sm p-2.5 transition-all duration-500 ${
                hasCritical ? 'border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-pulseGlow' :
                hasTrigger && currentPhase === 'SYMPTOM' ? 'border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.1)]' :
                hasAffected ? 'border-yellow-500/30' :
                hasWarning ? 'border-amber-500/30' : ''
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[13px] font-semibold text-white">{stage.name}</span>
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
                      <span className="truncate flex-1 text-left text-[12px]">
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

              {/* 벤트스택 비상 경로 */}
              {i === 1 && ventStackActive && (
                <div className="my-1.5 mx-1 p-2 rounded border border-red-500/40 bg-red-500/5 animate-pulse">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[12px]">🔴</span>
                    <span className="text-[9px] font-bold text-red-400 tracking-wide">벤트스택 비상 경로</span>
                  </div>
                  <div className="text-[8px] text-red-300/70 leading-relaxed">BOG 과압 → 안전밸브(PSV) 개방 대기</div>
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

          {/* ========== 1. Equipment Overview (좌측 상단 컴팩트) ========== */}
          <div className="absolute left-3 top-3 z-[50]">
            {/* 컴팩트 카드 */}
            <div className="bg-[#0a0e17]/90 backdrop-blur-xl border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl w-[260px]">
              {/* 헤더 */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
                <span className="text-[12px] font-bold text-white tracking-wide">핵심설비 실시간 모니터링</span>
                <button
                  onClick={() => setOverviewExpanded(!overviewExpanded)}
                  className="w-6 h-6 rounded-md bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-gray-400 hover:text-cyan-400 transition-all"
                  title={overviewExpanded ? '축소' : '확대'}
                >
                  {overviewExpanded ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                  )}
                </button>
              </div>

              {/* KPI 카드 3개 */}
              <div className="grid grid-cols-3 gap-1.5 p-2.5">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-2 text-center">
                  <div className="text-[18px] font-bold text-emerald-400">{overviewStats.normalCount}</div>
                  <div className="text-[9px] text-emerald-400/70 font-medium">정상</div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-2 text-center">
                  <div className="text-[18px] font-bold text-amber-400">{overviewStats.warningCount}</div>
                  <div className="text-[9px] text-amber-400/70 font-medium">경고</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-2 text-center">
                  <div className={`text-[18px] font-bold text-red-400 ${overviewStats.criticalCount > 0 ? 'animate-pulse' : ''}`}>{overviewStats.criticalCount}</div>
                  <div className="text-[9px] text-red-400/70 font-medium">이상</div>
                </div>
              </div>

              {/* 설비 상태 바 (한 줄 요약) */}
              <div className="px-2.5 pb-2.5 flex flex-wrap gap-1">
                {monitoredEquipment.map((eq) => {
                  const st = getStatus(eq.equipment_id);
                  const shortName = (EQUIPMENT_NAMES_KR[eq.equipment_id] || eq.equipment_id).replace(/\s*#\d+/, '');
                  return (
                    <button
                      key={eq.equipment_id}
                      onClick={() => handleSelectEquipment(eq.equipment_id)}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border transition-all hover:scale-105 ${
                        st === 'critical' || st === 'emergency' ? 'border-red-500/40 bg-red-500/10 text-red-400' :
                        st === 'warning' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' :
                        st === 'affected' ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400' :
                        'border-white/[0.06] bg-white/[0.02] text-gray-500'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        st === 'critical' || st === 'emergency' ? 'bg-red-500 animate-pulse' :
                        st === 'warning' ? 'bg-amber-500' :
                        st === 'affected' ? 'bg-yellow-400' :
                        'bg-emerald-500'
                      }`} />
                      {shortName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ========== 확대 상세 팝업 ========== */}
            {overviewExpanded && (
              <div className="mt-2 bg-[#0a0e17]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl w-[340px] animate-fadeIn">
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
                  <span className="text-[12px] font-bold text-cyan-400">설비 상세 상태</span>
                  <button onClick={() => setOverviewExpanded(false)} className="text-gray-500 hover:text-white text-xs">✕</button>
                </div>

                <div className="max-h-[50vh] overflow-y-auto scrollbar-thin">
                  {monitoredEquipment.map((eq) => {
                    const st = getStatus(eq.equipment_id);
                    const sensors = eq.sensors || [];
                    return (
                      <div
                        key={eq.equipment_id}
                        onClick={() => handleSelectEquipment(eq.equipment_id)}
                        className={`px-3 py-2.5 border-b border-white/[0.04] cursor-pointer hover:bg-white/[0.03] transition-all ${
                          selectedEquipmentId === eq.equipment_id ? 'bg-cyan-500/5 border-l-2 border-l-cyan-500' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm">{EQUIPMENT_ICONS[eq.equipment_type] || '⚙'}</span>
                          <span className="text-[12px] font-bold text-white flex-1">
                            {EQUIPMENT_NAMES_KR[eq.equipment_id] || eq.equipment_name}
                          </span>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${
                            st === 'critical' || st === 'emergency' ? 'bg-red-500/20 text-red-400' :
                            st === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                            st === 'affected' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {st === 'critical' || st === 'emergency' ? '이상' : st === 'warning' ? '경고' : st === 'affected' ? '영향' : '정상'}
                          </span>
                        </div>

                        {/* 센서값 미니 행 */}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {sensors.slice(0, 4).map((sensor: any) => {
                            const data = sensorData[sensor.sensor_id];
                            const isAnomaly = data?.label === 'ANOMALY';
                            const isWarning = data?.label === 'WARNING';
                            return (
                              <div key={sensor.sensor_id} className="flex items-center gap-1 text-[10px]">
                                <span className="text-gray-500">{SENSOR_TYPE_KR[sensor.sensor_type] || sensor.sensor_type}</span>
                                <span className={`font-mono font-medium ${
                                  isAnomaly ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-gray-300'
                                }`}>
                                  {data ? data.value.toFixed(1) : '—'}
                                </span>
                                <span className="text-gray-600 text-[8px]">{sensor.unit}</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* 위험도 바 */}
                        <div className="mt-1.5 w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${
                            st === 'critical' || st === 'emergency' ? 'bg-red-500 w-full' :
                            st === 'warning' ? 'bg-amber-500 w-3/4' :
                            st === 'affected' ? 'bg-yellow-500 w-1/2' :
                            'bg-emerald-500 w-1/4'
                          }`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 이벤트 팝업은 fixed로 우측 패널 옆에 표시 */}
        </div>
      </main>

      {/* ========== 3. 우측: 설비 정보 패널 (분석 모드 제거) ========== */}
      <aside className={`
        lg:relative lg:w-[260px] lg:flex lg:flex-col
        ${mobilePanel === 'info'
          ? 'fixed inset-x-0 bottom-[calc(2.75rem+2.75rem)] sm:bottom-[calc(2.75rem+2.75rem)] top-auto z-[50] max-h-[50vh] rounded-t-xl'
          : 'hidden lg:flex lg:flex-col'
        }
        bg-[#0a0e17] border-l border-white/[0.06] overflow-y-auto scrollbar-thin flex flex-col
      `}>
        {selectedEq ? (
          <div className="animate-slideInRight flex-shrink-0">
            {/* Header */}
            <div className="p-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{EQUIPMENT_ICONS[selectedEq.equipment_type]}</span>
                <div className="flex-1">
                  <div className="text-sm font-bold">{EQUIPMENT_NAMES_KR[selectedEq.equipment_id] || selectedEq.equipment_name}</div>
                  <div className="text-[12px] text-gray-500">{selectedEq.equipment_id} · {selectedEq.zone_id}</div>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  getStatus(selectedEq.equipment_id) === 'critical' ? 'bg-red-500/20 text-red-400' :
                  getStatus(selectedEq.equipment_id) === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {getStatus(selectedEq.equipment_id) === 'critical' ? '이상' :
                   getStatus(selectedEq.equipment_id) === 'warning' ? '경고' : '정상'}
                </span>
              </div>
            </div>

            {/* 설비 자산 정보 */}
            {EQUIPMENT_SPECS[selectedEq.equipment_id] && (
              <div className="p-3 border-b border-white/[0.06]">
                <div className="text-[12px] text-gray-600 font-medium tracking-wider mb-2">설비 제원</div>
                <div className="space-y-1">
                  {EQUIPMENT_SPECS[selectedEq.equipment_id].items.map((spec) => (
                    <div key={spec.label} className="flex items-center justify-between text-[12px] py-1 px-2 rounded bg-white/[0.02]">
                      <span className="text-gray-500">{spec.label}</span>
                      <span className="text-gray-200 font-mono">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 센서 현재값 */}
            <div className="p-3 border-b border-white/[0.06]">
              <div className="text-[12px] text-gray-600 font-medium tracking-wider mb-2">센서 현재값</div>
              <div className="space-y-1.5">
                {selectedEq.sensors?.map((sensor: any) => {
                  const data = sensorData[sensor.sensor_id];
                  const isWarning = data?.label === 'WARNING';
                  const isAnomaly = data?.label === 'ANOMALY';
                  const th = sensor.threshold;
                  const val = data?.value;

                  // 임계치 기반 트렌드 계산
                  let trendText = '';
                  let trendColor = 'text-gray-500';
                  let gaugePercent = 50;
                  let indicatorColor = 'bg-emerald-500';
                  let normalLeft = 20;
                  let normalWidth = 60;

                  if (val != null && th) {
                    const nv = th.normal_value ?? 0;
                    const wl = th.warning_low ?? 0;
                    const wh = th.warning_high ?? 100;
                    const cl = th.critical_low ?? -20;
                    const ch = th.critical_high ?? 120;
                    const range = ch - cl;
                    const diff = val - nv;

                    trendText = diff >= 0 ? `▲+${Math.abs(diff).toFixed(1)}` : `▼-${Math.abs(diff).toFixed(1)}`;

                    if (val >= ch || val <= cl) {
                      trendColor = 'text-red-400';
                      indicatorColor = 'bg-red-500';
                    } else if (val >= wh || val <= wl) {
                      trendColor = 'text-amber-400';
                      indicatorColor = 'bg-amber-500';
                    } else if (diff >= 0) {
                      trendColor = 'text-emerald-400';
                    } else {
                      trendColor = 'text-blue-400';
                    }

                    if (range > 0) {
                      gaugePercent = Math.max(3, Math.min(97, ((val - cl) / range) * 100));
                      normalLeft = ((wl - cl) / range) * 100;
                      normalWidth = ((wh - wl) / range) * 100;
                    }
                  }

                  return (
                    <div key={sensor.sensor_id}
                      className={`text-[13px] py-1.5 px-2.5 rounded-lg ${
                        isAnomaly ? 'bg-red-500/10 border border-red-500/20' :
                        isWarning ? 'bg-amber-500/10 border border-amber-500/20' :
                        'bg-white/[0.03]'
                      }`}
                    >
                      {/* 센서명 + 값 + 트렌드 */}
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">{SENSOR_TYPE_KR[sensor.sensor_type] || sensor.sensor_type}</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-medium ${
                            isAnomaly ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-white'
                          }`}>
                            {data ? data.value.toFixed(2) : '—'}
                            <span className="text-gray-600 text-[9px] ml-1">{sensor.unit}</span>
                          </span>
                          {/* 트렌드 */}
                          {trendText && (
                            <span className={`text-[10px] font-mono font-semibold ${trendColor}`}>{trendText}</span>
                          )}
                        </div>
                      </div>
                      {/* 운전범위 게이지 바 */}
                      {val != null && th && (
                        <div className="relative w-full h-1.5 mt-1.5 rounded-full overflow-visible">
                          <div className="absolute inset-0 bg-white/[0.06] rounded-full" />
                          {/* 정상범위 영역 */}
                          <div
                            className="absolute top-0 h-full bg-emerald-500/20 rounded-full"
                            style={{ left: `${normalLeft}%`, width: `${normalWidth}%` }}
                          />
                          {/* 현재값 인디케이터 */}
                          <div
                            className={`absolute top-[-1.5px] w-[9px] h-[9px] rounded-full ${indicatorColor} border border-white/40 shadow-sm transition-all duration-500`}
                            style={{ left: `calc(${gaugePercent}% - 4.5px)` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
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
            <div className="text-[12px] text-gray-600 font-medium tracking-wider">
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
              <div className="text-center text-gray-600 text-[12px] py-4">알람 없음</div>
            ) : (
              alarms.slice(0, 30).map((alarm) => {
                const isAnomaly = alarm.label === 'ANOMALY';
                // 센서의 임계치에서 문제 원인 파악
                const alarmEqId = alarm.sensor_id.split('-').slice(0, 2).join('-');
                const alarmEq = equipment.find(e => e.equipment_id === alarmEqId);
                const alarmSensor = alarmEq?.sensors?.find((s: any) => s.sensor_id === alarm.sensor_id);
                const alarmTh = alarmSensor?.threshold;
                let problemDesc = isAnomaly ? '임계치 초과' : '경고 범위';
                if (alarm.value != null && alarmTh) {
                  if (alarm.value >= alarmTh.critical_high) problemDesc = '상한 위험 초과';
                  else if (alarm.value <= alarmTh.critical_low) problemDesc = '하한 위험 초과';
                  else if (alarm.value >= alarmTh.warning_high) problemDesc = '상한 경고';
                  else if (alarm.value <= alarmTh.warning_low) problemDesc = '하한 경고';
                }

                return (
                  <div
                    key={alarm.id}
                    className={`px-2.5 py-1.5 rounded-lg text-[12px] transition-all duration-300 group ${
                      !alarm.acknowledged
                        ? isAnomaly
                          ? 'bg-red-500/10 border border-red-500/20 animate-[blink_2s_ease-in-out_3]'
                          : 'bg-amber-500/10 border border-amber-500/20 animate-[blink_2s_ease-in-out_3]'
                        : 'bg-white/[0.02] border border-white/[0.04] opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        isAnomaly ? 'bg-red-500' : 'bg-amber-500'
                      } ${!alarm.acknowledged ? 'animate-pulse' : ''}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className={`font-medium truncate ${alarm.acknowledged ? 'text-gray-500' : 'text-white'}`}>
                            {sensorIdToKorean(alarm.sensor_id)}
                          </span>
                          <span className={`font-mono font-bold ${alarm.acknowledged ? 'text-gray-600' : isAnomaly ? 'text-red-400' : 'text-amber-400'}`}>
                            {alarm.value?.toFixed(1)}
                          </span>
                        </div>
                        {/* 문제 원인 + 단계 */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${
                            isAnomaly ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'
                          }`}>
                            {problemDesc}
                          </span>
                          <span className="text-gray-600 text-[9px]">{PHASE_KR[alarm.phase] || alarm.phase}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
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
                  </div>
                );
              })
            )}
          </div>
        </div>
      </aside>

      {/* ========== 이벤트 팝업 (우측 패널 옆, 드래그 가능) ========== */}
      {showEventPopup && eventContext && (() => {
        const isEmergency = eventContext.severity === 'CRITICAL' || eventContext.severity === 'EMERGENCY';
        const pos = eventPopupPos || getEventPopupDefaultPos();
        return (
          <div
            className="fixed z-50 w-[350px] animate-fadeIn"
            style={{ left: pos.x, top: pos.y, cursor: eventDragRef.current ? 'grabbing' : 'grab' }}
            onMouseDown={handleEventDragStart}
          >
            <div className={`bg-[#0a0e17]/95 backdrop-blur-xl border rounded-xl overflow-hidden shadow-2xl ${
              isEmergency ? 'border-red-500/40 shadow-red-500/20' : 'border-amber-500/30'
            }`}>
              {/* 상단 색상 바 */}
              <div className={`h-1 ${isEmergency ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-amber-500 to-amber-600'}`} />

              <div className="p-3">
                {/* 드래그 힌트 + 제목 */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-gray-600 text-[10px] tracking-widest cursor-grab">⠿</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                    isEmergency ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {SEVERITY_KR[eventContext.severity] || eventContext.severity}
                  </span>
                  <span className="text-[13px] font-bold text-white flex-1 truncate">
                    {(eventContext.trigger_equipment_id && EQUIPMENT_NAMES_KR[eventContext.trigger_equipment_id]) || eventContext.trigger_equipment_id || '설비'} 이상 감지
                  </span>
                  <button onClick={() => setShowEventPopup(false)} className="text-gray-500 hover:text-white p-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* 상태 정보 카드 */}
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  <div className="bg-white/[0.04] rounded-lg px-2 py-1.5 text-center">
                    <div className="text-gray-500 text-[8px]">시나리오</div>
                    <div className="text-white text-[11px] font-bold">{eventContext.scenario_id}</div>
                  </div>
                  <div className="bg-white/[0.04] rounded-lg px-2 py-1.5 text-center">
                    <div className="text-gray-500 text-[8px]">현재 단계</div>
                    <div className="text-amber-400 text-[11px] font-bold">{PHASE_KR[eventContext.current_phase] || eventContext.current_phase}</div>
                  </div>
                  <div className="bg-white/[0.04] rounded-lg px-2 py-1.5 text-center">
                    <div className="text-gray-500 text-[8px]">영향 설비</div>
                    <div className="text-yellow-400 text-[11px] font-bold">{eventContext.affected_equipment_ids?.length || 0}개</div>
                  </div>
                </div>

                {/* 영향 설비 목록 */}
                {eventContext.affected_equipment_ids && eventContext.affected_equipment_ids.length > 0 && (
                  <div className="bg-white/[0.03] rounded-lg px-2.5 py-1.5 text-[11px] mb-2">
                    <span className="text-gray-500">영향 범위: </span>
                    <span className="text-yellow-300">
                      {eventContext.affected_equipment_ids.map((id: string) => EQUIPMENT_NAMES_KR[id] || id).join(', ')}
                    </span>
                  </div>
                )}

                {/* KOGAS/KGS/이력/SOP 요약 */}
                {(eventContext.kogas_result || eventContext.kgs_results?.length || eventContext.recommended_sops?.length || eventContext.safetia_history?.length) ? (
                  <div className="space-y-1 mb-2">
                    {eventContext.kogas_result && (
                      <div className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-2.5 py-1.5 text-[11px]">
                        <span className="text-cyan-400 font-bold text-[9px] w-12 shrink-0">KOGAS</span>
                        <span className="text-white flex-1 truncate">{eventContext.kogas_result.fault_name}</span>
                        <span className="text-cyan-400 font-mono text-[9px]">{Math.round((eventContext.kogas_result.diagnosis_confidence || 0) * 100)}%</span>
                      </div>
                    )}
                    {eventContext.kgs_results && eventContext.kgs_results.length > 0 && (
                      <div className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-2.5 py-1.5 text-[11px]">
                        <span className="text-amber-400 font-bold text-[9px] w-12 shrink-0">KGS</span>
                        <span className="text-white">영향 {eventContext.kgs_results.length}개</span>
                        <span className="text-amber-400 font-mono text-[9px] ml-auto">최대 {Math.max(...eventContext.kgs_results.map((k: any) => k.impact_score))}점</span>
                      </div>
                    )}
                    {eventContext.safetia_history && eventContext.safetia_history.length > 0 && (
                      <div className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-2.5 py-1.5 text-[11px]">
                        <span className="text-purple-400 font-bold text-[9px] w-12 shrink-0">이력</span>
                        <span className="text-white flex-1 truncate">
                          {eventContext.safetia_history[0].past_incident_summary || '정비이력 있음'}
                        </span>
                        <span className="text-purple-400 font-mono text-[9px]">{eventContext.safetia_history.length}건</span>
                      </div>
                    )}
                    {eventContext.recommended_sops && eventContext.recommended_sops.length > 0 && (
                      <div className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-2.5 py-1.5 text-[11px]">
                        <span className="text-green-400 font-bold text-[9px] w-12 shrink-0">SOP</span>
                        <span className="text-white flex-1 truncate">{eventContext.recommended_sops[0].sop_name}</span>
                        <button
                          onClick={() => { setShowEventPopup(false); setShowSopPanel(true); }}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30"
                        >
                          실행
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mb-2 bg-white/[0.03] rounded-lg text-center py-2">
                    <div className="text-[9px] text-gray-500 animate-pulse">진단 데이터 수집 중...</div>
                  </div>
                )}

                {/* 모드 전환 버튼 */}
                <div className="flex gap-1">
                  {[
                    { label: '상태감시', path: '/anomaly' },
                    { label: '위험예측', path: '/risk' },
                    { label: '시뮬레이션', path: '/simulation' },
                    { label: 'SOP', action: 'sop' as const },
                    { label: '이력', path: '/history' },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      onClick={() => {
                        if ('action' in btn && btn.action === 'sop') {
                          setShowEventPopup(false);
                          setShowSopPanel(true);
                        } else if ('path' in btn && btn.path) {
                          setShowEventPopup(false);
                          window.location.href = btn.path;
                        }
                      }}
                      className="flex-1 text-center py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all text-[9px] text-gray-400 hover:text-cyan-400"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
