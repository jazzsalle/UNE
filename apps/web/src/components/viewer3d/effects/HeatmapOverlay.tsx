// ref: CLAUDE.md §5.7.4 — 위험 반경 히트맵 오버레이
'use client';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface HeatmapOverlayProps {
  position: [number, number, number];
  radius: number;       // impact_score 비례
  intensity?: number;
  visible?: boolean;
}

export function HeatmapOverlay({ position, radius, intensity = 0.5, visible = true }: HeatmapOverlayProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // 방사형 그라데이션 텍스처 생성
  const texture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(239, 68, 68, 0.85)');     // 중심: 적색
    gradient.addColorStop(0.25, 'rgba(249, 115, 22, 0.65)'); // 주황
    gradient.addColorStop(0.5, 'rgba(234, 179, 8, 0.45)');   // 노랑
    gradient.addColorStop(0.75, 'rgba(34, 197, 94, 0.25)');  // 녹색
    gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');        // 투명

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime();
      meshRef.current.scale.setScalar(1 + Math.sin(t * 0.5) * 0.03);
    }
  });

  if (!visible) return null;

  return (
    <mesh
      ref={meshRef}
      position={[position[0], 0.5, position[2]]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <circleGeometry args={[radius, 64]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={intensity}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
