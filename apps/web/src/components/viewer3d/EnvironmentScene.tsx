// 바닥판 어둡게 + 도로 + 바다 처리
'use client';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── 바다 (검은 영역을 바다로) ──
function Ocean() {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uDeepColor: { value: new THREE.Color('#0a1628') },
    uShallowColor: { value: new THREE.Color('#1a3a5c') },
    uFoamColor: { value: new THREE.Color('#3a6a8a') },
  }), []);

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[90, -2, 0]}>
      <planeGeometry args={[2000, 2000, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        vertexShader={`
          uniform float uTime;
          varying vec2 vUv;
          varying float vWave;
          void main() {
            vUv = uv;
            vec3 pos = position;
            // 잔잔한 파도
            float wave1 = sin(pos.x * 0.015 + uTime * 0.5) * 1.5;
            float wave2 = sin(pos.y * 0.02 + uTime * 0.3) * 1.0;
            float wave3 = cos((pos.x + pos.y) * 0.01 + uTime * 0.7) * 0.8;
            pos.z += wave1 + wave2 + wave3;
            vWave = (wave1 + wave2 + wave3) / 3.3;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uDeepColor;
          uniform vec3 uShallowColor;
          uniform vec3 uFoamColor;
          uniform float uTime;
          varying vec2 vUv;
          varying float vWave;
          void main() {
            // 파도 높낮이에 따라 색상 혼합
            float mixFactor = smoothstep(-0.3, 0.5, vWave);
            vec3 color = mix(uDeepColor, uShallowColor, mixFactor);
            // 파도 정점에 거품 효과
            float foam = smoothstep(0.4, 0.7, vWave);
            color = mix(color, uFoamColor, foam * 0.3);
            // 가장자리 페이드아웃
            float edge = 1.0 - smoothstep(0.35, 0.5, length(vUv - 0.5));
            gl_FragColor = vec4(color, 0.95 * edge);
          }
        `}
      />
    </mesh>
  );
}

// ── 도로 (설비 간 연결 경로) ──
function Roads() {
  // 주요 설비 간 도로 경로 (Three.js 좌표: X, Z가 평면, Y가 높이)
  const roadPaths: Array<{ points: [number, number][]; width: number }> = [
    // 메인 도로: 선석 → 탱크 → BOG → 펌프 → 기화기 방향
    { points: [[303,-96],[200,-150],[145,-208],[47,-204]], width: 6 },
    // 탱크 → BOG 압축기
    { points: [[100,-180],[60,-120],[33,-44]], width: 5 },
    // BOG → 재액화기
    { points: [[33,-44],[80,-50],[144,-59]], width: 4 },
    // 메인 이송: 펌프 → 배관 → 밸브
    { points: [[141,54],[100,20],[60,-8],[-10,-20],[-52,-48]], width: 5 },
    // 기화기 방향
    { points: [[141,54],[135,120],[133,189]], width: 5 },
    // 밸브 스테이션 #2
    { points: [[60,-8],[30,80],[-3,177]], width: 4 },
    // 로딩암 연결
    { points: [[303,-96],[272,-121]], width: 4 },
  ];

  return (
    <group>
      {roadPaths.map((road, ri) => {
        const shapes: JSX.Element[] = [];
        for (let i = 0; i < road.points.length - 1; i++) {
          const [x1, z1] = road.points[i];
          const [x2, z2] = road.points[i + 1];
          const dx = x2 - x1;
          const dz = z2 - z1;
          const len = Math.sqrt(dx * dx + dz * dz);
          const angle = Math.atan2(dx, dz);
          const mx = (x1 + x2) / 2;
          const mz = (z1 + z2) / 2;

          shapes.push(
            <mesh
              key={`road-${ri}-${i}`}
              position={[mx, 0.15, mz]}
              rotation={[-Math.PI / 2, 0, -angle]}
            >
              <planeGeometry args={[road.width, len]} />
              <meshStandardMaterial
                color="#2a2a2a"
                roughness={0.95}
                metalness={0}
                transparent
                opacity={0.7}
              />
            </mesh>
          );

          // 도로 중앙선 (점선)
          shapes.push(
            <mesh
              key={`center-${ri}-${i}`}
              position={[mx, 0.2, mz]}
              rotation={[-Math.PI / 2, 0, -angle]}
            >
              <planeGeometry args={[0.5, len]} />
              <meshStandardMaterial
                color="#555555"
                roughness={0.9}
                transparent
                opacity={0.5}
              />
            </mesh>
          );
        }
        return <group key={`roadgroup-${ri}`}>{shapes}</group>;
      })}
    </group>
  );
}

// ── 바닥판(TERRAIN) 어둡게 처리 ──
export function darkenTerrain(scene: THREE.Group) {
  scene.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    // TERRAIN, GROUND 또는 terrain_ground 이름의 mesh
    const name = mesh.name.toLowerCase();
    const parentName = mesh.parent?.name?.toUpperCase() || '';
    if (name.includes('terrain') || name.includes('ground') || parentName === 'TERRAIN' || parentName === 'GROUND') {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of materials) {
        const stdMat = mat as THREE.MeshStandardMaterial;
        if (stdMat.color) {
          stdMat.color.set('#1a1e24');
          stdMat.roughness = 0.95;
          stdMat.metalness = 0;
        }
      }
    }
  });
}

// ── 통합 컴포넌트 ──
export function EnvironmentScene() {
  return (
    <>
      <Ocean />
      <Roads />
    </>
  );
}
