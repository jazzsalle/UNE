// 설비 오브젝트 검색 유틸리티 — GLB 노드명 불일치 대응
// ARM-101 문제: GLB에 ARM-101(children=0)과 ARM-101001(실제 로딩암) 두 노드가 존재
// getObjectByName('ARM-101')이 빈 노드를 반환하므로 mesh 유무를 확인하고 fallback 처리
import * as THREE from 'three';

// equipment ID → mesh name 매핑 (fallback 검색용)
const EQUIPMENT_MESH_MAP: Record<string, string> = {
  'SHP-001': 'ship_carrier_001',
  'ARM-101': 'loading_arm_101',
  'TK-101':  'tank_101',
  'TK-102':  'tank_102',
  'BOG-201': 'bog_compressor_201',
  'PMP-301': 'pump_301',
  'VAP-401': 'vaporizer_401',
  'REL-701': 'reliquefier_701',
  'VAL-601': 'valve_station_601',
  'VAL-602': 'valve_station_602',
  'PIP-501': 'pipe_main_a',
};

function hasMeshDescendant(obj: THREE.Object3D): boolean {
  let found = false;
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) found = true;
  });
  return found;
}

/**
 * 씬에서 설비 오브젝트를 안전하게 찾는 함수.
 * 1차: equipmentId로 getObjectByName → mesh가 있으면 반환
 * 2차: 찾은 노드에 mesh가 없으면 mesh name으로 검색 → 그 부모 반환
 * 3차: equipmentId + "001" 등 suffix로 재시도
 */
export function findEquipmentObject(scene: THREE.Object3D, equipmentId: string): THREE.Object3D | null {
  // 1차: 직접 이름 검색
  const direct = scene.getObjectByName(equipmentId);
  if (direct && hasMeshDescendant(direct)) {
    return direct;
  }

  // 2차: mesh name으로 검색 → 부모를 설비 루트로 사용
  const meshName = EQUIPMENT_MESH_MAP[equipmentId];
  if (meshName) {
    const meshObj = scene.getObjectByName(meshName);
    if (meshObj) {
      // mesh의 부모가 실제 설비 루트 (예: ARM-101001)
      return meshObj.parent || meshObj;
    }
  }

  // 3차: suffix 패턴 시도 (ARM-101001 같은 경우)
  for (const suffix of ['001', '002', '01', '02']) {
    const alt = scene.getObjectByName(equipmentId + suffix);
    if (alt && hasMeshDescendant(alt)) {
      return alt;
    }
  }

  return null;
}

/**
 * 설비 월드 바운딩박스 계산
 */
export function computeEquipmentBBox(scene: THREE.Object3D, equipmentId: string): THREE.Box3 | null {
  const obj = findEquipmentObject(scene, equipmentId);
  if (!obj) return null;

  const box = new THREE.Box3();
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.updateWorldMatrix(true, false);
      if (mesh.geometry) {
        mesh.geometry.computeBoundingBox();
        if (mesh.geometry.boundingBox) {
          const mb = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
          box.union(mb);
        }
      }
    }
  });

  return box.isEmpty() ? null : box;
}

/**
 * 설비 중심 좌표 (캐싱)
 */
const cachedCenters: Record<string, [number, number, number]> = {};

export function computeEquipmentCenter(scene: THREE.Object3D, equipmentId: string): [number, number, number] | null {
  if (cachedCenters[equipmentId]) return cachedCenters[equipmentId];
  const box = computeEquipmentBBox(scene, equipmentId);
  if (!box) return null;
  const center = new THREE.Vector3();
  box.getCenter(center);
  cachedCenters[equipmentId] = [center.x, center.y, center.z];
  return cachedCenters[equipmentId];
}

/**
 * 설비 높이 (탱크 레벨용)
 */
export function computeEquipmentHeight(scene: THREE.Object3D, equipmentId: string): number {
  const box = computeEquipmentBBox(scene, equipmentId);
  if (!box) return 40;
  return box.max.y - box.min.y;
}

/**
 * 설비 반경 (탱크 레벨용)
 */
export function computeEquipmentRadius(scene: THREE.Object3D, equipmentId: string): number {
  const box = computeEquipmentBBox(scene, equipmentId);
  if (!box) return 14;
  const size = new THREE.Vector3();
  box.getSize(size);
  return Math.max(size.x, size.z) / 2;
}

/**
 * 설비 바운딩박스 상단 중심 (POI 배치용)
 */
export function computeTopCenter(scene: THREE.Object3D, equipmentId: string): [number, number, number] | null {
  const box = computeEquipmentBBox(scene, equipmentId);
  if (!box) return null;
  const center = new THREE.Vector3();
  box.getCenter(center);
  return [center.x, box.max.y + 5, center.z];
}
