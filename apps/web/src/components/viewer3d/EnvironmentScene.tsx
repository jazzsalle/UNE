// 바닥판 + 바다 + 하늘 배경 + 설비별 개별 데크 플레이트
// 레퍼런스: 다크 배경 위 떠 있는 메인 플랫폼 + 시안 엣지 글로우 + 설비별 바닥판
'use client';
import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { computeEquipmentBBox, findEquipmentObject } from './equipmentUtils';

// ── 바닥판(TERRAIN/GROUND) 메시 제거 ──
export function darkenTerrain(scene: THREE.Group) {
  scene.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const name = mesh.name.toLowerCase();
    const parentName = mesh.parent?.name?.toUpperCase() || '';
    if (name.includes('terrain') || name.includes('ground') || parentName === 'TERRAIN' || parentName === 'GROUND') {
      mesh.visible = false;
    }
  });
}

// ── 개별 설비 데크 플레이트 (라운드 코너 + 시안 엣지 글로우) ──
// 배제: SHP-001(선박), ARM-101(로딩암), PIP-501(배관)
const DECK_EQUIPMENT = [
  'TK-101', 'TK-102', 'BOG-201', 'PMP-301',
  'VAP-401', 'REL-701', 'VAL-601', 'VAL-602',
];

// 설비별 데크 크기 배율 (바운딩박스 기준 패딩)
const DECK_PADDING: Record<string, { padX: number; padZ: number }> = {
  'TK-101':  { padX: 25, padZ: 25 },   // 대형 탱크
  'TK-102':  { padX: 25, padZ: 25 },
  'BOG-201': { padX: 30, padZ: 30 },   // 대형 압축기
  'PMP-301': { padX: 20, padZ: 20 },
  'VAP-401': { padX: 20, padZ: 20 },
  'REL-701': { padX: 15, padZ: 15 },   // 소형 설비
  'VAL-601': { padX: 15, padZ: 15 },
  'VAL-602': { padX: 15, padZ: 15 },
};

// 라운드 코너 사각형 Shape
function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const r = Math.min(radius, width / 2, height / 2);
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2 + r, -height / 2);
  shape.lineTo(width / 2 - r, -height / 2);
  shape.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + r);
  shape.lineTo(width / 2, height / 2 - r);
  shape.quadraticCurveTo(width / 2, height / 2, width / 2 - r, height / 2);
  shape.lineTo(-width / 2 + r, height / 2);
  shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - r);
  shape.lineTo(-width / 2, -height / 2 + r);
  shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + r, -height / 2);
  return shape;
}

// 단일 데크 플레이트 컴포넌트
function DeckPlate({ position, width, depth, height = 3 }: {
  position: [number, number, number];
  width: number;
  depth: number;
  height?: number;
}) {
  const glowRef = useRef<THREE.ShaderMaterial>(null);
  const radius = Math.min(4, width / 4, depth / 4);

  const geometry = useMemo(() => {
    const shape = createRoundedRectShape(width, depth, radius);
    const extrudeSettings = { depth: height, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Rotate so extrusion goes along Y axis
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [width, depth, height, radius]);

  // 엣지 글로우 링 (하단)
  const edgeGeometry = useMemo(() => {
    const shape = createRoundedRectShape(width + 1.5, depth + 1.5, radius + 0.5);
    const points = shape.getPoints(64);
    const positions: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      // 하단 스트립 (아래쪽 2줄)
      positions.push(p.x, 0, p.y);
      positions.push(p.x, -2.5, p.y);
    }
    const geo = new THREE.BufferGeometry();
    const indices: number[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    return geo;
  }, [width, depth, radius]);

  const glowUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#00e5ff') },
  }), []);

  useFrame((_, delta) => {
    if (glowRef.current) glowRef.current.uniforms.uTime.value += delta;
  });

  return (
    <group position={position}>
      {/* 메인 플레이트 상판 */}
      <mesh geometry={geometry} position={[0, -height, 0]}>
        <meshStandardMaterial
          color="#1a1f2e"
          roughness={0.85}
          metalness={0.3}
        />
      </mesh>

      {/* 시안 엣지 글로우 */}
      <mesh geometry={edgeGeometry} position={[0, 0, 0]}>
        <shaderMaterial
          ref={glowRef}
          uniforms={glowUniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          vertexShader={`
            varying vec3 vPos;
            void main() {
              vPos = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 uColor;
            uniform float uTime;
            varying vec3 vPos;
            void main() {
              // 하단으로 갈수록 밝아짐
              float t = smoothstep(0.0, -2.5, vPos.y);
              float pulse = 0.7 + 0.3 * sin(uTime * 1.5);
              float alpha = t * 0.6 * pulse;
              gl_FragColor = vec4(uColor, alpha);
            }
          `}
        />
      </mesh>
    </group>
  );
}

