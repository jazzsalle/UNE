// ref: CLAUDE.md §5.1, §5.2 — 테스트베드 GLB 모델 (placeholder + pump detail)
'use client';
import { useEffect, useRef, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useEquipmentColorizer } from './EquipmentColorizer';
import type { VisualState } from '@/lib/constants';

interface TestbedModelProps {
  equipmentStates?: Record<string, VisualState>;
  onEquipmentClick?: (equipmentId: string) => void;
}

// Placeholder geometry for when GLB is not available
function PlaceholderTestbed({ onEquipmentClick }: { onEquipmentClick?: (id: string) => void }) {
  const groupRef = useRef<THREE.Group>(null);

  const equipment = [
    { id: 'SHP-001', pos: [303, 12.8, -96] as [number, number, number], size: [60, 20, 30] as [number, number, number], color: '#4a90d9' },
    { id: 'ARM-101', pos: [272, 8.6, -121] as [number, number, number], size: [15, 25, 10] as [number, number, number], color: '#7b68ee' },
    { id: 'TK-101', pos: [145, 22.4, -208] as [number, number, number], size: [30, 40, 30] as [number, number, number], color: '#20b2aa' },
    { id: 'TK-102', pos: [47, 22.4, -204] as [number, number, number], size: [30, 40, 30] as [number, number, number], color: '#20b2aa' },
    { id: 'BOG-201', pos: [33, 21.1, -44] as [number, number, number], size: [25, 20, 20] as [number, number, number], color: '#ff6b6b' },
    { id: 'PMP-301', pos: [141, 25.4, 54] as [number, number, number], size: [12, 10, 12] as [number, number, number], color: '#ffa07a' },
    { id: 'VAP-401', pos: [133, 30.6, 189] as [number, number, number], size: [20, 15, 15] as [number, number, number], color: '#98fb98' },
    { id: 'REL-701', pos: [144, 30.9, -59] as [number, number, number], size: [10, 10, 10] as [number, number, number], color: '#dda0dd' },
    { id: 'VAL-601', pos: [-52, 39.8, -48] as [number, number, number], size: [8, 8, 8] as [number, number, number], color: '#f0e68c' },
    { id: 'VAL-602', pos: [-3, 39.8, 177] as [number, number, number], size: [8, 8, 8] as [number, number, number], color: '#f0e68c' },
    { id: 'PIP-501', pos: [60, 24.3, -8] as [number, number, number], size: [200, 2, 2] as [number, number, number], color: '#b0c4de' },
  ];

  return (
    <group ref={groupRef}>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[90, 0, 30]}>
        <planeGeometry args={[600, 800]} />
        <meshStandardMaterial color="#1a2332" />
      </mesh>

      {/* Equipment boxes */}
      {equipment.map((eq) => (
        <mesh
          key={eq.id}
          name={eq.id}
          position={eq.pos}
          onClick={(e) => { e.stopPropagation(); onEquipmentClick?.(eq.id); }}
          onPointerOver={(e) => { (e.object as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#333333' }); document.body.style.cursor = 'pointer'; }}
          onPointerOut={(e) => { (e.object as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: eq.color }); document.body.style.cursor = 'default'; }}
        >
          <boxGeometry args={eq.size} />
          <meshStandardMaterial color={eq.color} transparent opacity={0.85} />
        </mesh>
      ))}

      {/* Labels */}
      {equipment.map((eq) => (
        <group key={`label-${eq.id}`} position={[eq.pos[0], eq.pos[1] + eq.size[1] / 2 + 5, eq.pos[2]]}>
          <sprite scale={[30, 8, 1]}>
            <spriteMaterial transparent opacity={0.8} />
          </sprite>
        </group>
      ))}
    </group>
  );
}

export function TestbedModel({ equipmentStates = {}, onEquipmentClick }: TestbedModelProps) {
  return (
    <PlaceholderTestbed onEquipmentClick={onEquipmentClick} />
  );
}

// Secondary pump detail model for M-ANO
export function PumpDetailModel({ meshStates = {} }: { meshStates?: Record<string, string> }) {
  // Only render if the file exists (will be in public/models/)
  return (
    <group scale={[50, 50, 50]} position={[0, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[0.15, 0.15, 2, 32]} />
        <meshStandardMaterial color="#4a90d9" transparent opacity={0.7} />
      </mesh>
      {/* Impeller stages */}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} position={[0, -0.8 + i * 0.2, 0]} name={`impeller_stage_0${i + 1}`}>
          <torusGeometry args={[0.12, 0.02, 8, 32]} />
          <meshStandardMaterial color={meshStates[`impeller_stage_0${i + 1}`] || '#66BB6A'} />
        </mesh>
      ))}
      {/* Shaft */}
      <mesh name="shaft" position={[0, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 2.2, 16]} />
        <meshStandardMaterial color={meshStates['shaft'] || '#aaaaaa'} metalness={0.8} />
      </mesh>
    </group>
  );
}
