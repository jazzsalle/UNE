// ref: CLAUDE.md §5.7.1 — 배관 유체 흐름 애니메이션
// GLB 배관 메시(pipe_main_a, pipe_main_b)를 복제하여 UV 스크롤 셰이더로 유체 흐름 표현
'use client';
import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const STATUS_COLORS = {
  normal:   '#00E5FF',
  warning:  '#FFA726',
  critical: '#FF1744',
};

// 유체 흐름 오버레이 셰이더
const flowVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    // 약간 바깥으로 오프셋 (원본 메시 위에 오버레이)
    vec3 offsetPos = position + normal * 0.15;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(offsetPos, 1.0);
  }
`;

const flowFragmentShader = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    // 월드 좌표 기반 흐름 방향 (배관이 여러 방향으로 놓여있으므로 X+Z 조합)
    float flowCoord = (vWorldPos.x + vWorldPos.z) * 0.02;
    float scrolled = fract(flowCoord - uTime * uSpeed);

    // 유체 흐름 밴드 패턴
    float band1 = smoothstep(0.0, 0.15, scrolled) * smoothstep(0.5, 0.35, scrolled);
    float band2 = smoothstep(0.5, 0.65, scrolled) * smoothstep(1.0, 0.85, scrolled);
    float pattern = (band1 + band2) * 0.8 + 0.2;

    // 가장자리 프레넬 글로우
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 2.0);
    float edgeGlow = fresnel * 0.5;

    vec3 color = uColor * (pattern + edgeGlow);

    // 전체 알파: 흐름 패턴에 따라 투명도 변화
    float alpha = uOpacity * (0.3 + pattern * 0.5 + edgeGlow * 0.3);

    gl_FragColor = vec4(color, alpha);
  }
`;

interface PipeFlowOverlayProps {
  scene: THREE.Group;
  flowStatus?: 'normal' | 'warning' | 'critical';
  flowSpeed?: number;
  visible?: boolean;
}

// 배관 메시 이름 목록 (GLB 내부)
const PIPE_MESH_NAMES = ['pipe_main_a', 'pipe_main_b'];

export function PipeFlowSystem({
  scene,
  flowStatus = 'normal',
  flowSpeed = 1,
  visible = true,
}: PipeFlowOverlayProps) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  const color = new THREE.Color(STATUS_COLORS[flowStatus]);

  // 셰이더 머티리얼 생성 (1회)
  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: flowVertexShader,
      fragmentShader: flowFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: 0.5 * flowSpeed },
        uColor: { value: color },
        uOpacity: { value: 0.7 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    materialRef.current = mat;
    return mat;
  }, []);

  // GLB 배관 메시를 찾아서 geometry 복제 → 오버레이 메시 생성
  useEffect(() => {
    if (!scene || !groupRef.current) return;

    const group = groupRef.current;
    // 기존 오버레이 제거
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    for (const meshName of PIPE_MESH_NAMES) {
      const original = scene.getObjectByName(meshName) as THREE.Mesh | null;
      if (!original || !original.isMesh) continue;

      // geometry 복제
      const clonedGeo = original.geometry.clone();
      const overlay = new THREE.Mesh(clonedGeo, material);

      // 원본 메시의 월드 변환을 복제
      original.updateWorldMatrix(true, false);
      overlay.applyMatrix4(original.matrixWorld);

      overlay.renderOrder = 10;
      group.add(overlay);
    }
  }, [scene, material]);

  // 매 프레임 uniform 업데이트
  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
      materialRef.current.uniforms.uSpeed.value = 0.5 * flowSpeed;
      materialRef.current.uniforms.uColor.value.set(STATUS_COLORS[flowStatus]);
    }
  });

  if (!visible || flowSpeed <= 0) return null;

  return <group ref={groupRef} />;
}
