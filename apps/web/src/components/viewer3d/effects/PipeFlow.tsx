// ref: CLAUDE.md §5.7.1 — 배관 유체 흐름 애니메이션
// 설비 간 배관 경로를 따라 발광 입자가 이동하는 효과
'use client';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 공정 흐름 경로 정의: [from설비, to설비] 순서
// CLAUDE.md §9.2 공정 흐름: 선박→로딩암→배관→저장탱크→BOG압축기→재액화기(순환)
//                          저장탱크→이송펌프→배관→밸브→기화기
interface FlowSegment {
  from: [number, number, number];
  to: [number, number, number];
  type: 'liquid' | 'gas';  // LH2 액체 vs BOG 가스
  status: 'normal' | 'warning' | 'critical';
}

const STATUS_COLORS = {
  normal:   { liquid: '#00E5FF', gas: '#80DEEA' },  // 시안
  warning:  { liquid: '#FFA726', gas: '#FFB74D' },  // 주황
  critical: { liquid: '#FF1744', gas: '#FF5252' },  // 적색
};

// 파티클 셰이더 — UV 스크롤 기반 유체 흐름
const flowVertexShader = `
  attribute float aOffset;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uSize;

  varying float vAlpha;

  void main() {
    // 파티클의 위치를 시간에 따라 이동 (0~1 사이 반복)
    float progress = fract(aOffset + uTime * uSpeed);
    vAlpha = sin(progress * 3.14159) * 0.8 + 0.2;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (200.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const flowFragmentShader = `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    // 원형 파티클 + 부드러운 가장자리
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    float glow = 1.0 - smoothstep(0.1, 0.5, dist);
    gl_FragColor = vec4(uColor, vAlpha * glow * 0.9);
  }
`;

// BOG 가스 전용 — 파동 펄스 효과
const gasVertexShader = `
  attribute float aOffset;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uSize;

  varying float vAlpha;
  varying float vPulse;

  void main() {
    float progress = fract(aOffset + uTime * uSpeed);
    // 가스: 파동 형태로 크기 변화
    vPulse = sin(progress * 6.28318 * 3.0 + uTime * 4.0) * 0.5 + 0.5;
    vAlpha = (sin(progress * 3.14159) * 0.6 + 0.4) * (0.4 + vPulse * 0.3);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (1.0 + vPulse * 0.5) * (200.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const gasFragmentShader = `
  uniform vec3 uColor;
  varying float vAlpha;
  varying float vPulse;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    float glow = 1.0 - smoothstep(0.0, 0.5, dist);
    // 가스는 더 투명하고 퍼진 느낌
    gl_FragColor = vec4(uColor, vAlpha * glow * 0.6);
  }
`;

interface SingleFlowProps {
  from: [number, number, number];
  to: [number, number, number];
  type?: 'liquid' | 'gas';
  status?: 'normal' | 'warning' | 'critical';
  speed?: number;
  particleCount?: number;
  arcHeight?: number;
}

function SingleFlow({
  from, to,
  type = 'liquid',
  status = 'normal',
  speed = 0.15,
  particleCount = 40,
  arcHeight = 3,
}: SingleFlowProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const color = new THREE.Color(STATUS_COLORS[status][type]);

  // 곡선 경로 생성 (약간의 아크로 자연스러운 배관 느낌)
  const { positions, offsets } = useMemo(() => {
    const fromV = new THREE.Vector3(...from);
    const toV = new THREE.Vector3(...to);
    const mid = new THREE.Vector3().lerpVectors(fromV, toV, 0.5);
    mid.y += arcHeight;

    const curve = new THREE.QuadraticBezierCurve3(fromV, mid, toV);
    const curvePoints = curve.getPoints(particleCount - 1);

    const posArr = new Float32Array(particleCount * 3);
    const offArr = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      posArr[i * 3] = curvePoints[i].x;
      posArr[i * 3 + 1] = curvePoints[i].y;
      posArr[i * 3 + 2] = curvePoints[i].z;
      offArr[i] = i / particleCount;
    }

    return { positions: posArr, offsets: offArr };
  }, [from, to, particleCount, arcHeight]);

  const uniforms = useRef({
    uTime: { value: 0 },
    uSpeed: { value: speed },
    uColor: { value: color },
    uSize: { value: type === 'liquid' ? 4.0 : 5.0 },
  });

  // 색상/속도 업데이트
  uniforms.current.uColor.value = color;
  uniforms.current.uSpeed.value = speed;

  useFrame(({ clock }) => {
    uniforms.current.uTime.value = clock.getElapsedTime();
  });

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1));
    return geo;
  }, [positions, offsets]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: type === 'gas' ? gasVertexShader : flowVertexShader,
      fragmentShader: type === 'gas' ? gasFragmentShader : flowFragmentShader,
      uniforms: uniforms.current,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [type]);

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

// ─── 전체 배관 흐름 시스템 ───

interface PipeFlowSystemProps {
  equipmentPositions: Record<string, [number, number, number]>;
  flowStatus?: 'normal' | 'warning' | 'critical';
  flowSpeed?: number;  // 유량 비례 (0=정지, 1=정상, 2=과다)
  visible?: boolean;
}

// 공정 흐름 경로 정의
const FLOW_ROUTES: {
  from: string; to: string; type: 'liquid' | 'gas';
  arcHeight?: number; particleCount?: number;
}[] = [
  // 1단계: 하역 (선박 → 로딩암 → 배관 → 저장탱크)
  { from: 'SHP-001', to: 'ARM-101', type: 'liquid', arcHeight: 5, particleCount: 30 },
  { from: 'ARM-101', to: 'PIP-501', type: 'liquid', arcHeight: 2, particleCount: 25 },
  { from: 'PIP-501', to: 'TK-101', type: 'liquid', arcHeight: 4, particleCount: 30 },

  // 2단계: BOG 순환 (저장탱크 → BOG 압축기 → 재액화기 → 저장탱크)
  { from: 'TK-101', to: 'BOG-201', type: 'gas', arcHeight: 8, particleCount: 35 },
  { from: 'BOG-201', to: 'REL-701', type: 'gas', arcHeight: 5, particleCount: 25 },
  { from: 'REL-701', to: 'TK-101', type: 'liquid', arcHeight: 4, particleCount: 20 },

  // 3단계: 이송 (저장탱크 → 이송펌프 → 밸브)
  { from: 'TK-101', to: 'PMP-301', type: 'liquid', arcHeight: 5, particleCount: 30 },
  { from: 'PMP-301', to: 'VAL-601', type: 'liquid', arcHeight: 4, particleCount: 25 },

  // 4단계: 기화 (밸브 → 기화기)
  { from: 'VAL-601', to: 'VAP-401', type: 'liquid', arcHeight: 5, particleCount: 30 },
];

export function PipeFlowSystem({
  equipmentPositions,
  flowStatus = 'normal',
  flowSpeed = 1,
  visible = true,
}: PipeFlowSystemProps) {
  if (!visible || flowSpeed <= 0) return null;

  // 속도 매핑: flowSpeed 1 = 0.15, 2 = 0.3
  const speed = 0.15 * flowSpeed;

  return (
    <>
      {FLOW_ROUTES.map((route, i) => {
        const fromPos = equipmentPositions[route.from];
        const toPos = equipmentPositions[route.to];
        if (!fromPos || !toPos) return null;

        return (
          <SingleFlow
            key={`flow-${i}`}
            from={fromPos}
            to={toPos}
            type={route.type}
            status={flowStatus}
            speed={speed}
            particleCount={route.particleCount || 30}
            arcHeight={route.arcHeight || 3}
          />
        );
      })}
    </>
  );
}
