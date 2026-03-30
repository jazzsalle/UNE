// ref: CLAUDE.md §5.7.3 — 설비 상태 글로우/아우라 효과
'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface GlowEffectProps {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  pulse?: boolean;
  intensity?: number;
}

export function GlowEffect({ position, size, color, pulse = false, intensity = 0.5 }: GlowEffectProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (materialRef.current && pulse) {
      const t = clock.getElapsedTime();
      materialRef.current.opacity = 0.3 + Math.sin(t * 3) * 0.2;
    }
  });

  return (
    <mesh ref={meshRef} position={position} scale={[1.08, 1.08, 1.08]}>
      <boxGeometry args={size} />
      <meshBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={intensity}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}
