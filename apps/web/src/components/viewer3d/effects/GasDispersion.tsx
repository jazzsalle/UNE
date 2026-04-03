// deck.gl ScatterplotLayer 컨셉 기반 가스 확산 시뮬레이션
// Three.js InstancedMesh + 셰이더로 구현 (수백 개 파티클 GPU 가속)
'use client';
import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface GasDispersionProps {
  /** Source position (equipment center, world coords) */
  origin: [number, number, number];
  /** Dispersion radius (meters) */
  maxRadius?: number;
  /** Wind direction (degrees, 0=north, 90=east) */
  windDirection?: number;
  /** Wind speed factor (0~1) */
  windSpeed?: number;
  /** Progress 0~1 (tied to simulation timeline) */
  progress?: number;
  /** Gas type affects color */
  gasType?: 'h2' | 'bog';
  visible?: boolean;
}

const PARTICLE_COUNT = 300;

export function GasDispersion({
  origin,
  maxRadius = 80,
  windDirection = 45,
  windSpeed = 0.3,
  progress = 0.5,
  gasType = 'h2',
  visible = true,
}: GasDispersionProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Pre-compute random seeds for each particle
  const seeds = useMemo(() => {
    const arr: { angle: number; dist: number; height: number; speed: number; size: number }[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr.push({
        angle: Math.random() * Math.PI * 2,
        dist: Math.pow(Math.random(), 0.6), // More particles near center
        height: Math.random() * 0.8 + 0.1,
        speed: 0.5 + Math.random() * 1.5,
        size: 0.5 + Math.random() * 1.5,
      });
    }
    return arr;
  }, []);

  const windRadians = (windDirection * Math.PI) / 180;
  const windDx = Math.sin(windRadians) * windSpeed;
  const windDz = -Math.cos(windRadians) * windSpeed;

  const color = gasType === 'h2'
    ? new THREE.Color('#00E5FF')  // Cyan for hydrogen
    : new THREE.Color('#FF9100'); // Orange for BOG

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: color },
        uOpacity: { value: 0.4 },
      },
      vertexShader: `
        varying float vDist;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vDist = length(position);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vDist;
        void main() {
          // Soft sphere: fade out at edges
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);
          if (dist > 0.5) discard;
          float fade = 1.0 - smoothstep(0.2, 0.5, dist);
          gl_FragColor = vec4(uColor, fade * uOpacity);
        }
      `,
    });
  }, [color]);

  // Basic sphere material for instanced mesh
  const sphereMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, [color]);

  const sphereGeometry = useMemo(() => new THREE.SphereGeometry(1, 6, 6), []);

  useFrame(({ clock }) => {
    if (!meshRef.current || !visible) return;
    const t = clock.getElapsedTime();
    const currentRadius = maxRadius * progress;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const seed = seeds[i];
      const animTime = t * seed.speed;

      // Base radial position
      const r = seed.dist * currentRadius;
      const angle = seed.angle + animTime * 0.1;

      // Apply wind drift
      const windOffset = animTime * 0.5;
      const x = origin[0] + Math.cos(angle) * r + windDx * windOffset * r * 0.3;
      const z = origin[2] + Math.sin(angle) * r + windDz * windOffset * r * 0.3;
      const y = origin[1] + seed.height * 15 * progress + Math.sin(animTime) * 2;

      // Scale: larger when farther, smaller when near
      const scale = seed.size * (0.8 + seed.dist * 1.5) * progress;

      // Only show particles within current progress radius
      if (seed.dist > progress * 1.2) {
        dummy.scale.setScalar(0);
      } else {
        dummy.position.set(x, y, z);
        dummy.scale.setScalar(scale);
      }

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;

    // Fade opacity based on distance from center
    if (sphereMaterial) {
      sphereMaterial.opacity = 0.15 + progress * 0.2;
    }
  });

  if (!visible) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[sphereGeometry, sphereMaterial, PARTICLE_COUNT]}
      frustumCulled={false}
    />
  );
}
