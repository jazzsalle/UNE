// Top View (2D) 카메라 전환 — 설비를 위에서 내려다보는 정사영 뷰
'use client';
import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import gsap from 'gsap';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { computeEquipmentBBox } from './equipmentUtils';

interface TopViewSwitcherProps {
  /** 프레이밍할 설비 ID 목록 (없으면 전체 뷰) */
  equipmentIds?: string[] | null;
}

export function TopViewSwitcher({ equipmentIds }: TopViewSwitcherProps) {
  const { camera, scene, controls } = useThree();
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

      if (equipmentIds && equipmentIds.length > 0) {
        let found = 0;
        for (const eqId of equipmentIds) {
          const box = computeEquipmentBBox(scene, eqId);
          if (box) { unionBox.union(box); found++; }
        }
        if (found === 0) return false;
      } else {
        // 전체 씬 바운딩박스 (CLAUDE.md 기준)
        unionBox.set(
          new THREE.Vector3(-165, -14, -337),
          new THREE.Vector3(335, 80, 401)
        );
      }

      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      unionBox.getCenter(center);
      unionBox.getSize(size);

      // Top View: 카메라를 바로 위에 배치, 여유 1.5배
      const maxSpan = Math.max(size.x, size.z) * 1.5;
      const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
      const dist = (maxSpan / 2) / Math.tan(fov / 2);

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
  }, [equipmentIds, camera, scene, controls]);

  return null;
}
