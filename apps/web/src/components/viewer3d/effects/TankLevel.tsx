// ref: CLAUDE.md §5.7.2 — 저장탱크 내부 레벨/압력 시각화
'use client';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface TankLevelProps {
  position: [number, number, number];
  tankHeight: number;
  tankRadius: number;
  level: number;        // 0~100%
  pressure: 'normal' | 'warning' | 'critical';
}

const PRESSURE_COLORS = {
  normal: '#06b6d4',
  warning: '#f97316',
  critical: '#ef4444',
};

export function TankLevel({ position, tankHeight, tankRadius, level, pressure }: TankLevelProps) {
  const liquidRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.MeshBasicMaterial>(null);

  const liquidHeight = (tankHeight * level) / 100;
  const liquidY = position[1] - tankHeight / 2 + liquidHeight / 2;

  useFrame(({ clock }) => {
    if (glowRef.current && pressure === 'critical') {
      const t = clock.getElapsedTime();
      glowRef.current.opacity = 0.15 + Math.sin(t * 4) * 0.1;
    }
  });

  const color = PRESSURE_COLORS[pressure];

  return (
    <group>
      {/* LH2 액면 */}
      <mesh position={[position[0], liquidY, position[2]]}>
        <cylinderGeometry args={[tankRadius * 0.9, tankRadius * 0.9, liquidHeight, 32]} />
        <meshStandardMaterial color="#06b6d4" transparent opacity={0.4} />
      </mesh>

      {/* 압력 글로우 (외벽) */}
      {pressure !== 'normal' && (
        <mesh position={position} scale={[1.05, 1.05, 1.05]}>
          <cylinderGeometry args={[tankRadius, tankRadius, tankHeight, 32]} />
          <meshBasicMaterial
            ref={glowRef}
            color={color}
            transparent
            opacity={0.15}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* 레벨 라벨 (평면) */}
      <mesh position={[position[0] + tankRadius + 3, position[1], position[2]]} rotation={[0, 0, 0]}>
        <planeGeometry args={[8, 4]} />
        <meshBasicMaterial color="#111827" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}
