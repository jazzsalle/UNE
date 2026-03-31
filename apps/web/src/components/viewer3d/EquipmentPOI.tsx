// 설비별 POI(Point of Interest) 라벨 — 3D 씬 위에 HTML 오버레이
'use client';
import { Html } from '@react-three/drei';
import type { VisualState } from '@/lib/constants';

// 설비 위치 (EQUIPMENT_POSITIONS와 동일 — Three.js 좌표계)
const POI_POSITIONS: Record<string, [number, number, number]> = {
  'SHP-001': [303, 12.8, -96],
  'ARM-101': [272, 8.6, -121],
  'TK-101':  [145, 42, -208],   // 탱크 상단에 표시 (높이 올림)
  'TK-102':  [47, 42, -204],
  'BOG-201': [33, 41, -44],
  'PMP-301': [141, 35, 54],
  'VAP-401': [133, 40, 189],
  'REL-701': [144, 40, -59],
  'VAL-601': [-52, 50, -48],
  'VAL-602': [-3, 50, 177],
  'PIP-501': [60, 30, -8],
};

const STATUS_CONFIG: Record<VisualState, { label: string; color: string; bg: string }> = {
  normal:    { label: '정상',  color: '#66BB6A', bg: 'rgba(16,24,32,0.85)' },
  warning:   { label: '주의',  color: '#FFA726', bg: 'rgba(40,30,10,0.9)' },
  critical:  { label: '위험',  color: '#FF5722', bg: 'rgba(40,15,10,0.9)' },
  emergency: { label: '긴급',  color: '#FF1744', bg: 'rgba(50,10,10,0.9)' },
  affected:  { label: '영향',  color: '#FFEE58', bg: 'rgba(40,35,10,0.9)' },
  simTarget: { label: '대상',  color: '#E040FB', bg: 'rgba(30,15,40,0.9)' },
};

interface EquipmentPOIProps {
  equipmentId: string;
  name: string;
  state: VisualState;
  selected?: boolean;
  onClick?: () => void;
}

function SinglePOI({ equipmentId, name, state, selected, onClick }: EquipmentPOIProps) {
  const pos = POI_POSITIONS[equipmentId];
  if (!pos) return null;

  const cfg = STATUS_CONFIG[state];
  const isNormal = state === 'normal';

  return (
    <Html
      position={pos}
      center
      distanceFactor={200}
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
        {/* 핀 라인 */}
        <div style={{ width: 1, height: 14, background: selected ? '#38bdf8' : 'rgba(255,255,255,0.3)' }} />
        {/* 라벨 카드 */}
        <div
          style={{
            background: selected ? 'rgba(14,165,233,0.15)' : cfg.bg,
            border: `1px solid ${selected ? '#38bdf8' : isNormal ? 'rgba(255,255,255,0.12)' : cfg.color}`,
            borderRadius: 6,
            padding: '3px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(4px)',
            boxShadow: selected ? '0 0 8px rgba(56,189,248,0.3)' : 'none',
          }}
        >
          {/* 상태 도트 */}
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: cfg.color,
              boxShadow: isNormal ? 'none' : `0 0 4px ${cfg.color}`,
              animation: state === 'critical' || state === 'emergency' ? 'poipulse 1s infinite' : 'none',
            }}
          />
          {/* 설비명 */}
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.9)', fontWeight: 500, letterSpacing: 0.3 }}>
            {name}
          </span>
          {/* 상태 뱃지 (비정상 시) */}
          {!isNormal && (
            <span
              style={{
                fontSize: 9,
                color: cfg.color,
                fontWeight: 600,
                marginLeft: 2,
              }}
            >
              {cfg.label}
            </span>
          )}
        </div>
      </div>
      <style>{`
        @keyframes poipulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </Html>
  );
}

interface EquipmentPOIsProps {
  equipment: Array<{ equipment_id: string; equipment_name: string }>;
  equipmentStates: Record<string, VisualState>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function EquipmentPOIs({ equipment, equipmentStates, selectedId, onSelect }: EquipmentPOIsProps) {
  return (
    <>
      {equipment.map((eq) => {
        if (!POI_POSITIONS[eq.equipment_id]) return null;
        return (
          <SinglePOI
            key={eq.equipment_id}
            equipmentId={eq.equipment_id}
            name={eq.equipment_name}
            state={equipmentStates[eq.equipment_id] || 'normal'}
            selected={selectedId === eq.equipment_id}
            onClick={() => onSelect(eq.equipment_id)}
          />
        );
      })}
    </>
  );
}
