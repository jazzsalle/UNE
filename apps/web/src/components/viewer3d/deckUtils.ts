// Utility functions for deck.gl + Three.js integration
import * as THREE from 'three';
// Equipment center positions (world space, from CLAUDE.md §5.5 camera presets)
export const EQUIPMENT_POSITIONS: Record<string, [number, number, number]> = {
  'SHP-001': [303.0, 12.8, -95.9],
  'ARM-101': [271.8, 8.6, -121.1],
  'TK-101':  [144.7, 22.4, -208.2],
  'TK-102':  [47.2, 22.4, -204.4],
  'BOG-201': [33.4, 21.1, -43.6],
  'PMP-301': [140.6, 25.4, 54.1],
  'VAP-401': [133.4, 30.6, 189.0],
  'REL-701': [143.7, 30.9, -59.4],
  'VAL-601': [-52.2, 39.8, -47.9],
  'VAL-602': [-2.5, 39.8, 177.4],
  'PIP-501': [59.4, 24.3, -8.0],
};

/**
 * Project a 3D world position to 2D screen coordinates
 */
export function projectToScreen(
  worldPos: [number, number, number],
  camera: THREE.Camera,
  width: number,
  height: number,
): [number, number] | null {
  const vec = new THREE.Vector3(worldPos[0], worldPos[1], worldPos[2]);
  vec.project(camera);

  // Check if behind camera
  if (vec.z > 1) return null;

  const x = (vec.x * 0.5 + 0.5) * width;
  const y = (-vec.y * 0.5 + 0.5) * height;

  return [x, y];
}

/**
 * Project equipment positions to screen coordinates for deck.gl layers
 */
export function projectEquipmentToScreen(
  equipmentIds: string[],
  camera: THREE.Camera,
  width: number,
  height: number,
): { id: string; position: [number, number]; worldPos: [number, number, number] }[] {
  const results: { id: string; position: [number, number]; worldPos: [number, number, number] }[] = [];

  for (const id of equipmentIds) {
    const worldPos = EQUIPMENT_POSITIONS[id];
    if (!worldPos) continue;

    const screenPos = projectToScreen(worldPos, camera, width, height);
    if (screenPos) {
      results.push({ id, position: screenPos, worldPos });
    }
  }

  return results;
}

/**
 * Get equipment world position (x, z for ground plane — deck.gl uses lng/lat style)
 */
export function getEquipmentGroundPos(equipmentId: string): [number, number] | null {
  const pos = EQUIPMENT_POSITIONS[equipmentId];
  if (!pos) return null;
  return [pos[0], pos[2]]; // x, z (ground plane)
}
