// deck.gl IconLayer 컨셉 — Three.js InstancedMesh 기반 설비 상태 아이콘
// 설비 위에 떠다니는 billboard 상태 인디케이터 (GPU 가속)
'use client';
import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { VisualState } from '@/lib/constants';
import { COLOR_MAP } from '@/lib/constants';

interface StatusIconsProps {
  /** Record<equipmentId, { position, state }> */
  items: { equipmentId: string; position: [number, number, number]; state: VisualState }[];
  visible?: boolean;
}

const ICON_SIZE = 5;
const FLOAT_HEIGHT = 12; // height above equipment center

/**
 * Renders floating status diamond icons above equipment.
 * Uses InstancedMesh for GPU-accelerated rendering of all icons in a single draw call.
 * Similar to deck.gl IconLayer but native Three.js.
 */
export function StatusIcons({ items, visible = true }: StatusIconsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Diamond shape (rotated square)
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const s = ICON_SIZE;
    shape.moveTo(0, s);
    shape.lineTo(s * 0.7, 0);
    shape.lineTo(0, -s);
    shape.lineTo(-s * 0.7, 0);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);

  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, []);

  const maxCount = 20; // Max equipment we'll ever show

  // Update instance matrices and colors
  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;

    for (let i = 0; i < maxCount; i++) {
      if (i < items.length && items[i].state !== 'normal') {
        const item = items[i];
        dummy.position.set(
          item.position[0],
          item.position[1] + FLOAT_HEIGHT,
          item.position[2],
        );
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, new THREE.Color(COLOR_MAP[item.state]));
      } else {
        // Hide unused instances
        dummy.scale.setScalar(0);
        dummy.position.set(0, -1000, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [items, dummy]);

  // Billboard effect: face camera + gentle float animation
  useFrame(({ camera, clock }) => {
    if (!meshRef.current || !visible) return;
    const t = clock.getElapsedTime();

    for (let i = 0; i < items.length; i++) {
      if (items[i].state === 'normal') continue;
      const item = items[i];

      // Float bob
      const bob = Math.sin(t * 2 + i * 1.5) * 1.5;

      dummy.position.set(
        item.position[0],
        item.position[1] + FLOAT_HEIGHT + bob,
        item.position[2],
      );

      // Face camera (billboard)
      dummy.quaternion.copy(camera.quaternion);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (!visible || items.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, maxCount]}
      frustumCulled={false}
    />
  );
}
