// 카메라 컨트롤러 — 설비 바운딩박스 기반 동적 프레이밍
'use client';
import { useEffect, useRef, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import gsap from 'gsap';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

interface CameraControllerProps {
  targetEquipmentId: string | null;
}

// 씬에서 설비 EMPTY 오브젝트를 찾아 월드 바운딩박스 계산
function computeEquipmentBBox(scene: THREE.Object3D, equipmentId: string): THREE.Box3 | null {
  const obj = scene.getObjectByName(equipmentId);
  if (!obj) return null;

  const box = new THREE.Box3();
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.updateWorldMatrix(true, false);
      if (mesh.geometry) {
        mesh.geometry.computeBoundingBox();
        if (mesh.geometry.boundingBox) {
          const meshBox = mesh.geometry.boundingBox.clone();
          meshBox.applyMatrix4(mesh.matrixWorld);
          box.union(meshBox);
        }
      }
    }
  });

  if (box.isEmpty()) return null;
  return box;
}

// 바운딩박스에서 카메라가 객체 전체를 넉넉히 잡을 수 있는 위치 계산
function computeCameraFromBBox(
  box: THREE.Box3,
  camera: THREE.PerspectiveCamera
): { target: THREE.Vector3; position: THREE.Vector3 } {
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  // 객체의 최대 치수
  const maxDim = Math.max(size.x, size.y, size.z);
  // FOV 기반 거리 계산 (여유 1.8배)
  const fov = camera.fov * (Math.PI / 180);
  const dist = (maxDim * 1.8) / Math.tan(fov / 2);

  // ISO 뷰 방향: 우상단 대각선에서 바라봄 (45도 방위각, 35도 앙각)
  const azimuth = Math.PI / 4;   // 45도
  const elevation = Math.PI / 5.5; // ~33도

  const camX = center.x + dist * Math.cos(elevation) * Math.sin(azimuth);
  const camY = center.y + dist * Math.sin(elevation);
  const camZ = center.z + dist * Math.cos(elevation) * Math.cos(azimuth);

  // 카메라 Y가 반드시 양수 (지면 위)가 되도록 보장
  const minCamY = Math.max(center.y + maxDim * 0.5, 10);

  return {
    target: center,
    position: new THREE.Vector3(camX, Math.max(camY, minCamY), camZ),
  };
}

export function CameraController({ targetEquipmentId }: CameraControllerProps) {
  const { camera, scene, controls } = useThree();
  const prevId = useRef<string | null>(null);

  useEffect(() => {
    if (!targetEquipmentId || targetEquipmentId === prevId.current) return;
    prevId.current = targetEquipmentId;

    // overview는 고정 프리셋
    if (targetEquipmentId === 'overview') {
      animateCamera(
        camera,
        controls as unknown as OrbitControlsImpl,
        new THREE.Vector3(90, 20, 0),
        new THREE.Vector3(350, 300, 350)
      );
      return;
    }

    // 씬에서 설비 오브젝트의 바운딩박스 계산
    const box = computeEquipmentBBox(scene, targetEquipmentId);
    if (!box) {
      console.warn(`[Camera] Equipment "${targetEquipmentId}" bbox not found`);
      return;
    }

    const { target, position } = computeCameraFromBBox(box, camera as THREE.PerspectiveCamera);
    animateCamera(camera, controls as unknown as OrbitControlsImpl, target, position);
  }, [targetEquipmentId, camera, scene, controls]);

  return null;
}

function animateCamera(
  camera: THREE.Camera,
  orbitControls: OrbitControlsImpl | null,
  target: THREE.Vector3,
  position: THREE.Vector3,
) {
  gsap.to(camera.position, {
    x: position.x,
    y: position.y,
    z: position.z,
    duration: 0.8,
    ease: 'power2.inOut',
  });

  if (orbitControls) {
    gsap.to(orbitControls.target, {
      x: target.x,
      y: target.y,
      z: target.z,
      duration: 0.8,
      ease: 'power2.inOut',
      onUpdate: () => orbitControls.update(),
    });
  }
}

// Equipment ID → 카메라 이동 (이전 API 호환)
export function getPresetForEquipment(equipmentId: string): string {
  return equipmentId;  // 이제 equipment ID 자체가 식별자
}
