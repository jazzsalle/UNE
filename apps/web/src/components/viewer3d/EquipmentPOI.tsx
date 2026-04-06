// 설비별 POI(Point of Interest) 라벨 — 3D 씬에서 바운딩박스 상단에 자동 배치
// 운전범위 게이지 바 + 트렌드 표시 포함
'use client';
import { useEffect, useState, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { VisualState } from '@/lib/constants';
import { computeTopCenter, findEquipmentObject } from './equipmentUtils';

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

const STATUS_CONFIG: Record<VisualState, { label: string; color: string; bg: string; glow: string }> = {
  normal:    { label: '정상',  color: '#66BB6A', bg: 'rgba(16,24,32,0.88)', glow: 'none' },
  warning:   { label: '주의',  color: '#FFA726', bg: 'rgba(40,30,10,0.92)', glow: '0 0 12px rgba(255,167,38,0.4)' },
  critical:  { label: '위험',  color: '#FF5722', bg: 'rgba(40,15,10,0.92)', glow: '0 0 16px rgba(255,87,34,0.5)' },
  emergency: { label: '긴급',  color: '#FF1744', bg: 'rgba(50,10,10,0.92)', glow: '0 0 20px rgba(255,23,68,0.6)' },
  affected:  { label: '영향',  color: '#FFEE58', bg: 'rgba(40,35,10,0.92)', glow: '0 0 12px rgba(255,238,88,0.4)' },
  simTarget: { label: '대상',  color: '#E040FB', bg: 'rgba(30,15,40,0.92)', glow: '0 0 12px rgba(224,64,251,0.4)' },
};

// LOD 단계: 카메라 거리에 따라 표시 수준 결정
type LODLevel = 'near' | 'mid' | 'far' | 'hidden';
const LOD_THRESHOLDS = { near: 250, mid: 500, far: 800 };

function getLODLevel(distance: number, isAlert: boolean): LODLevel {
  const boost = isAlert ? 1.5 : 1.0;
  if (distance < LOD_THRESHOLDS.near * boost) return 'near';
  if (distance < LOD_THRESHOLDS.mid * boost) return 'mid';
  if (distance < LOD_THRESHOLDS.far * boost) return 'far';
  return 'hidden';
}

// 센서 데이터 + 임계치에서 게이지 정보 계산
interface GaugeInfo {
  value: number;
  unit: string;
  normalValue: number;
  warningLow: number;
  warningHigh: number;
  criticalLow: number;
  criticalHigh: number;
  /** 0~100 gauge position */
  gaugePercent: number;
  /** 정상범위 게이지 시작(%) */
  normalLeft: number;
  /** 정상범위 게이지 너비(%) */
  normalWidth: number;
  diff: number;
  trendText: string;
  trendColor: string;
  rangeStatus: '정상범위' | '주의' | '위험';
  indicatorColor: string;
}

function computeGauge(value: number, unit: string, threshold: any): GaugeInfo | null {
  if (!threshold) return null;
  const nv = threshold.normal_value ?? 0;
  const wl = threshold.warning_low ?? 0;
  const wh = threshold.warning_high ?? 100;
  const cl = threshold.critical_low ?? -20;
  const ch = threshold.critical_high ?? 120;
  const range = ch - cl;

  let rangeStatus: GaugeInfo['rangeStatus'] = '정상범위';
  let indicatorColor = '#66BB6A';
  if (value >= ch || value <= cl) {
    rangeStatus = '위험';
    indicatorColor = '#FF5722';
  } else if (value >= wh || value <= wl) {
    rangeStatus = '주의';
    indicatorColor = '#FFA726';
  }

  const diff = value - nv;
  let trendColor = '#9ca3af'; // gray
  if (value >= wh || value <= wl) {
    trendColor = '#FF5722'; // red
  } else if (diff >= 0) {
    trendColor = '#66BB6A'; // green
  } else {
    trendColor = '#60a5fa'; // blue
  }
  const trendText = diff >= 0 ? `▲+${Math.abs(diff).toFixed(1)}` : `▼-${Math.abs(diff).toFixed(1)}`;

  const gaugePercent = range > 0 ? Math.max(3, Math.min(97, ((value - cl) / range) * 100)) : 50;
  const normalLeft = range > 0 ? ((wl - cl) / range) * 100 : 20;
  const normalWidth = range > 0 ? ((wh - wl) / range) * 100 : 60;

  return {
    value, unit, normalValue: nv,
    warningLow: wl, warningHigh: wh, criticalLow: cl, criticalHigh: ch,
    gaugePercent, normalLeft, normalWidth,
    diff, trendText, trendColor, rangeStatus, indicatorColor,
  };
}

interface SinglePOIProps {
  equipmentId: string;
  position: [number, number, number];
  state: VisualState;
  selected?: boolean;
  onClick?: () => void;
  /** 대표 센서 데이터 (첫 번째 센서) */
  sensorValue?: { value: number; unit: string } | null;
  /** 대표 센서 임계치 */
  sensorThreshold?: any;
  forceLOD?: LODLevel;
}

function SinglePOI({ equipmentId, position, state, selected, onClick, sensorValue, sensorThreshold, forceLOD }: SinglePOIProps) {
  const cfg = STATUS_CONFIG[state];
  const isNormal = state === 'normal';
  const isAlert = !isNormal;
  const krName = EQUIPMENT_NAMES_KR[equipmentId] || equipmentId;
  const { camera } = useThree();
  const [computedLod, setComputedLod] = useState<LODLevel>('near');
  const lod = forceLOD || computedLod;

  useFrame(() => {
    if (forceLOD) return;
    const dist = camera.position.distanceTo(new THREE.Vector3(...position));
    const newLod = getLODLevel(dist, isAlert || !!selected);
    if (newLod !== computedLod) setComputedLod(newLod);
  });

  if (lod === 'hidden') return null;

  const scale = lod === 'near' ? 1.0 : lod === 'mid' ? 0.85 : 0.6;

  // 게이지 정보 계산
  const gauge = sensorValue && sensorThreshold
    ? computeGauge(sensorValue.value, sensorValue.unit, sensorThreshold)
    : null;

  return (
    <Html
      position={position}
      center
      distanceFactor={300}
      occlude={false}
      zIndexRange={[10, 0]}
      style={{ pointerEvents: lod === 'far' ? 'none' : 'auto' }}
    >
      <div
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        style={{
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transform: `translateY(-100%) scale(${scale})`,
          transformOrigin: 'bottom center',
          userSelect: 'none',
          transition: 'transform 0.3s ease, opacity 0.3s ease',
          opacity: lod === 'far' ? 0.7 : 1,
        }}
      >
        {/* 라벨 카드 */}
        <div
          style={{
            background: selected ? 'rgba(14,165,233,0.2)' : cfg.bg,
            border: `2.5px solid ${selected ? '#38bdf8' : isNormal ? 'rgba(255,255,255,0.18)' : cfg.color}`,
            borderRadius: 12,
            padding: lod === 'far' ? '6px 10px' : '8px 14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(8px)',
            boxShadow: selected ? '0 0 16px rgba(56,189,248,0.5)' : !isNormal ? cfg.glow : '0 2px 10px rgba(0,0,0,0.4)',
            transition: 'all 0.3s ease',
            minWidth: lod === 'near' && gauge ? 140 : undefined,
          }}
        >
          {/* Row 1: 상태점 + 설비명 + 상태배지 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 10, height: 10, borderRadius: '50%',
                background: cfg.color,
                boxShadow: isNormal ? 'none' : `0 0 8px ${cfg.color}`,
                animation: state === 'critical' || state === 'emergency' ? 'poipulse 1s infinite' : 'none',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.95)', fontWeight: 700, letterSpacing: 0.3 }}>
              {krName}
            </span>
            {isAlert && (
              <span style={{
                fontSize: 13, color: cfg.color, fontWeight: 700,
                padding: '1px 7px', borderRadius: 5, background: `${cfg.color}22`,
              }}>
                {cfg.label}
              </span>
            )}
          </div>

          {/* Row 2: 센서값 + 트렌드 (near/mid에서만) */}
          {lod !== 'far' && sensorValue && sensorValue.value !== undefined && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 14 }}>
              <span style={{
                color: isAlert ? cfg.color : '#06b6d4',
                fontFamily: 'monospace', fontWeight: 700, fontSize: 16,
              }}>
                {sensorValue.value.toFixed(1)}
                <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 2 }}>{sensorValue.unit}</span>
              </span>
              {gauge && (
                <span style={{ fontSize: 11, fontWeight: 600, color: gauge.trendColor }}>
                  {gauge.trendText}
                </span>
              )}
              {gauge && (
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: gauge.rangeStatus === '위험' ? '#FF5722' : gauge.rangeStatus === '주의' ? '#FFA726' : '#66BB6A',
                }}>
                  {gauge.rangeStatus}
                </span>
              )}
            </div>
          )}

          {/* Row 3: 운전범위 게이지 바 (near에서만) */}
          {lod === 'near' && gauge && (
            <div style={{ width: '100%', position: 'relative', height: 6, marginTop: 2 }}>
              {/* 배경 트랙 */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 6,
                background: 'rgba(255,255,255,0.08)', borderRadius: 3,
              }} />
              {/* 정상범위 (녹색 영역) */}
              <div style={{
                position: 'absolute', top: 0, height: 6, borderRadius: 3,
                background: 'rgba(102,187,106,0.25)',
                left: `${gauge.normalLeft}%`,
                width: `${gauge.normalWidth}%`,
              }} />
              {/* 현재값 인디케이터 */}
              <div style={{
                position: 'absolute', top: -2,
                left: `calc(${gauge.gaugePercent}% - 5px)`,
                width: 10, height: 10, borderRadius: '50%',
                background: gauge.indicatorColor,
                border: '2px solid rgba(255,255,255,0.5)',
                boxShadow: `0 0 6px ${gauge.indicatorColor}`,
                transition: 'left 0.5s ease',
              }} />
            </div>
          )}
        </div>

        {/* 수직 연결선 */}
        <div style={{
          width: 2,
          height: lod === 'far' ? 16 : 28,
          background: selected
            ? 'linear-gradient(to bottom, rgba(56,189,248,0.3), #38bdf8)'
            : isNormal
              ? 'linear-gradient(to bottom, rgba(255,255,255,0.1), rgba(255,255,255,0.5))'
              : `linear-gradient(to bottom, rgba(255,255,255,0.1), ${cfg.color})`,
          borderRadius: 1,
        }} />
      </div>
      <style>{`
        @keyframes poipulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>
    </Html>
  );
}

interface EquipmentPOIsProps {
  equipment: Array<{ equipment_id: string; equipment_name: string; sensors?: any[] }>;
  equipmentStates: Record<string, VisualState>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  sensorData?: Record<string, any>;
  forceLOD?: LODLevel;
}

// 선박처럼 움직이는 설비의 POI를 매 프레임 추적
const MOVING_EQUIPMENT = ['SHP-001'];

export function EquipmentPOIs({ equipment, equipmentStates, selectedId, onSelect, sensorData, forceLOD }: EquipmentPOIsProps) {
  const { scene } = useThree();
  const [positions, setPositions] = useState<Record<string, [number, number, number]>>({});
  const computedRef = useRef(false);
  const shipOffsetRef = useRef<[number, number, number] | null>(null);

  // 씬 로드 후 바운딩박스에서 POI 위치 계산 (1회)
  useEffect(() => {
    if (computedRef.current || equipment.length === 0) return;

    const timer = setTimeout(() => {
      const newPositions: Record<string, [number, number, number]> = {};
      for (const eq of equipment) {
        const pos = computeTopCenter(scene, eq.equipment_id);
        if (pos) {
          newPositions[eq.equipment_id] = pos;
          if (eq.equipment_id === 'SHP-001') {
            const shipObj = findEquipmentObject(scene, 'SHP-001');
            if (shipObj) {
              shipOffsetRef.current = [
                pos[0] - shipObj.position.x,
                pos[1] - shipObj.position.y,
                pos[2] - shipObj.position.z,
              ];
            }
          }
        }
      }
      if (Object.keys(newPositions).length > 0) {
        setPositions(newPositions);
        computedRef.current = true;
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [scene, equipment]);

  // 선박 POI 위치를 매 프레임 추적
  useFrame(() => {
    if (!shipOffsetRef.current) return;
    const shipObj = findEquipmentObject(scene, 'SHP-001');
    if (!shipObj) return;
    const offset = shipOffsetRef.current;
    const newPos: [number, number, number] = [
      shipObj.position.x + offset[0],
      shipObj.position.y + offset[1],
      shipObj.position.z + offset[2],
    ];
    const cur = positions['SHP-001'];
    if (cur && (Math.abs(cur[0] - newPos[0]) > 0.5 || Math.abs(cur[2] - newPos[2]) > 0.5)) {
      setPositions(prev => ({ ...prev, 'SHP-001': newPos }));
    }
  });

  return (
    <>
      {equipment.map((eq) => {
        const pos = positions[eq.equipment_id];
        if (!pos) return null;

        // 대표 센서 (첫 번째) — 값 + 임계치 전달
        const mainSensor = eq.sensors?.[0];
        const mainData = mainSensor && sensorData?.[mainSensor.sensor_id];
        return (
          <SinglePOI
            key={eq.equipment_id}
            equipmentId={eq.equipment_id}
            position={pos}
            state={equipmentStates[eq.equipment_id] || 'normal'}
            selected={selectedId === eq.equipment_id}
            onClick={() => onSelect(eq.equipment_id)}
            sensorValue={mainData ? { value: mainData.value, unit: mainSensor.unit } : null}
            sensorThreshold={mainSensor?.threshold}
            forceLOD={forceLOD}
          />
        );
      })}
    </>
  );
}
