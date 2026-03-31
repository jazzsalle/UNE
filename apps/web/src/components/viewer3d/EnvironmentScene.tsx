// 바닥판 어둡게 + 도로(배관 옆) + 바다(파란색 물결)
'use client';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── 바다 (파란색, 바닥판 영역은 제외) ──
// 바닥판(terrain_ground) 대략 범위: X[-100..310], Z[-260..260]
// 바다는 이 범위 밖에서만 보여야 함
function Ocean() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uDeepColor:    { value: new THREE.Color('#0a2463') },  // 진한 파란
    uShallowColor: { value: new THREE.Color('#1e56a0') },  // 중간 파란
    uFoamColor:    { value: new THREE.Color('#3d8bfd') },  // 밝은 파란 거품
    // 바닥판 바운딩 박스 (Three.js XZ 평면)
    uTerrainMin: { value: new THREE.Vector2(-110, -270) },
    uTerrainMax: { value: new THREE.Vector2(320, 270) },
  }), []);

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[90, -3, 0]}>
      <planeGeometry args={[2500, 2500, 80, 80]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        vertexShader={`
          uniform float uTime;
          varying vec2 vUv;
          varying float vWave;
          varying vec3 vWorldPos;
          void main() {
            vUv = uv;
            vec3 pos = position;
            // 물결 애니메이션
            float wave1 = sin(pos.x * 0.012 + uTime * 0.6) * 2.0;
            float wave2 = sin(pos.y * 0.018 + uTime * 0.4) * 1.5;
            float wave3 = cos((pos.x + pos.y) * 0.008 + uTime * 0.8) * 1.0;
            pos.z += wave1 + wave2 + wave3;
            vWave = (wave1 + wave2 + wave3) / 4.5;
            // 월드 위치 전달 (바닥판 마스킹용)
            vec4 worldPos = modelMatrix * vec4(pos, 1.0);
            vWorldPos = worldPos.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uDeepColor;
          uniform vec3 uShallowColor;
          uniform vec3 uFoamColor;
          uniform float uTime;
          uniform vec2 uTerrainMin;
          uniform vec2 uTerrainMax;
          varying vec2 vUv;
          varying float vWave;
          varying vec3 vWorldPos;
          void main() {
            // 바닥판 영역 내부이면 투명 처리 (바다 안 보임)
            float inTerrainX = step(uTerrainMin.x, vWorldPos.x) * step(vWorldPos.x, uTerrainMax.x);
            float inTerrainZ = step(uTerrainMin.y, vWorldPos.z) * step(vWorldPos.z, uTerrainMax.y);
            float inTerrain = inTerrainX * inTerrainZ;
            // 바닥판 경계에서 부드럽게 전환 (20단위 페더링)
            float fadeX = smoothstep(0.0, 20.0, vWorldPos.x - uTerrainMin.x) * smoothstep(0.0, 20.0, uTerrainMax.x - vWorldPos.x);
            float fadeZ = smoothstep(0.0, 20.0, vWorldPos.z - uTerrainMin.y) * smoothstep(0.0, 20.0, uTerrainMax.y - vWorldPos.z);
            float terrainMask = fadeX * fadeZ;

            // 파도 색상 혼합
            float mixFactor = smoothstep(-0.3, 0.6, vWave);
            vec3 color = mix(uDeepColor, uShallowColor, mixFactor);
            // 파도 정점 거품
            float foam = smoothstep(0.35, 0.7, vWave);
            color = mix(color, uFoamColor, foam * 0.4);
            // 반짝임
            float sparkle = pow(max(0.0, sin(vWorldPos.x * 0.5 + uTime * 2.0) * sin(vWorldPos.z * 0.5 + uTime * 1.5)), 8.0);
            color += vec3(sparkle * 0.08);

            // 바닥판 내부 → 투명, 바깥 → 불투명
            float alpha = (1.0 - terrainMask) * 0.92;
            // 전체 가장자리 페이드
            float edgeFade = 1.0 - smoothstep(0.4, 0.5, length(vUv - 0.5));
            alpha *= edgeFade;

            gl_FragColor = vec4(color, alpha);
          }
        `}
      />
    </mesh>
  );
}

