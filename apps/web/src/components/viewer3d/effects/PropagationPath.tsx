// ref: CLAUDE.md §5.7.5 — 영향 전파 경로 애니메이션 (deck.gl ArcLayer 스타일)
// 두꺼운 튜브 + 이동 파티클 + impact_score 기반 두께/색상 그라데이션
'use client';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PropagationPathProps {
  from: [number, number, number];
  to: [number, number, number];
  color?: string;
  /** Source color for gradient (default: red) */
  sourceColor?: string;
  /** Target color for gradient (default: yellow) */
  targetColor?: string;
  /** Impact score 0~100, affects tube thickness and arc height */
  impactScore?: number;
  speed?: number;
  visible?: boolean;
}

const PARTICLE_COUNT = 8;

export function PropagationPath({
  from, to,
  color,
  sourceColor = '#FF1744',
  targetColor = '#FFEE58',
  impactScore = 70,
  speed = 1,
  visible = true,
}: PropagationPathProps) {
  const tubeRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.InstancedMesh>(null);
  const shaderRef = useRef<THREE.ShaderMaterial>(null);

  // Scale tube thickness and arc height by impact score
  const tubeRadius = 1.5 + (impactScore / 100) * 2.5; // 1.5~4.0
  const particleSize = 2.5 + (impactScore / 100) * 3.0; // 2.5~5.5

  const curve = useMemo(() => {
    const p0 = new THREE.Vector3(...from);
    const p2 = new THREE.Vector3(...to);
    const dist = p0.distanceTo(p2);
    const arcHeight = Math.max(25, dist * 0.12) + (impactScore / 100) * 20;
    const mid = new THREE.Vector3(
      (from[0] + to[0]) / 2,
      Math.max(from[1], to[1]) + arcHeight,
      (from[2] + to[2]) / 2
    );
    return new THREE.QuadraticBezierCurve3(p0, mid, p2);
  }, [from, to, impactScore]);

  const tubeGeometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, 64, tubeRadius, 8, false);
  }, [curve, tubeRadius]);

  const particleGeometry = useMemo(() => new THREE.SphereGeometry(particleSize, 8, 8), [particleSize]);

  // Use gradient shader: source color → target color along the tube
  const resolvedSourceColor = color || sourceColor;
  const resolvedTargetColor = color || targetColor;

  const tubeMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uSourceColor: { value: new THREE.Color(resolvedSourceColor) },
        uTargetColor: { value: new THREE.Color(resolvedTargetColor) },
        uIntensity: { value: 0.5 + (impactScore / 100) * 0.5 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uSourceColor;
        uniform vec3 uTargetColor;
        uniform float uIntensity;
        varying vec2 vUv;
        void main() {
          // Gradient from source to target along the arc
          vec3 gradientColor = mix(uSourceColor, uTargetColor, vUv.x);

          // Animated flow pattern
          float flow = fract(vUv.x * 5.0 - uTime * 1.2);
          float flowMask = smoothstep(0.0, 0.1, flow) * (1.0 - smoothstep(0.5, 0.6, flow));

          // Edge glow
          float edgeDist = abs(vUv.y - 0.5) * 2.0;
          float glow = pow(1.0 - edgeDist, 0.6);

          // Bright emissive core
          float core = smoothstep(0.5, 0.0, edgeDist) * 0.35;

          float alpha = (flowMask * glow + core) * uIntensity;
          vec3 finalColor = gradientColor * (1.3 + core * 0.6);
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
    });
  }, [resolvedSourceColor, resolvedTargetColor, impactScore]);

  // Particle material uses gradient color
  const particleMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: resolvedSourceColor,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, [resolvedSourceColor]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed;

    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = t;
    }

    if (particlesRef.current) {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const progress = ((t * 0.25 + i / PARTICLE_COUNT) % 1.0);
        const point = curve.getPoint(progress);
        // Gradient color per particle position
        const scale = 0.6 + Math.sin(progress * Math.PI) * 0.6;
        dummy.position.copy(point);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        particlesRef.current.setMatrixAt(i, dummy.matrix);
      }
      particlesRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  if (!visible) return null;

  return (
    <group>
      <mesh ref={tubeRef} geometry={tubeGeometry}>
        <primitive ref={shaderRef} object={tubeMaterial} attach="material" />
      </mesh>
      <instancedMesh
        ref={particlesRef}
        args={[particleGeometry, particleMaterial, PARTICLE_COUNT]}
      />
    </group>
  );
}
