// 위험예측 모드 전용 POI — 설비명 + 위험 요약 표시
'use client';
import { useEffect, useState, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { computeTopCenter } from '../viewer3d/equipmentUtils';

const EQUIPMENT_NAMES_KR: Record<string, string> = {
  'SHP-001': 'LH2 운반선',
  'ARM-101': '로딩암',
  'TK-101':  '저장탱크 #1',
  'TK-102':  '저장탱크 #2',
  'BOG-201': 'BOG 압축기',
  'PMP-301': '이송펌프',
  'VAP-401': '기화기',
  'REL-701': '재액화기',
  'VAL-601': '배출설비 #1',
  'VAL-602': '배출설비 #2',
  'PIP-501': '메인배관',
};

const RISK_LEVEL_KR: Record<string, string> = {
  CRITICAL: '위험',
  HIGH: '높음',
  WARNING: '경고',
  MEDIUM: '보통',
  LOW: '낮음',
};

interface KgsResult {
  trigger_equipment_id: string;
  affected_equipment_id: string;
  impact_score: number;
  risk_level: string;
  impact_type: string;
  recommended_action?: string;
  predicted_after_sec?: number | null;
}

interface RiskPOIsProps {
  kgsResults: KgsResult[];
  onNodeClick?: (id: string) => void;
}

function RiskPOI({ equipmentId, position, data, onClick }: {
  equipmentId: string;
  position: [number, number, number];
  data: { score: number; risk: string; type: string; action?: string; afterSec?: number | null };
  onClick?: () => void;
}) {
  const isTrigger = data.type === 'trigger';
  const borderColor = isTrigger ? '#FF5722' : data.score >= 70 ? '#FFA726' : '#FFEE58';
  const bgColor = isTrigger ? 'rgba(50,15,10,0.92)' : 'rgba(40,30,10,0.92)';

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
        <div
          style={{
            background: bgColor,
            border: `1.5px solid ${borderColor}`,
            borderRadius: 8,
            padding: '5px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(8px)',
            boxShadow: `0 0 14px ${borderColor}50`,
            maxWidth: 180,
          }}
        >
          {/* 설비명 + 점수 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: borderColor,
              boxShadow: `0 0 6px ${borderColor}`,
              animation: isTrigger ? 'riskpulse 1s infinite' : 'none',
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>
              {EQUIPMENT_NAMES_KR[equipmentId] || equipmentId}
            </span>
            <span style={{
              fontSize: 9, color: borderColor, fontWeight: 700,
              padding: '1px 5px', borderRadius: 3, background: `${borderColor}20`,
            }}>
              {data.score}점
            </span>
          </div>

          {/* 위험 요약 */}
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', lineHeight: 1.3 }}>
            {isTrigger ? (
              <span style={{ color: '#FF5722' }}>
                ⚠ 트리거 설비 · {RISK_LEVEL_KR[data.risk] || data.risk}
              </span>
            ) : (
              <span>
                영향도 {RISK_LEVEL_KR[data.risk] || data.risk}
                {data.afterSec != null && ` · ${Math.round(data.afterSec / 60)}분 후 전파`}
              </span>
            )}
          </div>

          {/* 권고 조치 (있으면 한 줄) */}
          {data.action && (
            <div style={{
              fontSize: 8, color: 'rgba(255,255,255,0.5)',
              overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', maxWidth: 160,
            }}>
              💡 {data.action}
            </div>
          )}
        </div>

        {/* 수직 연결선 */}
        <div style={{
          width: 1.5, height: 24,
          background: `linear-gradient(to bottom, rgba(255,255,255,0.1), ${borderColor})`,
          borderRadius: 1,
        }} />
      </div>
      <style>{`
        @keyframes riskpulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>
    </Html>
  );
}

export function RiskPOIs({ kgsResults, onNodeClick }: RiskPOIsProps) {
  const { scene } = useThree();
  const [positions, setPositions] = useState<Record<string, [number, number, number]>>({});
  const computedRef = useRef(false);

  // 설비별 위험 데이터 집계
  const riskData = new Map<string, { score: number; risk: string; type: string; action?: string; afterSec?: number | null }>();
  for (const r of kgsResults) {
    if (!riskData.has(r.trigger_equipment_id) || r.impact_type === 'PRIMARY_EVENT') {
      riskData.set(r.trigger_equipment_id, {
        score: r.impact_score,
        risk: r.risk_level,
        type: 'trigger',
        action: r.recommended_action,
      });
    }
    if (r.trigger_equipment_id !== r.affected_equipment_id) {
      riskData.set(r.affected_equipment_id, {
        score: r.impact_score,
        risk: r.risk_level,
        type: 'affected',
        action: r.recommended_action,
        afterSec: r.predicted_after_sec,
      });
    }
  }

  useEffect(() => {
    if (computedRef.current || kgsResults.length === 0) return;
    const timer = setTimeout(() => {
      const newPositions: Record<string, [number, number, number]> = {};
      for (const eqId of riskData.keys()) {
        const pos = computeTopCenter(scene, eqId);
        if (pos) newPositions[eqId] = pos;
      }
      if (Object.keys(newPositions).length > 0) {
        setPositions(newPositions);
        computedRef.current = true;
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [scene, kgsResults.length]);

  // kgsResults가 리셋되면 다시 계산 가능하도록
  useEffect(() => {
    if (kgsResults.length === 0) {
      computedRef.current = false;
      setPositions({});
    }
  }, [kgsResults.length]);

  if (kgsResults.length === 0) return null;

  return (
    <>
      {Array.from(riskData.entries()).map(([eqId, data]) => {
        const pos = positions[eqId];
        if (!pos) return null;
        return (
          <RiskPOI
            key={eqId}
            equipmentId={eqId}
            position={pos}
            data={data}
            onClick={() => onNodeClick?.(eqId)}
          />
        );
      })}
    </>
  );
}
