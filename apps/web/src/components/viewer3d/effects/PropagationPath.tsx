// ref: CLAUDE.md §5.7.5 — 영향 전파 경로 애니메이션 (개선: 두꺼운 튜브 + 이동 파티클)
'use client';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PropagationPathProps {
  from: [number, number, number];
  to: [number, number, number];
  color?: string;
  speed?: number;
  visible?: boolean;
}

const PARTICLE_COUNT = 8;

export function PropagationPath({ from, to, color = '#FF6D00', speed = 1, visible = true }: PropagationPathProps) {
  const tubeRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.InstancedMesh>(null);
  const shaderRef = useRef<THREE.ShaderMaterial>(null);

  const curve = useMemo(() => {
    const p0 = new THREE.Vector3(...from);
    const p2 = new THREE.Vector3(...to);
    const dist = p0.distanceTo(p2);
    const arcHeight = Math.max(30, dist * 0.15);
    const mid = new THREE.Vector3(
      (from[0] + to[0]) / 2,
      Math.max(from[1], to[1]) + arcHeight,
      (from[2] + to[2]) / 2
    );
    return new THREE.QuadraticBezierCurve3(p0, mid, p2);
  }, [from, to]);

  // Tube geometry for the thick path line
  const tubeGeometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, 64, 2.5, 8, false);
  }, [curve]);

  // Sphere geometry for traveling particles
  const particleGeometry = useMemo(() => new THREE.SphereGeometry(4.0, 8, 8), []);

  const tubeMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
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
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          // Animated dash pattern along tube — bold dashes
          float dashPattern = fract(vUv.x * 6.0 - uTime * 1.5);
          float dash = smoothstep(0.0, 0.08, dashPattern) * (1.0 - smoothstep(0.55, 0.62, dashPattern));

          // Edge glow — strong core with soft edges
          float edgeDist = abs(vUv.y - 0.5) * 2.0;
          float edge = 1.0 - edgeDist;
          float glow = pow(edge, 0.5);

          // Bright emissive core
          float core = smoothstep(0.6, 0.0, edgeDist) * 0.4;

          float alpha = (dash * glow + core) * 0.9;
          vec3 finalColor = uColor * (1.2 + core * 0.5);
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
    });
  }, [color]);

  const particleMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, [color]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed;

    // Animate tube shader
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = t;
    }

    // Animate particles moving along curve
    if (particlesRef.current) {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const progress = ((t * 0.25 + i / PARTICLE_COUNT) % 1.0);
        const point = curve.getPoint(progress);
        const scale = 0.7 + Math.sin(progress * Math.PI) * 0.6; // larger in middle
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
      {/* Thick tube path */}
      <mesh ref={tubeRef} geometry={tubeGeometry}>
        <primitive ref={shaderRef} object={tubeMaterial} attach="material" />
      </mesh>

      {/* Traveling particles */}
      <instancedMesh
        ref={particlesRef}
        args={[particleGeometry, particleMaterial, PARTICLE_COUNT]}
      />
    </group>
  );
}
