// ref: CLAUDE.md §5.1, §5.2, §18 — 실제 GLB 모델 로딩 + Draco
'use client';
import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useGLTF, useProgress } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
// Draco: useGLTF 2nd arg=true enables auto Draco detection via drei
import { GlowEffect } from './effects/GlowEffect';
import { TankLevel } from './effects/TankLevel';
import { HeatmapOverlay } from './effects/HeatmapOverlay';
import { PropagationPath } from './effects/PropagationPath';
import { COLOR_MAP, type VisualState } from '@/lib/constants';

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

// ref: CLAUDE.md §5.5 — 카메라 프리셋에서 추출한 설비 위치 (이펙트용)
const EQUIPMENT_POSITIONS: Record<string, [number, number, number]> = {
  'SHP-001': [303, 12.8, -96], 'ARM-101': [272, 8.6, -121],
  'TK-101': [145, 22.4, -208], 'TK-102': [47, 22.4, -204],
  'BOG-201': [33, 21.1, -44], 'PMP-301': [141, 25.4, 54],
  'VAP-401': [133, 30.6, 189], 'REL-701': [144, 30.9, -59],
  'VAL-601': [-52, 39.8, -48], 'VAL-602': [-3, 39.8, 177],
  'PIP-501': [60, 24.3, -8],
};

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

      {showEffects && (
        <>
          {/* Glow for warning/critical equipment */}
          {Object.entries(equipmentStates).map(([eqId, state]) => {
            if (state === 'normal' || !EQUIPMENT_POSITIONS[eqId]) return null;
            return (
              <GlowEffect
                key={`glow-${eqId}`}
                position={EQUIPMENT_POSITIONS[eqId]}
                size={[15, 15, 15]}
                color={COLOR_MAP[state]}
                pulse={state === 'critical' || state === 'emergency'}
                intensity={state === 'emergency' ? 0.6 : 0.4}
              />
            );
          })}

          {/* Tank levels */}
          {Object.entries(defaultTankLevels).map(([tankId, data]) => (
            <TankLevel
              key={`tank-${tankId}`}
              position={EQUIPMENT_POSITIONS[tankId] || [0, 0, 0]}
              tankHeight={40}
              tankRadius={14}
              level={data.level}
              pressure={data.pressure}
            />
          ))}

          {/* Heatmap */}
          {heatmapTarget && EQUIPMENT_POSITIONS[heatmapTarget.equipmentId] && (
            <HeatmapOverlay
              position={EQUIPMENT_POSITIONS[heatmapTarget.equipmentId]}
              radius={heatmapTarget.radius}
            />
          )}

          {/* Propagation paths */}
          {propagationPaths.map((path, i) => {
            const fromPos = EQUIPMENT_POSITIONS[path.from];
            const toPos = EQUIPMENT_POSITIONS[path.to];
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
