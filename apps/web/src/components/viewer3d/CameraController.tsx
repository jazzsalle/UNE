// ref: CLAUDE.md §5.5 — 카메라 프리셋 + gsap 전환
'use client';
import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { CAMERA_PRESETS } from '@/lib/constants';

interface CameraControllerProps {
  targetPreset: string | null;
}

export function CameraController({ targetPreset }: CameraControllerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const prevPreset = useRef<string | null>(null);

  useEffect(() => {
    if (!targetPreset || targetPreset === prevPreset.current) return;
    const preset = CAMERA_PRESETS[targetPreset];
    if (!preset) return;

    prevPreset.current = targetPreset;

    gsap.to(camera.position, {
      x: preset.position[0],
      y: preset.position[1],
      z: preset.position[2],
      duration: 0.8,
      ease: 'power2.inOut',
    });
  }, [targetPreset, camera]);

  return null;
}

// Equipment ID to camera preset mapping
export function getPresetForEquipment(equipmentId: string): string {
  const map: Record<string, string> = {
    'SHP-001': 'cam_ship_carrier_001',
    'ARM-101': 'cam_loading_arm_101',
    'TK-101': 'cam_tank_101',
    'TK-102': 'cam_tank_102',
    'BOG-201': 'cam_bog_compressor_201',
    'PMP-301': 'cam_pump_301',
    'VAP-401': 'cam_vaporizer_401',
    'REL-701': 'cam_reliquefier_701',
    'VAL-601': 'cam_valve_station_601',
    'VAL-602': 'cam_valve_station_602',
    'PIP-501': 'cam_pipe_main_a',
  };
  return map[equipmentId] || 'cam_overview';
}
