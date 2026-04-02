// ref: CLAUDE.md §5.1, §5.2, §18 — 실제 GLB 모델 로딩 + Draco
'use client';
import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { useGLTF, useProgress } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GlowEffect } from './effects/GlowEffect';
import { TankLevel } from './effects/TankLevel';
import { HeatmapOverlay } from './effects/HeatmapOverlay';
import { PropagationPath } from './effects/PropagationPath';
import { PipeFlowSystem } from './effects/PipeFlow';
import { COLOR_MAP, type VisualState } from '@/lib/constants';
import { darkenTerrain } from './EnvironmentScene';
import {
  findEquipmentObject,
  computeEquipmentCenter,
  computeEquipmentHeight,
  computeEquipmentRadius,
} from './equipmentUtils';

// ref: CLAUDE.md §5.2 — mesh-equipment 매핑 (클릭 핸들러용)
const EQUIPMENT_IDS = [
  'SHP-001', 'ARM-101', 'TK-101', 'TK-102', 'BOG-201',
  'PMP-301', 'VAP-401', 'REL-701', 'VAL-601', 'VAL-602', 'PIP-501',
];

// Material cache — clone only once per mesh (ref: CLAUDE.md §15.1)
const clonedMaterials = new Map<string, THREE.Material | THREE.Material[]>();

function colorizeEquipment(scene: THREE.Group, equipmentId: string, state: VisualState) {
  const empty = findEquipmentObject(scene, equipmentId);
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
  pipeFlowStatus?: 'normal' | 'warning' | 'critical';
  pipeFlowSpeed?: number;
}

export function TestbedModel({
  equipmentStates = {}, onEquipmentClick, showEffects = true,
  tankLevels = {}, heatmapTarget = null, propagationPaths = [],
  pipeFlowStatus = 'normal', pipeFlowSpeed = 1,
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
      for (const eqId of EQUIPMENT_IDS) {
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

  // Click handler — walk up the hierarchy to find equipment ID
  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    let obj = e.object as THREE.Object3D;
    while (obj) {
      // Direct match on equipment ID
      if (EQUIPMENT_IDS.includes(obj.name)) {
        onEquipmentClick?.(obj.name);
        return;
      }
      // ARM-101001 같은 suffix 변형도 매칭
      for (const eqId of EQUIPMENT_IDS) {
        if (obj.name.startsWith(eqId) && obj.name !== eqId) {
          onEquipmentClick?.(eqId);
          return;
        }
      }
      obj = obj.parent!;
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

          {/* Pipe flow animation */}
          {(() => {
            const posMap: Record<string, [number, number, number]> = {};
            for (const eqId of EQUIPMENT_IDS) {
              const c = computeEquipmentCenter(scene, eqId);
              if (c) posMap[eqId] = c;
            }
            return (
              <PipeFlowSystem
                equipmentPositions={posMap}
                flowStatus={pipeFlowStatus}
                flowSpeed={pipeFlowSpeed}
              />
            );
          })()}

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
