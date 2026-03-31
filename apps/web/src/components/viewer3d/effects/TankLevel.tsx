// ref: CLAUDE.md §5.7.2 — 저장탱크 내부 레벨/압력 시각화 (반투명 + 색상 그라데이션)
'use client';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface TankLevelProps {
  position: [number, number, number];
  tankHeight: number;
  tankRadius: number;
  level: number;        // 0~100%
  pressure: 'normal' | 'warning' | 'critical';
}

export function TankLevel({ position, tankHeight, tankRadius, level, pressure }: TankLevelProps) {
  const liquidRef = useRef<THREE.ShaderMaterial>(null);
  const glowRef = useRef<THREE.MeshBasicMaterial>(null);
  const surfaceRef = useRef<THREE.ShaderMaterial>(null);

  const liquidHeight = (tankHeight * level) / 100;
  const liquidY = position[1] - tankHeight / 2 + liquidHeight / 2;
  const surfaceY = position[1] - tankHeight / 2 + liquidHeight;

  // Liquid shader uniforms
  const liquidUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uLevel: { value: level / 100 },
    uPressure: { value: pressure === 'critical' ? 2.0 : pressure === 'warning' ? 1.0 : 0.0 },
    uBaseColor: { value: new THREE.Color('#0891b2') },
    uTopColor: { value: new THREE.Color('#22d3ee') },
    uWarningColor: { value: new THREE.Color('#f97316') },
    uCriticalColor: { value: new THREE.Color('#ef4444') },
  }), [level, pressure]);

  // Surface wave shader
  const surfaceUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(pressure === 'critical' ? '#ef4444' : pressure === 'warning' ? '#f97316' : '#22d3ee') },
  }), [pressure]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (liquidRef.current) liquidRef.current.uniforms.uTime.value = t;
    if (surfaceRef.current) surfaceRef.current.uniforms.uTime.value = t;
    if (glowRef.current && pressure !== 'normal') {
      glowRef.current.opacity = pressure === 'critical'
        ? 0.12 + Math.sin(t * 4) * 0.08
        : 0.08 + Math.sin(t * 2) * 0.04;
    }
  });

  const glowColor = pressure === 'critical' ? '#ef4444' : pressure === 'warning' ? '#f97316' : '#06b6d4';

  return (
    <group>
      {/* LH2 액체 본체 — 반투명 시안/파란 그라데이션 */}
      <mesh position={[position[0], liquidY, position[2]]}>
        <cylinderGeometry args={[tankRadius * 0.88, tankRadius * 0.88, liquidHeight, 32]} />
        <shaderMaterial
          ref={liquidRef}
          uniforms={liquidUniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          vertexShader={`
            varying vec3 vPos;
            varying vec2 vUv;
            void main() {
              vPos = position;
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform float uLevel;
            uniform float uPressure;
            uniform vec3 uBaseColor;
            uniform vec3 uTopColor;
            uniform vec3 uWarningColor;
            uniform vec3 uCriticalColor;
            varying vec3 vPos;
            varying vec2 vUv;
            void main() {
              // Vertical gradient: deeper blue at bottom, lighter cyan at top
              float heightFactor = vUv.y;
              vec3 color = mix(uBaseColor * 0.6, uTopColor, heightFactor);

              // Pressure coloring
              if (uPressure > 1.5) {
                color = mix(color, uCriticalColor, 0.4 + sin(uTime * 3.0) * 0.15);
              } else if (uPressure > 0.5) {
                color = mix(color, uWarningColor, 0.25);
              }

              // Subtle internal waviness
              float wave = sin(vPos.y * 8.0 + uTime * 1.5) * 0.03;
              color += vec3(wave);

              // Semi-transparent with denser at bottom
              float alpha = mix(0.25, 0.45, heightFactor);
              gl_FragColor = vec4(color, alpha);
            }
          `}
        />
      </mesh>

      {/* 액면 표면 — 물결치는 원형 디스크 */}
      <mesh position={[position[0], surfaceY, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[tankRadius * 0.88, 32]} />
        <shaderMaterial
          ref={surfaceRef}
          uniforms={surfaceUniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          vertexShader={`
            uniform float uTime;
            varying vec2 vUv;
            void main() {
              vUv = uv;
              vec3 pos = position;
              // Subtle surface waves
              pos.z += sin(pos.x * 3.0 + uTime * 2.0) * 0.15 + cos(pos.y * 3.0 + uTime * 1.5) * 0.1;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform vec3 uColor;
            varying vec2 vUv;
            void main() {
              float dist = length(vUv - 0.5) * 2.0;
              float ripple = sin(dist * 12.0 - uTime * 3.0) * 0.1 + 0.5;
              vec3 color = uColor * (0.8 + ripple * 0.4);
              // Edge fade
              float alpha = (1.0 - smoothstep(0.7, 1.0, dist)) * 0.5;
              gl_FragColor = vec4(color, alpha);
            }
          `}
        />
      </mesh>

      {/* 압력 글로우 (외벽) */}
      {pressure !== 'normal' && (
        <mesh position={position} scale={[1.06, 1.06, 1.06]}>
          <cylinderGeometry args={[tankRadius, tankRadius, tankHeight, 32]} />
          <meshBasicMaterial
            ref={glowRef}
            color={glowColor}
            transparent
            opacity={0.1}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