// ── 도로 (로딩암 접속부 → 배관 옆을 따라 배치) ──
function Roads() {
  // 배관 경로 옆에 도로 배치 (배관에서 약 8~10 단위 오프셋)
  // 로딩암(ARM-101)이 바닥판에 닿는 지점부터 시작
  const roadPaths: Array<{ points: [number, number][]; width: number }> = [
    // 메인 도로: 로딩암 접속부 → 탱크 방향 (배관 옆, +X 오프셋)
    { points: [[260,-115],[230,-130],[200,-155],[170,-180],[150,-200]], width: 5 },
    // 탱크 간 연결 (TK-101 → TK-102)
    { points: [[150,-200],[120,-205],[80,-205],[55,-200]], width: 5 },
    // 탱크 → BOG/재액화 방향 (배관 옆, +X 오프셋)
    { points: [[120,-200],[110,-170],[95,-140],[80,-110],[65,-80],[50,-55],[40,-40]], width: 5 },
    // BOG → 재액화기 연결
    { points: [[40,-40],[70,-45],[100,-50],[140,-55]], width: 4 },
    // BOG/재액화 → 펌프 방향 (배관 옆)
    { points: [[40,-40],[55,-20],[70,0],[90,15],[110,30],[130,45],[145,55]], width: 5 },
    // 펌프 → 배관 → 밸브 #1 (배관 옆)
    { points: [[145,55],[125,45],[100,30],[80,15],[65,0],[50,-15],[30,-25],[10,-35],[-20,-40],[-45,-45]], width: 5 },
    // 펌프 → 기화기 (배관 옆)
    { points: [[145,55],[142,80],[140,110],[138,140],[135,170],[133,195]], width: 5 },
    // 밸브 #2 방향 분기
    { points: [[65,0],[55,30],[40,70],[20,110],[5,145],[-2,180]], width: 4 },
  ];

  return (
    <group>
      {roadPaths.map((road, ri) => {
        const segments: JSX.Element[] = [];
        for (let i = 0; i < road.points.length - 1; i++) {
          const [x1, z1] = road.points[i];
          const [x2, z2] = road.points[i + 1];
          const dx = x2 - x1;
          const dz = z2 - z1;
          const len = Math.sqrt(dx * dx + dz * dz);
          const angle = Math.atan2(dx, dz);
          const mx = (x1 + x2) / 2;
          const mz = (z1 + z2) / 2;

          // 도로 본체
          segments.push(
            <mesh
              key={`road-${ri}-${i}`}
              position={[mx, 0.12, mz]}
              rotation={[-Math.PI / 2, 0, -angle]}
            >
              <planeGeometry args={[road.width, len]} />
              <meshStandardMaterial
                color="#303030"
                roughness={0.92}
                metalness={0}
                transparent
                opacity={0.8}
              />
            </mesh>
          );

          // 도로 가장자리 라인 (양쪽)
          const edgeOffset = road.width / 2 - 0.2;
          const perpX = Math.cos(angle) * edgeOffset;
          const perpZ = -Math.sin(angle) * edgeOffset;
          for (const side of [-1, 1]) {
            segments.push(
              <mesh
                key={`edge-${ri}-${i}-${side}`}
                position={[mx + perpX * side, 0.15, mz + perpZ * side]}
                rotation={[-Math.PI / 2, 0, -angle]}
              >
                <planeGeometry args={[0.3, len]} />
                <meshStandardMaterial
                  color="#505050"
                  roughness={0.9}
                  transparent
                  opacity={0.6}
                />
              </mesh>
            );
          }
        }
        return <group key={`roadgroup-${ri}`}>{segments}</group>;
      })}
    </group>
  );
}

// ── 바닥판(TERRAIN) 어둡게 처리 ──
export function darkenTerrain(scene: THREE.Group) {
  scene.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
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
      // 바닥판이 바다 위에 렌더되도록
      mesh.renderOrder = 1;
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
