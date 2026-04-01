// 설비별 POI(Point of Interest) 라벨 — 3D 씬에서 바운딩박스 상단에 자동 배치
'use client';
import { useEffect, useState, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { VisualState } from '@/lib/constants';
import { computeTopCenter } from './equipmentUtils';

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

const STATUS_CONFIG: Record<VisualState, { label: string; color: string; bg: string; glow: string }> = {
  normal:    { label: '정상',  color: '#66BB6A', bg: 'rgba(16,24,32,0.88)', glow: 'none' },
  warning:   { label: '주의',  color: '#FFA726', bg: 'rgba(40,30,10,0.92)', glow: '0 0 12px rgba(255,167,38,0.4)' },
  critical:  { label: '위험',  color: '#FF5722', bg: 'rgba(40,15,10,0.92)', glow: '0 0 16px rgba(255,87,34,0.5)' },
  emergency: { label: '긴급',  color: '#FF1744', bg: 'rgba(50,10,10,0.92)', glow: '0 0 20px rgba(255,23,68,0.6)' },
  affected:  { label: '영향',  color: '#FFEE58', bg: 'rgba(40,35,10,0.92)', glow: '0 0 12px rgba(255,238,88,0.4)' },
  simTarget: { label: '대상',  color: '#E040FB', bg: 'rgba(30,15,40,0.92)', glow: '0 0 12px rgba(224,64,251,0.4)' },
};

interface SinglePOIProps {
  equipmentId: string;
  position: [number, number, number];
  state: VisualState;
  selected?: boolean;
  onClick?: () => void;
  sensorValue?: { value: number; unit: string } | null;
}

function SinglePOI({ equipmentId, position, state, selected, onClick, sensorValue }: SinglePOIProps) {
  const cfg = STATUS_CONFIG[state];
  const isNormal = state === 'normal';
  const krName = EQUIPMENT_NAMES_KR[equipmentId] || equipmentId;

  return (
    <Html
      position={position}
      center
      distanceFactor={180}
      occlude={false}
      style={{ pointerEvents: 'auto' }}
    >
      <div
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        style={{
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transform: 'translateY(-100%)',
          userSelect: 'none',
        }}
      >
        {/* 수직 연결선 */}
        <div style={{
          width: 1.5,
          height: 28,
          background: selected
            ? 'linear-gradient(to bottom, #38bdf8, rgba(56,189,248,0.3))'
            : isNormal
              ? 'linear-gradient(to bottom, rgba(255,255,255,0.5), rgba(255,255,255,0.1))'
              : `linear-gradient(to bottom, ${cfg.color}, rgba(255,255,255,0.1))`,
          borderRadius: 1,
        }} />

        {/* 라벨 카드 */}
        <div
          style={{
            background: selected ? 'rgba(14,165,233,0.2)' : cfg.bg,
            border: `1.5px solid ${selected ? '#38bdf8' : isNormal ? 'rgba(255,255,255,0.15)' : cfg.color}`,
            borderRadius: 8,
            padding: '4px 10px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(8px)',
            boxShadow: selected ? '0 0 12px rgba(56,189,248,0.4)' : !isNormal ? cfg.glow : '0 2px 8px rgba(0,0,0,0.3)',
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                width: 7, height: 7, borderRadius: '50%',
                background: cfg.color,
                boxShadow: isNormal ? 'none' : `0 0 6px ${cfg.color}`,
                animation: state === 'critical' || state === 'emergency' ? 'poipulse 1s infinite' : 'none',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.95)', fontWeight: 600, letterSpacing: 0.3 }}>
              {krName}
            </span>
            {!isNormal && (
              <span style={{
                fontSize: 9, color: cfg.color, fontWeight: 700,
                padding: '1px 4px', borderRadius: 3, background: `${cfg.color}15`,
              }}>
                {cfg.label}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9 }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{equipmentId}</span>
            {sensorValue && sensorValue.value !== undefined && (
              <span style={{
                color: state === 'critical' || state === 'emergency' ? cfg.color : '#06b6d4',
                fontFamily: 'monospace', fontWeight: 600,
              }}>
                {sensorValue.value.toFixed(1)}{sensorValue.unit}
              </span>
            )}
          </div>
        </div>
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
}

export function EquipmentPOIs({ equipment, equipmentStates, selectedId, onSelect, sensorData }: EquipmentPOIsProps) {
  const { scene } = useThree();
  const [positions, setPositions] = useState<Record<string, [number, number, number]>>({});
  const computedRef = useRef(false);

  // 씬 로드 후 바운딩박스에서 POI 위치 계산 (1회)
  useEffect(() => {
    if (computedRef.current || equipment.length === 0) return;

    // GLB 로드 완료 대기 (약간의 딜레이)
    const timer = setTimeout(() => {
      const newPositions: Record<string, [number, number, number]> = {};
      for (const eq of equipment) {
        const pos = computeTopCenter(scene, eq.equipment_id);
        if (pos) {
          newPositions[eq.equipment_id] = pos;
        }
      }
      if (Object.keys(newPositions).length > 0) {
        setPositions(newPositions);
        computedRef.current = true;
      }
    }, 2000); // GLB 로드 + Draco 디코딩 대기

    return () => clearTimeout(timer);
  }, [scene, equipment]);

  return (
    <>
      {equipment.map((eq) => {
        const pos = positions[eq.equipment_id];
        if (!pos) return null;

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
          />
        );
      })}
    </>
  );
}
