// ref: CLAUDE.md §5.7.3 — 설비 상태 글로우/아우라 효과 (개선)
'use client';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface GlowEffectProps {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  pulse?: boolean;
  intensity?: number;
}

export function GlowEffect({ position, size, color, pulse = false, intensity = 0.5 }: GlowEffectProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uIntensity: { value: intensity },
    uPulse: { value: pulse ? 1.0 : 0.0 },
  }), [color, intensity, pulse]);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <mesh position={position} scale={[1.1, 1.1, 1.1]}>
      <boxGeometry args={size} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        transparent
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        vertexShader={`
          varying vec3 vNormal;
          varying vec3 vPos;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform vec3 uColor;
          uniform float uIntensity;
          uniform float uPulse;
          varying vec3 vNormal;
          varying vec3 vPos;
          void main() {
            // Edge glow: stronger at edges
            float edgeFactor = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
            edgeFactor = pow(edgeFactor, 0.5);

            // Pulse animation
            float pulse = 1.0;
            if (uPulse > 0.5) {
              pulse = 0.5 + 0.5 * sin(uTime * 3.0);
            }

            // Vertical gradient (more glow at center)
            float vGrad = 1.0 - abs(vPos.y) / 8.0;
            vGrad = clamp(vGrad, 0.3, 1.0);

            float alpha = uIntensity * edgeFactor * pulse * vGrad;
            gl_FragColor = vec4(uColor, alpha * 0.6);
          }
        `}
      />
    </mesh>
  );
}
