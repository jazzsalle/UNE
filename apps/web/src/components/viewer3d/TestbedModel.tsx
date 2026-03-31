// ref: CLAUDE.md §5.1, §5.2, §18 — 실제 GLB 모델 로딩 + Draco
'use client';
import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { useGLTF, useProgress } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
// Draco: useGLTF 2nd arg=true enables auto Draco detection via drei
import { GlowEffect } from './effects/GlowEffect';
import { TankLevel } from './effects/TankLevel';
import { HeatmapOverlay } from './effects/HeatmapOverlay';
import { PropagationPath } from './effects/PropagationPath';
import { COLOR_MAP, type VisualState } from '@/lib/constants';
import { darkenTerrain } from './EnvironmentScene';

// ref: CLAUDE.md §5.2 — mesh-equipment 매핑
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

// 설비 위치 — 씬 로드 후 바운딩박스에서 동적 계산
const cachedPositions: Record<string, [number, number, number]> = {};

function computeEquipmentCenter(scene: THREE.Group, equipmentId: string): [number, number, number] | null {
  if (cachedPositions[equipmentId]) return cachedPositions[equipmentId];
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
          const mb = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
          box.union(mb);
        }
      }
    }
  });
  if (box.isEmpty()) return null;
  const center = new THREE.Vector3();
  box.getCenter(center);
  cachedPositions[equipmentId] = [center.x, center.y, center.z];
  return cachedPositions[equipmentId];
}

function computeEquipmentHeight(scene: THREE.Group, equipmentId: string): number {
  const obj = scene.getObjectByName(equipmentId);
  if (!obj) return 40;
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
  if (box.isEmpty()) return 40;
  return box.max.y - box.min.y;
}

function computeEquipmentRadius(scene: THREE.Group, equipmentId: string): number {
  const obj = scene.getObjectByName(equipmentId);
  if (!obj) return 14;
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
  if (box.isEmpty()) return 14;
  const size = new THREE.Vector3();
  box.getSize(size);
  return Math.max(size.x, size.z) / 2;
}

// Material cache — clone only once per mesh (ref: CLAUDE.md §15.1)
const clonedMaterials = new Map<string, THREE.Material | THREE.Material[]>();

function colorizeEquipment(scene: THREE.Group, equipmentId: string, state: VisualState) {
  // EMPTY 부모(설비 ID) → 자식 MESH
  const empty = scene.getObjectByName(equipmentId);
  if (!empty) return;

  empty.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const key = mesh.uuid;

    if (state === 'normal') {
      // Restore original
      const original = clonedMaterials.get(key);
      if (original) {
        mesh.material = original;
        clonedMaterials.delete(key);
      }
      return;
    }

    // Clone material once
    if (!clonedMaterials.has(key)) {
      clonedMaterials.set(key, mesh.material);
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(m => m.clone())
        : mesh.material.clone();
    }

    const color = COLOR_MAP[state];
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of materials) {
      if ((mat as THREE.MeshStandardMaterial).color) {
        (mat as THREE.MeshStandardMaterial).color.set(color);
        if ((mat as THREE.MeshStandardMaterial).emissive) {
          (mat as THREE.MeshStandardMaterial).emissive.set(color);
          (mat as THREE.MeshStandardMaterial).emissiveIntensity = 0.2;
        }
      }
    }
  });
}

interface TestbedModelProps {
  equipmentStates?: Record<string, VisualState>;
  onEquipmentClick?: (equipmentId: string) => void;
  showEffects?: boolean;
  tankLevels?: Record<string, { level: number; pressure: 'normal' | 'warning' | 'critical' }>;
  heatmapTarget?: { equipmentId: string; radius: number } | null;
  propagationPaths?: { from: string; to: string }[];
}

