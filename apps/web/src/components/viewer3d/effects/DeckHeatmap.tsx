// deck.gl HeatmapLayer rendered as a Three.js texture on a ground plane
// This approach renders deck.gl to an offscreen canvas, then maps it onto a mesh in the 3D scene
'use client';
import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EQUIPMENT_POSITIONS } from '../deckUtils';

interface HeatmapPoint {
  equipmentId: string;
  weight: number;  // 0~100 (impact_score)
}

interface DeckHeatmapProps {
  points: HeatmapPoint[];
  visible?: boolean;
  /** ground plane bounds [minX, minZ, maxX, maxZ] */
  bounds?: [number, number, number, number];
  intensity?: number;
}

const CANVAS_SIZE = 512;
const DEFAULT_BOUNDS: [number, number, number, number] = [-170, -340, 340, 410];

/**
 * Renders a multi-point heatmap as a canvas texture mapped to a ground plane.
 * Unlike the old HeatmapOverlay (single point), this supports multiple overlapping
 * risk zones with proper Gaussian blending — similar to deck.gl HeatmapLayer.
 */
export function DeckHeatmap({
  points,
  visible = true,
  bounds = DEFAULT_BOUNDS,
  intensity = 0.7,
}: DeckHeatmapProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);

  // Create offscreen canvas
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    canvasRef.current = canvas;

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    textureRef.current = texture;

    return () => {
      texture.dispose();
    };
  }, []);

  // Render heatmap to canvas whenever points change
  const renderHeatmap = useCallback(() => {
    const canvas = canvasRef.current;
    const texture = textureRef.current;
    if (!canvas || !texture) return;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    if (points.length === 0) {
      texture.needsUpdate = true;
      return;
    }

    const [minX, minZ, maxX, maxZ] = bounds;
    const rangeX = maxX - minX;
    const rangeZ = maxZ - minZ;

    // Draw Gaussian blobs for each point
    for (const point of points) {
      const pos = EQUIPMENT_POSITIONS[point.equipmentId];
      if (!pos) continue;

      // Map world coords to canvas coords
      const cx = ((pos[0] - minX) / rangeX) * CANVAS_SIZE;
      const cy = ((pos[2] - minZ) / rangeZ) * CANVAS_SIZE;

      // Radius proportional to weight (impact_score)
      const radius = (point.weight / 100) * CANVAS_SIZE * 0.25;

      // Draw radial gradient blob
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, `rgba(255, 23, 68, ${0.85 * intensity})`);      // Red center
      gradient.addColorStop(0.25, `rgba(255, 87, 34, ${0.65 * intensity})`);    // Orange
      gradient.addColorStop(0.5, `rgba(255, 193, 7, ${0.45 * intensity})`);     // Yellow
      gradient.addColorStop(0.75, `rgba(76, 175, 80, ${0.25 * intensity})`);    // Green
      gradient.addColorStop(1, 'rgba(76, 175, 80, 0)');                          // Transparent

      ctx.fillStyle = gradient;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }

    texture.needsUpdate = true;
  }, [points, bounds, intensity]);

  useEffect(() => {
    renderHeatmap();
  }, [renderHeatmap]);

  // Pulse animation
  useFrame(({ clock }) => {
    if (meshRef.current && visible) {
      const t = clock.getElapsedTime();
      meshRef.current.scale.setScalar(1 + Math.sin(t * 0.5) * 0.015);
    }
  });

  if (!visible || points.length === 0) return null;

  const [minX, minZ, maxX, maxZ] = bounds;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const sizeX = maxX - minX;
  const sizeZ = maxZ - minZ;

  return (
    <mesh
      ref={meshRef}
      position={[centerX, 1.0, centerZ]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={-1}
    >
      <planeGeometry args={[sizeX, sizeZ]} />
      {textureRef.current && (
        <meshBasicMaterial
          map={textureRef.current}
          transparent
          opacity={1}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      )}
    </mesh>
  );
}
