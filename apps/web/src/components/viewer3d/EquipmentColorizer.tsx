// ref: CLAUDE.md §5.3 — 설비 컬러링 시스템
'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { COLOR_MAP, type VisualState } from '@/lib/constants';

interface EquipmentColorizerProps {
  scene: THREE.Group;
  equipmentStates: Record<string, VisualState>;
}

const originalMaterials = new Map<string, THREE.Material | THREE.Material[]>();

function applyColor(obj: THREE.Object3D, color: string) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const key = mesh.uuid;

      // Clone material only once
      if (!originalMaterials.has(key)) {
        originalMaterials.set(key, mesh.material);
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => m.clone());
        } else {
          mesh.material = mesh.material.clone();
        }
      }

      // Set color
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of materials) {
        if ((mat as THREE.MeshStandardMaterial).color) {
          (mat as THREE.MeshStandardMaterial).color.set(color);
          (mat as THREE.MeshStandardMaterial).emissive?.set(color);
          (mat as THREE.MeshStandardMaterial).emissiveIntensity = 0.15;
        }
      }
    }
  });
}

function resetColor(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const key = mesh.uuid;
      const original = originalMaterials.get(key);
      if (original) {
        mesh.material = original;
        originalMaterials.delete(key);
      }
    }
  });
}

export function useEquipmentColorizer(scene: THREE.Group | null, equipmentStates: Record<string, VisualState>) {
  const prevStates = useRef<Record<string, VisualState>>({});

  useEffect(() => {
    if (!scene) return;

    for (const [equipmentId, state] of Object.entries(equipmentStates)) {
      if (prevStates.current[equipmentId] === state) continue;

      // Find equipment by EMPTY parent name
      const empty = scene.getObjectByName(equipmentId);
      if (!empty) continue;

      if (state === 'normal') {
        resetColor(empty);
      } else {
        applyColor(empty, COLOR_MAP[state]);
      }
    }

    // Reset removed equipment
    for (const equipmentId of Object.keys(prevStates.current)) {
      if (!equipmentStates[equipmentId]) {
        const empty = scene.getObjectByName(equipmentId);
        if (empty) resetColor(empty);
      }
    }

    prevStates.current = { ...equipmentStates };
  }, [scene, equipmentStates]);
}
