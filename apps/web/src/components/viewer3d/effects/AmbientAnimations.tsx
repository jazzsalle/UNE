// ref: CLAUDE.md §5.7, §9.2 — 상시 모니터링 애니메이션
// 선박 진입 움직임을 Three.js useFrame으로 제어 (로딩암 애니메이션 제외)
'use client';
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAmbientStore } from '@/hooks/useAmbientMonitor';
import { findEquipmentObject } from '../equipmentUtils';

interface AmbientAnimationsProps {
  scene: THREE.Group;
}

// 화면 밖 진입 오프셋 (선박이 X+방향에서 직선으로 들어옴)
const SHIP_ENTRY_OFFSET_X = 300;

export function AmbientAnimations({ scene }: AmbientAnimationsProps) {
  const shipOriginalPos = useRef<THREE.Vector3 | null>(null);
  const shipObj = useRef<THREE.Object3D | null>(null);
  const shipRotated = useRef(false);
  const initialized = useRef(false);

  // Find and initialize ship object
  useEffect(() => {
    if (!scene || initialized.current) return;

    const ship = findEquipmentObject(scene, 'SHP-001');

    if (ship) {
      shipObj.current = ship;
      shipOriginalPos.current = ship.position.clone();
      // 선박 180도 회전 (머리 방향 반전)
      if (!shipRotated.current) {
        ship.rotation.y += Math.PI;
        shipRotated.current = true;
      }
      // 즉시 화면 밖으로 이동 (첫 사이클 SHIP_APPROACH 대비)
      ship.position.x += SHIP_ENTRY_OFFSET_X;
    }
    initialized.current = true;

    return () => {
      // 언마운트 시 원래 위치 복원
      if (shipObj.current && shipOriginalPos.current) {
        shipObj.current.position.copy(shipOriginalPos.current);
        shipObj.current.rotation.z = 0;
        if (shipRotated.current) {
          shipObj.current.rotation.y -= Math.PI;
          shipRotated.current = false;
        }
      }
      initialized.current = false;
    };
  }, [scene]);

  useFrame(() => {
    // Read ambient state from Zustand (non-reactive, direct getState for perf)
    const state = useAmbientStore.getState();

    if (!state.active) {
      // 상시 모니터링 비활성 → 원래 위치 복원
      if (shipObj.current && shipOriginalPos.current) {
        shipObj.current.position.copy(shipOriginalPos.current);
        shipObj.current.rotation.z = 0;
      }
      return;
    }

    const now = Date.now();

    // ─── 선박 진입 애니메이션 ───
    if (shipObj.current && shipOriginalPos.current) {
      if (state.phase === 'IDLE') {
        const cycleTime = state.elapsedSec % 95;
        const fadeOut = Math.min((cycleTime - 90) / 5, 1);
        const eased = fadeOut * fadeOut;
        shipObj.current.position.x = shipOriginalPos.current.x + SHIP_ENTRY_OFFSET_X * eased;
        shipObj.current.position.z = shipOriginalPos.current.z;
      } else if (state.phase === 'SHIP_APPROACH') {
        const t = Math.min(state.shipProgress, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        shipObj.current.position.x = shipOriginalPos.current.x + SHIP_ENTRY_OFFSET_X * (1 - eased);
        shipObj.current.position.z = shipOriginalPos.current.z;
        shipObj.current.rotation.z = Math.sin(now * 0.002) * 0.005 * (1 - eased);
      } else {
        shipObj.current.position.x = shipOriginalPos.current.x;
        shipObj.current.position.z = shipOriginalPos.current.z;
        shipObj.current.rotation.z = Math.sin(now * 0.001) * 0.001;
      }
    }
  });

  return null;
}
