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
import { AmbientAnimations } from './effects/AmbientAnimations';
import { COLOR_MAP, type VisualState } from '@/lib/constants';
import { darkenTerrain } from './EnvironmentScene';
import {
  findEquipmentObject,
  computeEquipmentBBox,
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
  /** 상시 모니터링 선박/로딩암 애니메이션 활성화 */
  enableAmbientAnimations?: boolean;
}

export function TestbedModel({
  equipmentStates = {}, onEquipmentClick, showEffects = true,
  tankLevels = {}, heatmapTarget = null, propagationPaths = [],
  pipeFlowStatus = 'normal', pipeFlowSpeed = 1,
  enableAmbientAnimations = false,
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

      {/* 상시 모니터링 선박/로딩암 애니메이션 */}
      {enableAmbientAnimations && (
        <AmbientAnimations scene={scene} />
      )}

      {showEffects && positionsReady && (
        <>
          {/* Glow for warning/critical/affected equipment */}
          {Object.entries(equipmentStates).map(([eqId, state]) => {
            if (state === 'normal') return null;
            const pos = computeEquipmentCenter(scene, eqId);
            if (!pos) return null;
            const box = computeEquipmentBBox(scene, eqId);
            const glowSize: [number, number, number] = box
              ? [box.max.x - box.min.x + 6, box.max.y - box.min.y + 6, box.max.z - box.min.z + 6]
              : [20, 20, 20];
            return (
              <GlowEffect
                key={`glow-${eqId}`}
                position={pos}
                size={glowSize}
                color={COLOR_MAP[state]}
                pulse={state === 'critical' || state === 'emergency'}
                intensity={state === 'emergency' ? 0.6 : state === 'affected' ? 0.3 : 0.4}
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

          {/* Pipe flow animation — GLB 배관 메시 오버레이 */}
          <PipeFlowSystem
            scene={scene}
            flowStatus={pipeFlowStatus}
            flowSpeed={pipeFlowSpeed}
          />

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

// ref: CLAUDE.md §5.6 — secondary_pump.glb (M-ANO용) + X-ray 시각화
// 외통(outer_can)을 반투명, 이상 발생 부위만 컬러링
const OUTER_PARTS = ['outer_can', 'mounting_plate', 'discharge_pipe'];

export function PumpDetailModel({ meshStates = {}, xrayMode = false }: { meshStates?: Record<string, string>; xrayMode?: boolean }) {
  const { scene } = useGLTF('/models/secondary_pump.glb');
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.scale.setScalar(50);
    return clone;
  }, [scene]);

  useEffect(() => {
    const hasAnomaly = Object.keys(meshStates).length > 0;

    clonedScene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      if (Array.isArray(mesh.material)) return;

      mesh.material = mesh.material.clone();
      const mat = mesh.material as THREE.MeshStandardMaterial;

      const anomalyColor = meshStates[mesh.name];
      const isOuter = OUTER_PARTS.includes(mesh.name);

      if (anomalyColor) {
        // 이상 부위: 컬러링 + emissive glow
        mat.color.set(anomalyColor);
        mat.emissive.set(anomalyColor);
        mat.emissiveIntensity = 0.4;
        mat.transparent = false;
        mat.opacity = 1;
      } else if (isOuter && (xrayMode || hasAnomaly)) {
        // X-ray 모드 또는 이상 시: 외통 반투명
        mat.color.set('#a0c4ff');
        mat.transparent = true;
        mat.opacity = 0.15;
        mat.depthWrite = false;
        mat.emissive.set('#4080ff');
        mat.emissiveIntensity = 0.05;
      } else if (hasAnomaly) {
        // 이상 시 정상 내부 파트: 약간 밝은 톤
        mat.color.set('#b0d0ff');
        mat.emissive.set('#2060c0');
        mat.emissiveIntensity = 0.1;
        mat.transparent = false;
        mat.opacity = 1;
      } else {
        // 정상: 기본 재질 (밝은 회색)
        mat.color.set('#d0d4dc');
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
        mat.transparent = false;
        mat.opacity = 1;
      }
    });
  }, [clonedScene, meshStates, xrayMode]);

  return <primitive object={clonedScene} />;
}

useGLTF.preload('/models/secondary_pump.glb');

/**
 * 테스트베드 GLB에서 특정 설비만 표시하는 격리 뷰어
 * 설비 상태감시 모드에서 개별 설비 상세 뷰용
 */
export function IsolatedEquipmentModel({
  equipmentId,
  equipmentStates = {},
}: {
  equipmentId: string;
  equipmentStates?: Record<string, VisualState>;
}) {
  const { scene } = useGLTF('/models/h2.glb', true);
  const prevVisibility = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (!scene) return;

    // 모든 설비 EMPTY 노드의 가시성 제어
    const targetIds = [
      'SHP-001', 'ARM-101', 'TK-101', 'TK-102', 'BOG-201',
      'PMP-301', 'VAP-401', 'REL-701', 'VAL-601', 'VAL-602', 'PIP-501',
      'SWP-001', 'TERRAIN', 'GROUND',
    ];

    for (const eqId of targetIds) {
      const obj = findEquipmentObject(scene, eqId);
      if (!obj) continue;

      // 저장 (최초만)
      if (!prevVisibility.current.has(eqId)) {
        prevVisibility.current.set(eqId, obj.visible);
      }

      // 선택된 설비만 표시, 나머지 숨김
      obj.visible = (eqId === equipmentId);
    }

    // TERRAIN/GROUND 숨김
    const terrain = scene.getObjectByName('TERRAIN') || scene.getObjectByName('terrain_ground');
    if (terrain) terrain.visible = false;
    const ground = scene.getObjectByName('GROUND');
    if (ground) ground.visible = false;

    // 선택 설비 컬러링 적용
    const state = equipmentStates[equipmentId];
    if (state && state !== 'normal') {
      colorizeEquipment(scene, equipmentId, state);
    }

    return () => {
      // 언마운트 시 모든 설비 가시성 복원
      for (const [eqId, wasVisible] of prevVisibility.current.entries()) {
        const obj = findEquipmentObject(scene, eqId);
        if (obj) obj.visible = wasVisible;
      }
      const t = scene.getObjectByName('TERRAIN') || scene.getObjectByName('terrain_ground');
      if (t) t.visible = true;
      const g = scene.getObjectByName('GROUND');
      if (g) g.visible = true;
      prevVisibility.current.clear();
    };
  }, [scene, equipmentId, equipmentStates]);

  return <primitive object={scene} />;
}