// ── 설비별 데크 자동 생성 (Three.js scene에서 GLB 탐색) ──
function EquipmentDecks() {
  const { scene: rootScene } = useThree();
  const [decks, setDecks] = useState<{
    id: string;
    position: [number, number, number];
    width: number;
    depth: number;
  }[]>([]);

  useEffect(() => {
    // GLB 로딩 + Draco 디코딩 후 바운딩박스 계산
    const timer = setTimeout(() => {
      const result: typeof decks = [];
      for (const eqId of DECK_EQUIPMENT) {
        const bbox = computeEquipmentBBox(rootScene, eqId);
        if (!bbox) continue;

        const center = new THREE.Vector3();
        bbox.getCenter(center);
        const size = new THREE.Vector3();
        bbox.getSize(size);

        const pad = DECK_PADDING[eqId] || { padX: 15, padZ: 15 };
        const deckW = size.x + pad.padX;
        const deckD = size.z + pad.padZ;

        result.push({
          id: eqId,
          position: [center.x, bbox.min.y, center.z],
          width: deckW,
          depth: deckD,
        });
      }
      if (result.length > 0) setDecks(result);
    }, 3000);
    return () => clearTimeout(timer);
  }, [rootScene]);

  return (
    <>
      {decks.map(d => (
        <DeckPlate key={d.id} position={d.position} width={d.width} depth={d.depth} />
      ))}
    </>
  );
}

