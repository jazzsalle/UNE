// Top View (2D) 카메라 전환 — 설비를 위에서 내려다보는 정사영 뷰
'use client';
import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import gsap from 'gsap';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { computeEquipmentBBox } from './equipmentUtils';

// 전체 설비 ID 목록 (TERRAIN/GROUND 제외)
const ALL_EQUIPMENT_IDS = [
  'SHP-001', 'ARM-101', 'TK-101', 'TK-102', 'BOG-201',
  'PMP-301', 'VAP-401', 'REL-701', 'VAL-601', 'VAL-602', 'PIP-501',
];

interface TopViewSwitcherProps {
  /** 프레이밍할 설비 ID 목록 (없으면 전체 설비 뷰) */
  equipmentIds?: string[] | null;
}

export function TopViewSwitcher({ equipmentIds }: TopViewSwitcherProps) {
  const { camera, scene, controls, size: canvasSize } = useThree();
  const applied = useRef(false);
  const prevKey = useRef<string>('');

  useEffect(() => {
    const key = equipmentIds?.sort().join(',') || '__all__';
    // 이미 같은 설비 그룹으로 적용했으면 스킵
    if (applied.current && key === prevKey.current) return;

    const orbitControls = controls as unknown as OrbitControlsImpl;

    const applyTopView = () => {
      // 프레이밍 대상 바운딩박스 계산
      const unionBox = new THREE.Box3();
      const targetIds = (equipmentIds && equipmentIds.length > 0) ? equipmentIds : ALL_EQUIPMENT_IDS;

      let found = 0;
      for (const eqId of targetIds) {
        const box = computeEquipmentBBox(scene, eqId);
        if (box) { unionBox.union(box); found++; }
      }
      if (found === 0) return false;

      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      unionBox.getCenter(center);
      unionBox.getSize(size);

      // 캔버스 종횡비를 고려하여 카메라 높이 결정
      const aspect = canvasSize.width / canvasSize.height;
      const fovRad = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
      const padding = 1.15; // 여유 15%

      // 수직 FOV 기준: Z 방향 스팬이 화면 높이에 맞도록
      // 수평 FOV 기준: X 방향 스팬이 화면 너비에 맞도록
      const spanX = size.x * padding;
      const spanZ = size.z * padding;

      // 수직 FOV로 Z 스팬을 맞추는 데 필요한 거리
      const distForZ = (spanZ / 2) / Math.tan(fovRad / 2);
      // 수평 FOV로 X 스팬을 맞추는 데 필요한 거리
      const hFov = 2 * Math.atan(Math.tan(fovRad / 2) * aspect);
      const distForX = (spanX / 2) / Math.tan(hFov / 2);

      // 둘 중 큰 값 사용 (모든 설비가 화면에 들어오도록)
      const dist = Math.max(distForZ, distForX);

      const targetPos = new THREE.Vector3(center.x, center.y, center.z);
      const cameraPos = new THREE.Vector3(center.x, center.y + dist, center.z + 0.01); // 약간 z 오프셋으로 업벡터 안정화

      gsap.to(camera.position, {
        x: cameraPos.x,
        y: cameraPos.y,
        z: cameraPos.z,
        duration: 0.8,
        ease: 'power2.inOut',
      });

      if (orbitControls) {
        // Top View에서 회전 제한
        gsap.to(orbitControls.target, {
          x: targetPos.x,
          y: targetPos.y,
          z: targetPos.z,
          duration: 0.8,
          ease: 'power2.inOut',
          onUpdate: () => orbitControls.update(),
          onComplete: () => {
            // 회전 제한: 위에서 내려다보는 뷰 유지
            orbitControls.minPolarAngle = 0;
            orbitControls.maxPolarAngle = 0.1; // 거의 수직
            orbitControls.update();
          },
        });
      }

      applied.current = true;
      prevKey.current = key;
      return true;
    };

    if (!applyTopView()) {
      // GLB 아직 로드 안됐을 때 재시도
      const timer = setTimeout(applyTopView, 1000);
      return () => clearTimeout(timer);
    }

    // cleanup: 3D 모드로 돌아갈 때 회전 제한 해제
    return () => {
      if (orbitControls) {
        orbitControls.minPolarAngle = 0;
        orbitControls.maxPolarAngle = Math.PI;
      }
      applied.current = false;
    };
  }, [equipmentIds, camera, scene, controls, canvasSize]);

  return null;
}
