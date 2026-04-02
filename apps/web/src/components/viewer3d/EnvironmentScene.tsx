// 바닥 그리드 + 바다 + 하늘 배경
'use client';
import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

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

// ── 바닥 그리드 ──
function GroundGrid() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(() => ({
    uBaseColor: { value: new THREE.Color('#060810') },
    uLineColor: { value: new THREE.Color('#151c26') },
    uSubLineColor: { value: new THREE.Color('#0c1018') },
    uGridSize: { value: 25.0 },
  }), []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[40, 0.05, 0]}>
      <planeGeometry args={[370, 600]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vWorldXZ;
          void main() {
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldXZ = worldPos.xz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uBaseColor;
          uniform vec3 uLineColor;
          uniform vec3 uSubLineColor;
          uniform float uGridSize;
          varying vec2 vWorldXZ;

          float gridLine(vec2 coord, float size) {
            vec2 grid = abs(fract(coord / size - 0.5) - 0.5);
            vec2 aa = fwidth(coord / size) * 1.5;
            vec2 lines = smoothstep(aa, vec2(0.0), grid);
            return max(lines.x, lines.y);
          }

          void main() {
            float mainGrid = gridLine(vWorldXZ, uGridSize);
            float subGrid = gridLine(vWorldXZ, uGridSize / 5.0) * 0.4;

            vec3 color = uBaseColor;
            color = mix(color, uSubLineColor, subGrid);
            color = mix(color, uLineColor, mainGrid);

            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
}

// ── 바다 ──
function Ocean() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uDeepColor:    { value: new THREE.Color('#0a5e8a') },
    uShallowColor: { value: new THREE.Color('#1a9ec2') },
    uFoamColor:    { value: new THREE.Color('#5ec4e0') },
    // 바닥판 영역 마스킹 (그리드가 position [40,0.05,0] size [370,600])
    uGridMin: { value: new THREE.Vector2(40 - 370/2, 0 - 600/2) },  // (-145, -300)
    uGridMax: { value: new THREE.Vector2(40 + 370/2, 0 + 600/2) },  // (225, 300)
  }), []);

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[90, -3, 0]} renderOrder={-1}>
      <planeGeometry args={[4000, 4000, 128, 128]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        side={THREE.DoubleSide}
        transparent
        depthWrite
        vertexShader={`
          uniform float uTime;
          varying vec2 vUv;
          varying float vWave;
          varying vec3 vWorldPos;
          void main() {
            vUv = uv;
            vec3 pos = position;
            float wave1 = sin(pos.x * 0.008 + uTime * 0.4) * 1.5;
            float wave2 = sin(pos.y * 0.012 + uTime * 0.3) * 1.0;
            float wave3 = cos((pos.x + pos.y) * 0.006 + uTime * 0.5) * 0.8;
            pos.z += wave1 + wave2 + wave3;
            vWave = (wave1 + wave2 + wave3) / 3.3;
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
          uniform vec2 uGridMin;
          uniform vec2 uGridMax;
          varying vec2 vUv;
          varying float vWave;
          varying vec3 vWorldPos;
          void main() {
            // 바닥판(그리드) 영역 내부는 렌더링하지 않음
            float margin = 5.0;
            if (vWorldPos.x > uGridMin.x + margin && vWorldPos.x < uGridMax.x - margin &&
                vWorldPos.z > uGridMin.y + margin && vWorldPos.z < uGridMax.y - margin) {
              discard;
            }
            // 바닥판 경계 부근 부드러운 페이드
            float dLeft   = smoothstep(0.0, margin, vWorldPos.x - uGridMin.x);
            float dRight  = smoothstep(0.0, margin, uGridMax.x - vWorldPos.x);
            float dBottom = smoothstep(0.0, margin, vWorldPos.z - uGridMin.y);
            float dTop    = smoothstep(0.0, margin, uGridMax.y - vWorldPos.z);
            float gridFade = 1.0 - (dLeft * dRight * dBottom * dTop);

            // 바다 색상
            float mixFactor = smoothstep(-0.3, 0.6, vWave);
            vec3 color = mix(uDeepColor, uShallowColor, mixFactor);
            float foam = smoothstep(0.3, 0.7, vWave);
            color = mix(color, uFoamColor, foam * 0.3);

            // 반짝임
            float sparkle = pow(max(0.0, sin(vWorldPos.x * 0.3 + uTime * 1.5)
                          * sin(vWorldPos.z * 0.3 + uTime * 1.2)), 10.0);
            color += vec3(sparkle * 0.06);

            // 가장자리 페이드
            float edgeFade = 1.0 - smoothstep(0.42, 0.5, length(vUv - 0.5));
            color *= edgeFade;

            gl_FragColor = vec4(color, max(gridFade, 0.0));
          }
        `}
      />
    </mesh>
  );
}

// ── 하늘 (그라데이션 + 구름) ──
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

          // 심플 노이즈 (구름용)
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
            // 수직 방향 (y 기준 정규화)
            vec3 dir = normalize(vWorldPos);
            float height = dir.y;

            // 수평선 아래는 표시하지 않음
            if (height < -0.02) discard;

            // 하늘 그라데이션
            float t = smoothstep(-0.02, 0.5, height);
            vec3 sky = mix(uHorizon, uSkyMid, smoothstep(0.0, 0.15, height));
            sky = mix(sky, uSkyTop, smoothstep(0.15, 0.6, height));

            // 구름
            vec2 cloudUv = dir.xz / max(dir.y, 0.01) * 0.3;
            cloudUv += uTime * 0.003;
            float cloud = fbm(cloudUv * 2.0);
            cloud = smoothstep(0.35, 0.65, cloud);

            // 구름은 중간 높이에서 가장 많이, 상단/하단에서 사라짐
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
      <Ocean />
      <GroundGrid />
    </>
  );
}