// ── 메인 플랫폼 (전체 설비를 감싸는 큰 바닥판) ──
function MainPlatform() {
  const glowRef = useRef<THREE.ShaderMaterial>(null);
  // 육상 설비 영역, 로딩암 끝에서 컷 (선박/로딩암은 바다 위)
  // 우측 경계: ~X=235 (로딩암 시작점 부근에서 컷)
  const platformW = 390;  // X방향
  const platformD = 640;  // Z방향
  const platformH = 5;
  const radius = 12;

  const geometry = useMemo(() => {
    const shape = createRoundedRectShape(platformW, platformD, radius);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: platformH, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  // 하단 엣지 글로우 링
  const edgeGeometry = useMemo(() => {
    const shape = createRoundedRectShape(platformW + 3, platformD + 3, radius + 1);
    const points = shape.getPoints(80);
    const positions: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      positions.push(p.x, 0, p.y);
      positions.push(p.x, -5, p.y);
    }
    const geo = new THREE.BufferGeometry();
    const indices: number[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  const glowUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#00e5ff') },
  }), []);

  useFrame((_, delta) => {
    if (glowRef.current) glowRef.current.uniforms.uTime.value += delta;
  });

  // 중심: 우측 경계 45+195=240 (로딩암 끝), 좌측 45-195=-150
  const cx = 45, cz = -5;

  return (
    <group position={[cx, -6, cz]}>
      {/* 메인 플레이트 */}
      <mesh geometry={geometry} position={[0, 0, 0]}>
        <meshStandardMaterial
          color="#0e1118"
          roughness={0.9}
          metalness={0.2}
        />
      </mesh>

      {/* 엣지 글로우 */}
      <mesh geometry={edgeGeometry} position={[0, -platformH, 0]}>
        <shaderMaterial
          ref={glowRef}
          uniforms={glowUniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          vertexShader={`
            varying vec3 vPos;
            void main() {
              vPos = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 uColor;
            uniform float uTime;
            varying vec3 vPos;
            void main() {
              float t = smoothstep(0.0, -5.0, vPos.y);
              float pulse = 0.6 + 0.4 * sin(uTime * 1.2);
              float alpha = t * 0.5 * pulse;
              gl_FragColor = vec4(uColor * 1.2, alpha);
            }
          `}
        />
      </mesh>
    </group>
  );
}

// ── 정적 바다 (메인 플랫폼 바깥, 애니메이션 없음) ──
function StaticOcean() {
  // 메인 플랫폼 영역: center (45, -5), size 390×640
  const cx = 45, cz = -5;
  const halfW = 390 / 2, halfD = 640 / 2;

  const uniforms = useMemo(() => ({
    uDeepColor:    { value: new THREE.Color('#0a4d6e') },
    uShallowColor: { value: new THREE.Color('#1589ad') },
    uPlatformMin:  { value: new THREE.Vector2(cx - halfW, cz - halfD) },
    uPlatformMax:  { value: new THREE.Vector2(cx + halfW, cz + halfD) },
  }), []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[45, -12, -5]} renderOrder={-1}>
      <planeGeometry args={[5000, 5000]} />
      <shaderMaterial
        uniforms={uniforms}
        transparent
        depthWrite
        vertexShader={`
          varying vec2 vUv;
          varying vec3 vWorldPos;
          void main() {
            vUv = uv;
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPos.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uDeepColor;
          uniform vec3 uShallowColor;
          uniform vec2 uPlatformMin;
          uniform vec2 uPlatformMax;
          varying vec2 vUv;
          varying vec3 vWorldPos;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
              mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
              f.y
            );
          }

          void main() {
            // 플랫폼 영역 마스킹 (내부 discard)
            float margin = 8.0;
            if (vWorldPos.x > uPlatformMin.x + margin && vWorldPos.x < uPlatformMax.x - margin &&
                vWorldPos.z > uPlatformMin.y + margin && vWorldPos.z < uPlatformMax.y - margin) {
              discard;
            }

            // 플랫폼 경계 부드러운 페이드
            float dL = smoothstep(0.0, margin, vWorldPos.x - uPlatformMin.x);
            float dR = smoothstep(0.0, margin, uPlatformMax.x - vWorldPos.x);
            float dB = smoothstep(0.0, margin, vWorldPos.z - uPlatformMin.y);
            float dT = smoothstep(0.0, margin, uPlatformMax.y - vWorldPos.z);
            float platformFade = 1.0 - (dL * dR * dB * dT);

            // 정적 바다 색상 (노이즈 기반 패턴, 애니메이션 없음)
            float n = noise(vWorldPos.xz * 0.015);
            vec3 color = mix(uDeepColor, uShallowColor, n * 0.6);

            // 가장자리 페이드 (먼 바다 어둡게)
            float edgeFade = 1.0 - smoothstep(0.4, 0.5, length(vUv - 0.5));
            color *= edgeFade;

            gl_FragColor = vec4(color, max(platformFade, 0.0));
          }
        `}
      />
    </mesh>
  );
}

// ── 밝은 하늘 (그라데이션 + 구름) ──
function Sky() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSkyTop:    { value: new THREE.Color('#4a90c8') },
    uSkyMid:    { value: new THREE.Color('#87b8d8') },
    uHorizon:   { value: new THREE.Color('#c8dce8') },
    uCloudColor:{ value: new THREE.Color('#ffffff') },
  }), []);

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <mesh>
      <sphereGeometry args={[2000, 32, 32]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        vertexShader={`
          varying vec3 vWorldPos;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPos.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uSkyTop;
          uniform vec3 uSkyMid;
          uniform vec3 uHorizon;
          uniform vec3 uCloudColor;
          uniform float uTime;
          varying vec3 vWorldPos;
          varying vec2 vUv;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
          }
          float fbm(vec2 p) {
            float v = 0.0;
            float a = 0.5;
            for (int i = 0; i < 4; i++) {
              v += a * noise(p);
              p *= 2.0;
              a *= 0.5;
            }
            return v;
          }

          void main() {
            vec3 dir = normalize(vWorldPos);
            float height = dir.y;

            if (height < -0.02) discard;

            // 하늘 그라데이션
            vec3 sky = mix(uHorizon, uSkyMid, smoothstep(0.0, 0.15, height));
            sky = mix(sky, uSkyTop, smoothstep(0.15, 0.6, height));

            // 구름
            vec2 cloudUv = dir.xz / max(dir.y, 0.01) * 0.3;
            cloudUv += uTime * 0.003;
            float cloud = fbm(cloudUv * 2.0);
            cloud = smoothstep(0.35, 0.65, cloud);

            float cloudMask = smoothstep(0.0, 0.1, height) * smoothstep(0.6, 0.25, height);
            cloud *= cloudMask * 0.7;

            vec3 color = mix(sky, uCloudColor, cloud);

            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
}

// ── 통합 컴포넌트 ──
export function EnvironmentScene() {
  return (
    <>
      <Sky />
      <StaticOcean />
      <MainPlatform />
      <EquipmentDecks />
    </>
  );
}