export function TestbedModel({
  equipmentStates = {}, onEquipmentClick, showEffects = true,
  tankLevels = {}, heatmapTarget = null, propagationPaths = [],
}: TestbedModelProps) {
  // useGLTF 2nd arg=true → auto Draco decoding (drei uses /draco/ path)
  const { scene } = useGLTF('/models/h2.glb', true);
  const sceneRef = useRef<THREE.Group>(null);
  const prevStates = useRef<Record<string, VisualState>>({});
  const [positionsReady, setPositionsReady] = useState(false);

  // Darken terrain + compute positions on initial load
  useEffect(() => {
    if (!scene) return;
    darkenTerrain(scene);
    // Compute equipment positions after load
    const timer = setTimeout(() => {
      for (const eqId of Object.keys(EQUIPMENT_MESH_MAP)) {
        computeEquipmentCenter(scene, eqId);
      }
      setPositionsReady(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [scene]);

  // Apply coloring when states change
  useEffect(() => {
    if (!scene) return;

    for (const [eqId, state] of Object.entries(equipmentStates)) {
      if (prevStates.current[eqId] !== state) {
        colorizeEquipment(scene, eqId, state);
      }
    }
    // Reset removed
    for (const eqId of Object.keys(prevStates.current)) {
      if (!equipmentStates[eqId] && prevStates.current[eqId] !== 'normal') {
        colorizeEquipment(scene, eqId, 'normal');
      }
    }
    prevStates.current = { ...equipmentStates };
  }, [scene, equipmentStates]);

  // Click handler
  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    let obj = e.object as THREE.Object3D;
    // Walk up to find EMPTY parent (equipment ID)
    while (obj.parent) {
      if (Object.keys(EQUIPMENT_MESH_MAP).includes(obj.name)) {
        onEquipmentClick?.(obj.name);
        return;
      }
      // Check if parent is an equipment ID
      if (obj.parent && Object.keys(EQUIPMENT_MESH_MAP).includes(obj.parent.name)) {
        onEquipmentClick?.(obj.parent.name);
        return;
      }
      obj = obj.parent;
    }
  }, [onEquipmentClick]);

  // Default tank levels
  const defaultTankLevels = {
    'TK-101': tankLevels['TK-101'] || { level: 65, pressure: 'normal' as const },
    'TK-102': tankLevels['TK-102'] || { level: 72, pressure: 'normal' as const },
  };

  return (
    <>
      <primitive ref={sceneRef} object={scene} onClick={handleClick} />

      {showEffects && positionsReady && (
        <>
          {/* Glow for warning/critical equipment */}
          {Object.entries(equipmentStates).map(([eqId, state]) => {
            if (state === 'normal') return null;
            const pos = computeEquipmentCenter(scene, eqId);
            if (!pos) return null;
            return (
              <GlowEffect
                key={`glow-${eqId}`}
                position={pos}
                size={[15, 15, 15]}
                color={COLOR_MAP[state]}
                pulse={state === 'critical' || state === 'emergency'}
                intensity={state === 'emergency' ? 0.6 : 0.4}
              />
            );
          })}

          {/* Tank levels */}
          {Object.entries(defaultTankLevels).map(([tankId, data]) => {
            const pos = computeEquipmentCenter(scene, tankId);
            if (!pos) return null;
            const h = computeEquipmentHeight(scene, tankId);
            const r = computeEquipmentRadius(scene, tankId);
            return (
              <TankLevel
                key={`tank-${tankId}`}
                position={pos}
                tankHeight={h}
                tankRadius={r}
                level={data.level}
                pressure={data.pressure}
              />
            );
          })}

          {/* Heatmap */}
          {heatmapTarget && (() => {
            const pos = computeEquipmentCenter(scene, heatmapTarget.equipmentId);
            return pos ? <HeatmapOverlay position={pos} radius={heatmapTarget.radius} /> : null;
          })()}

          {/* Propagation paths */}
          {propagationPaths.map((path, i) => {
            const fromPos = computeEquipmentCenter(scene, path.from);
            const toPos = computeEquipmentCenter(scene, path.to);
            if (!fromPos || !toPos) return null;
            return <PropagationPath key={`path-${i}`} from={fromPos} to={toPos} />;
          })}
        </>
      )}
    </>
  );
}

// Preload
useGLTF.preload('/models/h2.glb');

// ref: CLAUDE.md §5.6 — secondary_pump.glb (M-ANO용)
export function PumpDetailModel({ meshStates = {} }: { meshStates?: Record<string, string> }) {
  const { scene } = useGLTF('/models/secondary_pump.glb');
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    // Scale up — secondary_pump.glb is very small (ref: CLAUDE.md §5.6)
    clone.scale.setScalar(50);
    return clone;
  }, [scene]);

  // Apply mesh coloring
  useEffect(() => {
    clonedScene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const color = meshStates[mesh.name];
      if (color) {
        if (!Array.isArray(mesh.material)) {
          mesh.material = mesh.material.clone();
          (mesh.material as THREE.MeshStandardMaterial).color.set(color);
          (mesh.material as THREE.MeshStandardMaterial).emissive?.set(color);
          (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
        }
      }
    });
  }, [clonedScene, meshStates]);

  return <primitive object={clonedScene} />;
}

useGLTF.preload('/models/secondary_pump.glb');
