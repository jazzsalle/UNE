# CLAUDE.md — 액화수소 인수기지 디지털 트윈 자율안전관리 플랫폼 POC

> 이 문서는 Claude Code가 POC를 구현하기 위한 단일 개발 가이드임
> 관점: 유엔이(플랫폼 개발사) 기준. 외부기관(KOGAS, KGS, KETI, 세이프티아)은 각자 서버를 운영하며, 플랫폼은 API로만 연동함
> POC 목적: 참여기관이 접속하여 예상 플랫폼 모습을 체험하고, 기관 간 상세 설계를 돕는 것

---

## 1. 아키텍처 개요

### 1.1 시스템 구조

```
[사용자 브라우저]
    ↕ HTTPS
[Frontend - Next.js on Vercel]
    ↕ REST API / SSE
[Backend - Node.js on Railway]
    ↕
[PostgreSQL on Railway]      [Cloudflare R2 - GLB 파일]

※ 외부기관 서버는 POC에서 Mock Provider로 대체
```

### 1.2 외부기관 연동 원칙 (중요)

플랫폼이 직접 개발하는 영역과 외부기관 API 연동 영역을 반드시 구분해야 함:

| 기관 | 역할 | POC 구현 방식 |
|------|------|-------------|
| KOGAS | 이상탐지/고장인지 AI 모델 운영 | Mock Provider가 scenario_id 기준으로 진단결과 JSON 반환 |
| KGS | 상호영향 위험예측 엔진 운영 | Mock Provider가 scenario_id 기준으로 영향설비/위험도 JSON 반환 |
| KETI | 시뮬레이션 엔진 + 동적 저작도구 운영 | Mock Provider가 scenario_id 기준으로 시뮬레이션 결과 JSON 반환 |
| 세이프티아 | 사고대응/이력관리 시스템 운영 | Mock Provider가 scenario_id 기준으로 이력 JSON 반환 |

**플랫폼(유엔이)이 직접 개발하는 것:**
- 3D/2D 통합 모니터링 뷰어
- 알람/이벤트 관리
- 센서 데이터 수집/표출
- 외부기관 결과의 시각화 (2D 네트워크, 3D 컬러링, HAZOP 텍스트 표출)
- SOP 저작/편집/실행 서비스
- 보고서 자동생성/편집
- 설정 관리
- 시나리오 에뮬레이터

**플랫폼이 만들지 않는 것 (외부기관 API 호출로만 처리):**
- AI 이상탐지/고장인지 모델 (KOGAS)
- 상호영향 위험예측 알고리즘 (KGS)
- 시뮬레이션 엔진/하이브리드 모델링 (KETI)
- 비상상황 시나리오 라이브러리/이력DB (세이프티아)

---

## 2. 기술스택

```
Frontend:
  - Next.js 14 (App Router)
  - React 18
  - TypeScript
  - Three.js + @react-three/fiber + @react-three/drei (3D GLB 뷰어)
  - react-flow (2D 영향 네트워크 그래프)
  - recharts (센서 시계열 차트)
  - Zustand (전역 상태관리)
  - Tailwind CSS
  - 배포: Vercel

Backend:
  - Node.js + Express (또는 Fastify)
  - TypeScript
  - Prisma ORM
  - PostgreSQL
  - SSE (Server-Sent Events) for 실시간 이벤트
  - 배포: Railway

Storage:
  - Cloudflare R2 (50MB+ GLB 파일)
  - Railway PostgreSQL (seed 데이터 + 운영 데이터)
```

---

## 3. 모드 체계

### 3.1 운영 모드 (6개)

| 모드 | 코드 | 설명 |
|------|------|------|
| 기본 모니터링 | M-MON | 3D/2D 공간 보기, 설비 상태, 센서값, 알람 확인. 상시 운영 기본 화면 |
| 설비 상태감시/이상탐지 | M-ANO | KOGAS 진단결과 표출, 센서 추세 차트, 설비별 이상진단 요약 |
| 위험예측 | M-RSK | KGS 2D 영향 네트워크 + 3D 설비 컬러링 + HAZOP 텍스트 통합 |
| 시뮬레이션/의사결정지원 | M-SIM | KETI 시뮬레이션 결과 표출, 대응안 비교, 수동 파라미터 입력 가능 |
| 이력조회/분석 | M-HIS | 세이프티아 이력, 설비 점검/사고/정비 이력 조회 |
| SOP | M-SOP | SOP 실행(메인) + 저작/편집/버전관리(부가 기능) |

### 3.2 보조 페이지 (2개)

| 페이지 | 코드 | 설명 |
|--------|------|------|
| 설정 | P-SET | 센서 메타데이터, 설비 임계치, 운영정책 관리 |
| 보고서 | P-RPT | 이벤트 조치 보고서 자동생성/편집/저장 |

### 3.3 SOP 모드 설계 핵심

**SOP 모드(M-SOP)는 실행이 메인 기능임:**
- **실행 탭**: SOP 목록 → SOP 상세 → 체크리스트 실행 → 메모 → 완료/상황전파
- **저작/편집 탭**: SOP 생성 → 단계 추가/삭제 → 대상 설비/공간 지정 → 저장

**운영모드에서의 SOP 호출 방식 (듀얼 UI):**

1. 운영모드(모니터링/이상탐지/위험예측 등)에서 이벤트 팝업의 [SOP] 버튼 클릭
2. 두 가지 동작 중 선택 가능:
   - **[SOP 팝업 실행]**: 현재 모드를 유지하면서 우측에 축소된 SOP 실행 패널 팝업
   - **[SOP 모드로 이동]**: M-SOP 전체화면으로 전환하여 실행

3. 축소 팝업과 전체화면 SOP 실행 UI는 동일한 컴포넌트의 크기만 다른 버전임:
   - `<SopExecutionPanel compact={true} />` → 팝업용 (너비 400px)
   - `<SopExecutionPanel compact={false} />` → 전체화면용

---

## 4. 모드 간 연계 구조

### 4.1 EventContext (공유 상태)

모든 모드는 EventContext를 공유하며, 모드 전환 시 컨텍스트가 유지됨:

```typescript
// stores/eventStore.ts (Zustand)
interface EventContext {
  event_id: string | null;
  scenario_id: string | null;
  trigger_equipment_id: string | null;
  affected_equipment_ids: string[];
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';
  current_phase: string;
  hazop_id: string | null;
  // 각 모드에서 enrich
  kogas_result?: MockKogasResult;
  kgs_results?: MockKgsResult[];
  keti_result?: MockKetiResult;
  safetia_history?: MockSafetiaHistory[];
  recommended_sops?: SopCatalogEntry[];
}

interface AppStore {
  currentMode: ModeCode;
  eventContext: EventContext | null;
  selectedEquipmentId: string | null;
  emulatorState: EmulatorState;
  // actions
  setMode: (mode: ModeCode) => void;
  setEventContext: (ctx: EventContext) => void;
  switchModeWithContext: (mode: ModeCode) => void;  // 이벤트 컨텍스트 유지하며 모드 전환
}
```

### 4.2 이벤트 기반 연계 흐름

```
[기본 모니터링]
  └─ 이상 이벤트 감지 (phase: SYMPTOM → FAULT)
       └─ 상단 알람 바 + 이벤트 팝업
            ├─ [설비 상세] → 카메라 이동 + 설비 컬러링 + 센서 패널
            ├─ [이상탐지] → M-ANO 전환 (KOGAS 진단결과 로드)
            ├─ [이력조회] → M-HIS 전환 (세이프티아 이력 로드)
            ├─ [위험예측] → M-RSK 전환 (KGS 결과 로드, 영향설비 컬러링)
            ├─ [시뮬레이션] → M-SIM 전환 (KETI 결과 로드)
            └─ [SOP] → SOP 추천목록 표시
                 ├─ [팝업 실행] → 현재 모드 유지 + 우측 SOP 패널
                 └─ [전체화면] → M-SOP 전환
```

### 4.3 시뮬레이션 독립 실행

시뮬레이션은 이벤트 연계 외에 독립 실행도 가능:
- M-SIM에서 직접 시나리오 선택 (또는 신규 파라미터 입력)
- 이벤트 컨텍스트 없이도 시나리오 기반으로 실행 가능
- 파라미터 수동 입력: trigger 설비, 이상 유형, 초기 센서값 등

---

## 5. 3D GLB 처리

### 5.1 GLB 파일 목록 및 원칙

| 파일명 | 용도 | 크기 | Draco | 정점 수 | 호스팅 |
|--------|------|------|-------|---------|--------|
| h2.glb | 테스트베드 기지 전체 (선박 포함) | 30MB | ✅ Required | 8,326,413 | Cloudflare R2 런타임 로드 |
| secondary_pump.glb | 2차 펌프 상세 (이상탐지 M-ANO용) | 210KB | ❌ 미사용 | 9,388 | 앱 번들 포함 (`public/models/`) |

- h2.glb는 Blender 5.1에서 `KHR_draco_mesh_compression` (Required)으로 익스포트됨
- secondary_pump.glb는 Draco 미사용 → 별도 디코더 없이 로드 가능
- 선박(SHP-001)은 h2.glb 내부에 포함되어 있음 (별도 파일 아님)
- h2.glb는 EMPTY 부모 → MESH 자식 구조로 정리됨 (설비 ID = EMPTY 이름, glb_object_name = MESH 이름)

### 5.2 mesh-equipment 매핑 (확정)

h2.glb 내부는 **EMPTY(부모, 설비 ID) → MESH(자식, glb_object_name)** 구조:

| EMPTY (부모) | MESH (자식=glb_object_name) | 정점 수 | 설비명 | seed 매핑 |
|-------------|--------------------------|---------|--------|----------|
| SHP-001 | ship_carrier_001 | 260,661 | LH2 운반선 #1 | ✅ |
| ARM-101 | loading_arm_101 | 5,007,469 | 로딩암 #1 | ✅ |
| TK-101 | tank_101 | 461,107 | LH2 저장탱크 #1 | ✅ |
| TK-102 | tank_102 | 461,107 | LH2 저장탱크 #2 | ⚠ seed 추가 필요 |
| BOG-201 | bog_compressor_201 | 1,739,558 | BOG 압축기 #1 | ✅ |
| PMP-301 | pump_301 | 195,854 | LH2 이송펌프 #1 | ✅ |
| VAP-401 | vaporizer_401 | 215,859 | 기화기 #1 | ✅ |
| REL-701 | reliquefier_701 | 6,218 | BOG 재액화기 #1 | ✅ |
| VAL-601 | valve_station_601 | 90,465 | 주요 차단밸브 스테이션 #1 | ✅ |
| VAL-602 | valve_station_602 | 90,465 | 주요 차단밸브 스테이션 #2 | ⚠ seed 추가 필요 |
| PIP-501 | pipe_main_a / pipe_main_b | 2,072 | 메인 이송배관 | ✅ |
| SWP-001 | seawater_pump_001 | 56,028 | 해수펌프 | ⚠ seed 추가 필요 |
| TERRAIN | terrain_ground | 981 | 지형 | — (비설비) |
| GROUND | — | — | 바닥 | — (비설비) |

**Three.js에서 설비 mesh 검색 방법:**

```typescript
// h2.glb 로드 후 설비 mesh 찾기
function findEquipmentMesh(scene: THREE.Group, glbObjectName: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  scene.traverse((obj) => {
    if (obj.name === glbObjectName) found = obj;
  });
  return found;
}

// 또는 EMPTY 부모(설비 ID)로 찾은 뒤 자식 mesh 접근
function findByEquipmentId(scene: THREE.Group, equipmentId: string): THREE.Object3D | null {
  const empty = scene.getObjectByName(equipmentId);  // e.g., 'BOG-201'
  if (!empty || empty.children.length === 0) return null;
  return empty.children[0];  // 자식 MESH
}
```

### 5.3 컬러링 규칙 (visual_state 우선순위)

```typescript
const COLOR_MAP: Record<VisualState, string> = {
  emergency:  '#FF1744',  // 적색
  critical:   '#FF5722',  // 주홍
  simTarget:  '#E040FB',  // 보라 (시뮬레이션 대상)
  affected:   '#FFEE58',  // 황색 (영향 설비)
  warning:    '#FFA726',  // 주황
  normal:     '#66BB6A',  // 녹색 (또는 기본 재질 유지)
};
// 우선순위: emergency > critical > simTarget > affected > warning > normal
```

### 5.4 최소 컬러링 대상 설비

SHP-001, ARM-101, TK-101, TK-102, BOG-201, PMP-301, VAP-401, PIP-501, VAL-601, VAL-602, REL-701

> SWP-001(해수펌프), TERRAIN(지형)은 컬러링 대상에서 제외

### 5.5 카메라 프리셋 매핑 (좌표 확정)

Blender에서 추출한 world-space 바운딩박스 기반 확정 좌표:

```typescript
// lib/cameraPresets.ts
export const CAMERA_PRESETS: Record<string, { target: [number, number, number]; position: [number, number, number]; description: string }> = {
  cam_ship_carrier_001:    { target: [303.0, -95.9, 12.8],  position: [425.2, -10.4, 73.9],   description: '선석 정면, 운반선 전체 조망' },
  cam_loading_arm_101:     { target: [271.8, -121.1, 8.6],  position: [398.0, -32.8, 71.7],   description: '로딩암 연결부 클로즈업' },
  cam_tank_101:            { target: [144.7, -208.2, 22.4], position: [215.5, -158.6, 57.8],  description: '저장탱크 #1 측면' },
  cam_tank_102:            { target: [47.2, -204.4, 22.4],  position: [118.0, -154.9, 57.8],  description: '저장탱크 #2 측면' },
  cam_bog_compressor_201:  { target: [33.4, -43.6, 21.1],   position: [119.9, 16.9, 64.4],    description: 'BOG 압축기 정면' },
  cam_pump_301:            { target: [140.6, 54.1, 25.4],   position: [192.4, 90.4, 51.3],    description: '이송펌프 측면' },
  cam_vaporizer_401:       { target: [133.4, 189.0, 30.6],  position: [196.6, 233.3, 62.3],   description: '기화기 입출구 배관 포함' },
  cam_reliquefier_701:     { target: [143.7, -59.4, 30.9],  position: [202.8, -18.0, 60.5],   description: '재액화기 전면' },
  cam_valve_station_601:   { target: [-52.2, -47.9, 39.8],  position: [27.7, 8.0, 79.8],      description: '밸브 스테이션 #1 정면' },
  cam_valve_station_602:   { target: [-2.5, 177.4, 39.8],   position: [77.5, 233.4, 79.8],    description: '밸브 스테이션 #2 정면' },
  cam_pipe_main_a:         { target: [59.4, -8.0, 24.3],    position: [464.9, 275.9, 227.1],  description: '메인 이송배관 전경' },
  cam_overview:            { target: [90.0, 0.0, 20.0],     position: [350.0, 350.0, 300.0],  description: '인수기지 전체 조감도' },
  cam_berth_overview:      { target: [280.0, -110.0, 10.0], position: [450.0, 50.0, 150.0],   description: '선석/하역부 전체 조망' },
};
```

카메라 이동은 `gsap` 또는 Three.js `lerp`로 0.8초 부드러운 전환 적용.

```typescript
// components/viewer3d/CameraController.tsx
import { useThree } from '@react-three/fiber';
import gsap from 'gsap';

export function useCameraTransition() {
  const { camera } = useThree();

  const moveTo = (presetName: string) => {
    const preset = CAMERA_PRESETS[presetName];
    if (!preset) return;

    gsap.to(camera.position, {
      x: preset.position[0], y: preset.position[1], z: preset.position[2],
      duration: 0.8, ease: 'power2.inOut',
    });
    // lookAt은 OrbitControls의 target을 이동
  };

  return { moveTo };
}
```

### 5.6 2차 펌프 상세 GLB (secondary_pump.glb) — ✅ 검증 완료

이상탐지 모드에서 설비 상세 3D 뷰어로 사용. **210KB로 앱 번들에 포함 가능** (`public/models/secondary_pump.glb`).

- 생성 도구: trimesh (Python)
- Draco 미사용 → 별도 디코더 불필요
- 정점 수: 9,388 (렌더: 53,076)
- 바운딩박스: (-0.15, -0.15, -2.02) ~ (0.20, 0.15, 0.45) → 매우 작은 단위(미터 기준)
- **M-ANO 모드에서 로드 시 스케일 조정 필요** (h2.glb와 단위 체계 다름)

**mesh 목록 (21개):**

| mesh name | 설명 | 이상탐지 컬러링 대상 |
|-----------|------|------------------|
| mounting_plate | 마운팅 플레이트 | — |
| discharge_pipe | 토출배관 | — |
| outer_can | 외통(캔) | — |
| shaft | 회전축 | ✅ 베어링/축 이상 시 |
| impeller_stage_01 ~ 08 | 임펠러 1~8단 | ✅ 캐비테이션/마모 이상 시 |
| diffuser_bowl_01 ~ 08 | 디퓨저 보울 1~8단 | ✅ 유로 막힘 이상 시 |
| inlet_cone | 흡입콘 | ✅ 흡입압 이상 시 |

**SC-02 이상탐지 시나리오 컬러링:**
- SYMPTOM phase: `impeller_stage_03` WARNING 컬러 (진동 상승 시작)
- FAULT phase: `impeller_stage_03`, `impeller_stage_04` CRITICAL 컬러 + `shaft` WARNING 컬러
- SECONDARY_IMPACT: `diffuser_bowl_03`, `diffuser_bowl_04` affected 컬러
- RESPONSE: 점진적 normal 복귀

이상탐지 모드(M-ANO)에서 설비 목록 중 PMP-301 선택 시, 중앙 3D 뷰어에 이 GLB을 로드하고 위 컬러링 규칙을 적용.

### 5.7 3D 시각 이펙트 및 애니메이션

레퍼런스 시안(시안01.png)을 기반으로 한 시각 이펙트 명세. GLB 파일 제공 후 mesh name 확인하여 구현.

#### 5.7.1 배관 유체 흐름 애니메이션

```
[선박] ===🟢===🟢===🟢==> [로딩암] ===🟢===🟢==> [배관] ===🟢===🟢==> [저장탱크]
                          ↑ 녹색 점/입자가 흐름 방향으로 이동
```

- **LH2 (액체) 라인**: 녹색/시안 발광 점(particle)이 배관 경로를 따라 연속 이동
  - Three.js `ShaderMaterial` + UV 스크롤 또는 `Points` 기반 파티클
  - 유량(FLOW)에 비례하여 이동 속도 조절 (유량 0 → 정지, 유량 정상 → 1x, 유량 과다 → 2x)
  - 이상 시 색상 변경: 정상=녹색, 경고=주황, 위험=적색
- **BOG (가스) 라인**: 반투명 파동/펄스 애니메이션
  - 압력 상승 시 파동 간격 좁아지고 속도 증가
- **구현 방식**: 배관 mesh의 UV 좌표를 활용한 셰이더 기반 추천 (파티클 수천 개보다 성능 유리)
- **GLB 전제**: 배관 mesh가 `pipe_*` 또는 `line_*` 이름으로 식별 가능해야 함
  - GLB 제공 후 mesh name 확인하여 배관 경로 매핑

#### 5.7.2 저장탱크 내부 레벨/압력 시각화

```
    ┌───────────┐
    │           │  ← 탱크 외벽 (반투명)
    │  ░░░░░░░  │  ← 빈 공간 (BOG 가스 영역)
    │  ░░░░░░░  │
    │  ▓▓▓▓▓▓▓  │  ← LH2 액면 (레벨에 따라 높이 변화)
    │  ▓▓▓▓▓▓▓  │
    │  ███████  │  ← 하부 (진한 색)
    └───────────┘
```

- **레벨 표현**: 탱크 mesh 내부에 평면(plane)을 넣어 LH2 액면 높이를 레벨% 기준으로 조절
  - 레벨 65% → 탱크 높이의 65% 위치에 액면
  - 액면 위: BOG 가스 영역 (투명~연한 파란)
  - 액면 아래: LH2 액체 (시안~파란 그라데이션)
- **압력 표현**: 탱크 외벽 색상 변화 + 글로우 효과
  - 정상 압력: 시안/파란 (레퍼런스 이미지의 왼쪽 탱크처럼)
  - 경고 압력: 주황 글로우
  - 위험 압력: 적색 글로우 + 펄스 점멸 (레퍼런스의 빨간 탱크처럼)
- **구현**: `ShaderMaterial`로 탱크 mesh에 커스텀 셰이더 적용. uniform으로 level%, pressure 전달.

#### 5.7.3 설비 상태 글로우/아우라 효과

- 이상 설비 주변에 반투명 글로우 오버레이
  - `MeshBasicMaterial` + `AdditiveBlending` + 약간 확대한 복제 mesh
  - WARNING: 주황 글로우, CRITICAL: 적색 글로우 + 펄스
  - 애니메이션: opacity 0.3~0.7 사이 sin 곡선 반복
- 정상 설비: 글로우 없음 (기본 재질만)

#### 5.7.4 위험 반경 히트맵 오버레이

레퍼런스 이미지의 녹색~빨간 원형 히트맵 효과:

```
         ┌──────────────────────┐
         │      🟢 안전        │
         │    🟡 주의           │
         │  🟠 경고             │
         │ 🔴 위험 [설비]       │
         │  🟠 경고             │
         │    🟡 주의           │
         │      🟢 안전        │
         └──────────────────────┘
```

- 위험예측/시뮬레이션 모드에서 활성화
- trigger 설비 중심으로 반투명 원형 평면(CircleGeometry) 배치
- 중심(적색) → 외곽(녹색) 방사형 그라데이션
- 반경은 KGS `impact_score` 비례 (score 90 → 큰 반경, score 50 → 작은 반경)
- `ShaderMaterial` + `transparent: true` + 지면에 평행하게 배치
- 시간축 슬라이더 조작 시 반경이 점진적으로 확대/축소

#### 5.7.5 영향 전파 경로 애니메이션

- trigger → affected 설비 방향으로 점선/파티클이 흘러가는 효과
- `Line2` (three/examples) 또는 `TubeGeometry` + dash 애니메이션
- 경로 색상: trigger(적색) → affected(황색) 그라데이션
- 속도: `predicted_after_sec`에 반비례 (빠른 전파 = 빠른 애니메이션)

#### 5.7.6 이펙트 활성화 조건

| 이펙트 | 활성화 조건 | 비활성화 조건 |
|--------|-----------|------------|
| 배관 흐름 | 항상 (모니터링/시뮬레이션) | — |
| 탱크 레벨/압력 | 항상 (센서값 연동) | — |
| 설비 글로우 | 이벤트 발생 (WARNING 이상) | 이벤트 종료 / normal 복귀 |
| 히트맵 오버레이 | M-RSK, M-SIM에서 분석 실행 후 | 다른 모드 전환 시 |
| 영향 전파 경로 | M-RSK에서 KGS 결과 로드 후 | 초기화 또는 모드 전환 시 |

#### 5.7.7 성능 가이드라인

- 파티클 수는 배관당 최대 200개 (전체 합계 1000개 이내)
- 히트맵 텍스처는 512x512 해상도 (런타임 생성)
- 글로우 mesh는 원본 mesh 복제 후 scale 1.05x (별도 렌더패스 불필요)
- 모든 이펙트는 `requestAnimationFrame` 루프 내에서 uniform 업데이트만으로 처리
- 모바일/저사양 대비 이펙트 ON/OFF 토글 제공 (설정 페이지)

#### 5.7.8 GLB 확인 사항 (확정 완료)

```
[✅] 배관 mesh 이름 목록 → pipe_main_a, pipe_main_b (PIP-501 하위)
[✅] 저장탱크 mesh 구조 → tank_101, tank_102 (각 461K 정점, 내부 액면 plane 배치 가능)
[✅] 설비별 mesh 바운딩박스 → 섹션 5.5 카메라 프리셋에 반영 완료
[✅] 전체 씬 크기/좌표계 → BBox: (-165, -14, -337) ~ (335, 80, 401), 약 500×94×738 단위
[✅] 선박/로딩암 mesh 이름 → ship_carrier_001 (SHP-001 하위), loading_arm_101 (ARM-101 하위)
[✅] secondary_pump.glb → 21개 mesh 명세와 100% 일치 확인
```

---

## 6. 시나리오 에뮬레이터

### 6.1 목적
실데이터 없이 seed 시계열을 재생하여 전체 서비스 흐름을 체험

### 6.2 동작 흐름

```
1. 사용자: 시나리오 선택 (SC-01 ~ SC-07) + 재생속도 선택 (1x/10x/30x/60x)
2. [START] → 서버 타이머 시작, SSE로 클라이언트에 이벤트 푸시
3. elapsed_sec 기반으로 현재 phase 결정 (scenarios.phases 참조)
4. phase별 처리:

   NORMAL (0~179s):
     - 정상 센서값 송출
     - 3D: 전 설비 normal 상태
     - 알람: 없음

   SYMPTOM (180~359s):
     - 초기 이상 센서값 송출 (trigger 설비 기준)
     - 3D: trigger 설비 warning 컬러링
     - 알람: WARNING 이벤트 생성 → 상단 알람 바 표시 → 이벤트 팝업 출력
     - 활성화: KOGAS mock 결과 조회 가능

   FAULT (360~599s):
     - 이상 확대 센서값 송출
     - 3D: trigger 설비 critical/emergency 컬러링
     - 알람: CRITICAL 이벤트 업데이트
     - 활성화: KGS mock 결과 → affected 설비 3D 컬러링
     - 활성화: SOP 추천 목록 (SOP 버튼 활성화)
     - EventContext에 kogas_result, kgs_results, recommended_sops 추가

   SECONDARY_IMPACT (600~779s):
     - 영향 설비 센서값 변화
     - 3D: affected 설비 affected 컬러링 확대
     - 활성화: KETI mock 결과 (시뮬레이션 버튼 활성화)

   RESPONSE (780~900s):
     - 대응 완료 센서값 (점진적 정상화)
     - 3D: 점진적 normal 복귀
     - 이벤트: CLOSED 처리
     - 트리거: 보고서 초안 자동생성

5. [STOP/END] → 시나리오 종료, 전 설비 normal
```

### 6.3 SSE 이벤트 포맷

```typescript
// SSE endpoint: GET /api/emulator/stream?scenario_id=SC-01&speed=10
// Events:
interface EmulatorEvent {
  type: 'SENSOR_UPDATE' | 'PHASE_CHANGE' | 'ALARM' | 'EVENT_CREATE' | 'EVENT_UPDATE' | 'SCENARIO_END';
  timestamp: string;
  phase: string;
  elapsed_sec: number;
  data: SensorDataBatch | PhaseInfo | AlarmInfo | EventInfo;
}
```

---

## 7. REST API 명세

### 7.1 시나리오/에뮬레이터

```
GET    /api/scenarios                         시나리오 목록
GET    /api/scenarios/:id                     시나리오 상세 (phases, hazop_id 포함)
POST   /api/emulator/start                    시나리오 시작 {scenario_id, speed}
POST   /api/emulator/stop                     시나리오 중지
GET    /api/emulator/status                   현재 상태 {running, scenario_id, elapsed_sec, phase}
GET    /api/emulator/stream                   SSE 스트림
```

### 7.2 설비/센서

```
GET    /api/equipment                         설비 목록
GET    /api/equipment/:id                     설비 상세
GET    /api/equipment/:id/sensors             설비별 센서 목록 + 현재값
GET    /api/sensors/:id/timeseries            센서 시계열 (query: scenario_id, from, to)
GET    /api/zones                             공간(zone) 목록
```

### 7.3 이벤트/알람

```
GET    /api/events                            이벤트 목록 (query: status, severity, scenario_id)
GET    /api/events/:id                        이벤트 상세 (enriched: kogas, kgs, keti, safetia, sop 포함)
PATCH  /api/events/:id                        이벤트 상태 변경
GET    /api/events/stream                     SSE 실시간 이벤트
```

### 7.4 외부기관 Mock Provider

```
GET    /api/provider/kogas/:scenario_id       KOGAS 이상탐지/고장인지 결과
GET    /api/provider/kgs/:scenario_id         KGS 상호영향 위험예측 결과 (배열)
GET    /api/provider/keti/:scenario_id        KETI 시뮬레이션 결과
GET    /api/provider/safetia/:scenario_id     세이프티아 이력
GET    /api/provider/kogas/health             KOGAS 연결상태 (200/503)
GET    /api/provider/kgs/health               KGS 연결상태
GET    /api/provider/keti/health              KETI 연결상태
GET    /api/provider/safetia/health           세이프티아 연결상태
POST   /api/provider/kgs/analyze              KGS 위험예측 요청 {equipment_id, sensor_data, params}
POST   /api/provider/keti/simulate            KETI 시뮬레이션 요청 {scenario_id, params}
```

**외부기관 데이터 전송 방식 정리:**

| 기관 | 데이터 전송 방식 | 사용자 입력 필요 여부 |
|------|---------------|-------------------|
| KOGAS | 에뮬레이터가 자동 전송 (이벤트 발생 시 센서값 push) | 불필요. 자동 감지 → 자동 진단 |
| KGS | 이벤트 연계: 자동 전송. 수동: 사용자가 설비+파라미터 입력 후 [실행] | **수동 실행 시 입력 UI 필요** |
| KETI | 이벤트 연계: 자동 전송. 수동: 사용자가 시나리오+파라미터 입력 후 [실행] | **수동 실행 시 입력 UI 필요** |
| 세이프티아 | 플랫폼이 이벤트 종료 시 자동 기록 요청 | 불필요. 자동 기록 |

따라서 KGS/KETI는 **수동 실행 모드에서 파라미터 입력 UI가 필요**하며, 이는 M-RSK와 M-SIM의 입력 패널에서 제공됨.
이벤트 연계 모드에서는 EventContext의 센서값이 자동으로 전송되므로 사용자 입력 불필요.

### 7.5 HAZOP

```
GET    /api/hazop/:scenario_id                시나리오별 HAZOP 상세
GET    /api/hazop                             전체 HAZOP 목록
```

### 7.6 SOP

```
GET    /api/sop                               SOP 목록 (query: category, equipment_id, status)
GET    /api/sop/:id                           SOP 상세 (steps 포함)
POST   /api/sop                               SOP 생성
PUT    /api/sop/:id                           SOP 수정
GET    /api/sop/recommend                     이벤트 기반 SOP 추천 (query: event_id, equipment_id, severity)
POST   /api/sop/:id/execute                   SOP 실행 시작 → execution_id 반환
PUT    /api/sop/execution/:exec_id            실행 단계 업데이트 (checked_steps, memo)
POST   /api/sop/execution/:exec_id/complete   실행 완료
POST   /api/sop/execution/:exec_id/broadcast  상황전파 (action log만 기록)
GET    /api/sop/executions                    SOP 실행이력 목록 (query: event_id, scenario_id)
```

### 7.7 보고서

```
GET    /api/reports                            보고서 목록
GET    /api/reports/:id                        보고서 상세
POST   /api/reports/generate                   이벤트 기반 초안 자동생성 {event_id}
PUT    /api/reports/:id                        보고서 수정 (manager_comment 등)
PATCH  /api/reports/:id/status                 상태 변경 (DRAFT → SUBMITTED)
```

### 7.8 설정

```
GET    /api/settings                           설정 목록
PUT    /api/settings/:id                       설정 변경
GET    /api/thresholds                         임계치 목록 (query: equipment_id)
PUT    /api/thresholds/:sensor_id              임계치 수정
GET    /api/sensor-meta                        센서 메타데이터 목록
PUT    /api/sensor-meta/:sensor_id             센서 메타데이터 수정 (enabled, interval 등)
```

---

## 8. 데이터베이스 설계

### 8.1 Prisma Schema 핵심 모델

```prisma
model EquipmentMaster {
  equipment_id    String   @id
  equipment_name  String
  equipment_type  String   // LH2_CARRIER | LOADING_ARM | STORAGE_TANK | BOG_COMPRESSOR | TRANSFER_PUMP | VAPORIZER | MAIN_PIPE | VALVE_STATION | RELIQUEFIER | SEAWATER_PUMP
  zone_id         String
  glb_object_name String
  is_core         Boolean  @default(true)
  description     String?
  sensors         SensorMaster[]
  hazops          HazopMaster[]
}

model SensorMaster {
  sensor_id         String   @id
  sensor_name       String
  sensor_type       String   // PRESSURE | TEMPERATURE | FLOW | VIBRATION | CURRENT | LEVEL
  equipment_id      String
  unit              String
  enabled           Boolean  @default(true)
  sample_interval_sec Int    @default(5)
  equipment         EquipmentMaster @relation(fields: [equipment_id], references: [equipment_id])
  threshold         SensorThreshold?
}

model SensorThreshold {
  sensor_id     String  @id
  normal_value  Float
  warning_low   Float
  warning_high  Float
  critical_low  Float
  critical_high Float
  sensor        SensorMaster @relation(fields: [sensor_id], references: [sensor_id])
}

model ScenarioMaster {
  scenario_id          String  @id
  scenario_name        String
  trigger_equipment_id String
  affected_equipment_ids String[]  // PostgreSQL array
  hazop_id             String?
  default_duration_sec Int
  phases               Json    // [{phase, start_sec, end_sec}]
  sensor_data_file     String
  playback_speed_options Int[]
}

model HazopMaster {
  hazop_id           String  @id
  scenario_id        String
  equipment_id       String
  node               String
  process_parameter  String
  deviation          String
  cause              String
  event_scenario     String
  hazard_scenario    String
  preventive_action  String
  emergency_response String
  linked_sop_id      String?
  risk_level         String
  kgs_impact_score   Int?
  equipment          EquipmentMaster @relation(fields: [equipment_id], references: [equipment_id])
}

model EventLog {
  event_id              String   @id @default(uuid())
  scenario_id           String
  trigger_equipment_id  String
  status                String   @default("OPEN")  // OPEN | PROCESSING | CLOSED
  severity              String   // INFO | WARNING | CRITICAL | EMERGENCY
  summary               String?
  opened_at             DateTime @default(now())
  closed_at             DateTime?
  sop_executions        SopExecutionLog[]
  reports               ReportDocument[]
}

model SopCatalog {
  sop_id              String   @id
  sop_name            String
  sop_category        String   // EMERGENCY | SAFETY | ROUTINE
  trigger_type        String   // AUTO | MANUAL
  target_space_id     String?
  target_equipment_id String?
  linked_hazop_id     String?
  priority            Int
  camera_preset       String?
  popup_template      String?
  estimated_duration_min Int?
  auto_open_popup     Boolean  @default(false)
  broadcast_action    String?
  steps               Json     // [{step_no, type, content}]
  keywords            Json?
  status              String   @default("ACTIVE")
  equipment_maps      SopEquipmentMap[]
  executions          SopExecutionLog[]
}

model SopEquipmentMap {
  map_id             String  @id
  sop_id             String
  space_id           String
  equipment_id       String
  match_rule         String  // EQUIPMENT_MATCH | ZONE_MATCH
  event_severity_min String
  camera_preset      String?
  popup_template     String?
  is_primary         Boolean @default(false)
  sort_order         Int
  sop                SopCatalog @relation(fields: [sop_id], references: [sop_id])
}

model SopExecutionLog {
  execution_id     String   @id @default(uuid())
  event_id         String
  scenario_id      String?
  sop_id           String
  execution_status String   @default("IN_PROGRESS")  // IN_PROGRESS | COMPLETED | ABORTED
  started_at       DateTime @default(now())
  ended_at         DateTime?
  executor_role    String?
  checked_steps    Json?    // [{step_no, checked, checked_at}]
  memo             String?
  event            EventLog @relation(fields: [event_id], references: [event_id])
  sop              SopCatalog @relation(fields: [sop_id], references: [sop_id])
}

model ReportDocument {
  report_id          String   @id @default(uuid())
  template_id        String
  report_type        String
  scenario_id        String?
  event_id           String?
  title              String
  status             String   @default("DRAFT")  // DRAFT | SUBMITTED
  author_role        String?
  generated_summary  Json?
  manager_comment    String?
  created_at         DateTime @default(now())
  updated_at         DateTime @updatedAt
  event              EventLog? @relation(fields: [event_id], references: [event_id])
}

model SettingsMetadata {
  setting_id    String  @id @default(uuid())
  setting_group String
  setting_key   String  @unique
  setting_value String
  value_type    String  // STRING | NUMBER | BOOLEAN
  description   String?
}

// Mock Provider 결과 테이블 (POC용)
model MockKogasResult {
  request_id           String @id
  scenario_id          String
  target_equipment_id  String
  fault_code           String?
  fault_name           String
  diagnosis_confidence Float
  suspected_part       String?
  sensor_evidence      Json?
}

model MockKgsResult {
  analysis_id            String @id
  scenario_id            String
  trigger_equipment_id   String
  affected_equipment_id  String
  impact_type            String
  impact_score           Int
  risk_level             String
  predicted_after_sec    Int?
  color_2d               String?
  color_3d               String?
  hazop_id               String?
  recommended_action     String?
}

model MockKetiResult {
  simulation_id              String @id
  scenario_id                String
  trigger_equipment_id       String
  simulation_summary         String?
  recommended_option_a       String?
  recommended_option_b       String?
  expected_stabilization_min Int?
}

model MockSafetiaHistory {
  history_id             String @id
  scenario_id            String
  equipment_id           String
  last_maintenance_date  String?
  past_incident_summary  String?
  linked_sop_id          String?
  operator_note          String?
}
```

### 8.2 Seed 로딩

- 앱 시작 시 `prisma/seed.ts`에서 `/seed/*.json` 파일을 읽어 DB에 일괄 적재
- 센서 시계열은 JSON 파일에서 직접 로딩 (DB 적재 없이 에뮬레이터가 파일에서 읽음)
- `npx prisma db seed` 명령으로 실행

---

## 9. 화면 설계

### 9.1 공통 레이아웃

```
┌─────────────────────────────────────────────────┐
│ [GNB] 로고 | M-MON M-ANO M-RSK M-SIM M-HIS M-SOP | 🔔알람(3) | ⚙설정 📋보고서 | 시나리오:SC-01 ▶️ │
├─────────────────────────────────────────────────┤
│ [API 상태] 🟢KOGAS 정상 | 🟢KGS 정상 | 🟢KETI 정상 | 🟢세이프티아 정상           │
├─────────────────────────────────────────────────┤
│                                                     │
│                   [모드별 콘텐츠 영역]                    │
│                                                     │
├─────────────────────────────────────────────────┤
│ [하단 바] 시나리오 진행: ████████░░ FAULT (6:23/15:00) | Speed: 10x | ⏸ ⏹ │
└─────────────────────────────────────────────────┘
```

**API 연결상태 바:**
- GNB 바로 아래 thin bar (높이 28px)로 4개 외부기관 연결상태 표시
- 🟢 정상연결 / 🟡 지연(3초 이상) / 🔴 연결실패 / ⚪ 미사용
- POC에서는 Mock Provider 서버 health check (`GET /api/provider/{기관}/health`) 기반
- 클릭 시 상세 정보 팝업: 마지막 응답시간, 에러 내용, 재연결 버튼

### 9.2 기본 모니터링 (M-MON)

```
┌─ 공정 흐름 패널 ──┬────────────────────────────────────┬── 정보 패널 ──┐
│ (좌측 15%)        │        3D 뷰어 (65%)               │ (우측 20%)    │
│                   │                                    │              │
│ ┌ 1단계: 하역 ──┐ │                                    │ 선택설비 정보   │
│ │ 🚢 운반선     │ │                                    │ ─────────    │
│ │   ↓          │ │      [GLB 테스트베드 모델]            │ BOG-201      │
│ │ ⚓ 로딩암     │ │                                    │ BOG 압축기 #1 │
│ │   ↓ ═배관═   │ │                                    │              │
│ └──────────────┘ │                                    │ 센서 현재값     │
│   ↓              │                                    │ 압력: 10.1 bar│
│ ┌ 2단계: 저장 ──┐ │                                    │ 온도: 42.3 ℃  │
│ │ 🏭 저장탱크   │ │                                    │ 진동: 2.1 mm/s│
│ │   ↓ BOG ↗   │ │                                    │ 유량: 85 m³/h │
│ │ 💨 BOG압축기  │ │                                    │ 전류: 45.2 A  │
│ │   ↓          │ │                                    │              │
│ │ ♻ 재액화기 ↩ │ │                                    │ 알람 (2건)     │
│ └──────────────┘ │                                    │ ⚠ 진동 경고    │
│   ↓              │                                    │ ⚠ 온도 주의    │
│ ┌ 3단계: 이송 ──┐ │                                    │              │
│ │ 🔧 이송펌프   │ │                                    │ ─────────    │
│ │   ↓          │ │                                    │ [이상탐지]     │
│ │ 🔗 배관      │ │                                    │ [위험예측]     │
│ │   ↓          │ │                                    │ [시뮬레이션]   │
│ │ 🔒 밸브      │ │                                    │ [SOP]        │
│ └──────────────┘ │                                    │ [이력조회]     │
│   ↓              │────────────────────────────────────│              │
│ ┌ 4단계: 기화 ──┐ │ ┌─ 핵심 KPI 대시보드 ──────────────┐│              │
│ │ 🌡 기화기     │ │ │🚢1.5bar ⚓120m³/h 🏭4.2bar     ││              │
│ │   ↓ 배관망   │ │ │💨10.1bar 🔧85m³/h 🌡-20℃      ││              │
│ └──────────────┘ │ │🔗100m³/h 🔒95m³/h ♻12.0bar    ││              │
│                   │ │ 🔵 🔵 🔵 🔵 🔵 🔵 🔵 🔵 🔵   ││              │
│                   │ └───────────────────────────────┘│              │
└───────────────────┴────────────────────────────────────┴──────────────┘
```

#### 공정 흐름 패널 상세 명세

**컴포넌트**: `<ProcessFlowNavigator />`

**구조**: 4단계 공정이 위→아래로 흐르며, 각 단계는 접이식 카드(공정 박스)로 구성

```typescript
interface ProcessStage {
  stage_no: number;          // 1~4
  stage_name: string;        // "하역", "저장·BOG", "이송", "기화·송출"
  equipment_ids: string[];   // 포함된 설비 목록
  status: 'normal' | 'warning' | 'critical' | 'emergency';
  monitoring_zone: string;   // "하역 모니터링", "액체 이송 모니터링", "기화/압축/분배 모니터링"
}
```

**4단계 공정 정의:**

| 단계 | 공정명 | 포함 설비 | 모니터링 구간 |
|------|--------|---------|------------|
| 1 | 하역 | SHP-001, ARM-101 | 하역 모니터링 (선박/로딩암/배관/저장탱크) |
| 2 | 저장·BOG | TK-101, BOG-201, REL-701 | BOG/재액화 모니터링 |
| 3 | 이송 | PMP-301, PIP-501, VAL-601 | 액체 이송 모니터링 (펌프/저장탱크/기화기) |
| 4 | 기화·송출 | VAP-401 (+향후 해수펌프, 일반압축기) | 기화/압축/분배 모니터링 |

**시각 동작 규칙:**

| 상황 | 공정 박스 | 설비 아이콘 | 화살표 |
|------|---------|----------|--------|
| 정상 | 기본 테두리 (dark gray) | 기본 아이콘 | 흐름 화살표만 표시, 센서값 미표시 |
| WARNING | **주황 테두리** + 미세 펄스 | **🟡 주황 뱃지** | **해당 구간 화살표 위에 이상 센서값 표시** (예: "F:35↓ m³/h") |
| CRITICAL | **적색 테두리** + 강한 펄스 | **🔴 적색 뱃지** | **적색 화살표 + 센서값 적색 표시** |
| EMERGENCY | **적색 배경 + 점멸** | **🔴 점멸** | **적색 점멸 + 센서값** |

- 이벤트 발생 시: trigger 설비가 속한 공정 박스 → 해당 단계 강조
- 영향 전파 시: affected 설비가 속한 다른 공정 박스 → 주황 테두리 추가
- 공정 박스 간 화살표에 이상 시에만 센서값 표시 (조건부 라벨)
- 설비 아이콘 클릭 → 3D 카메라 이동 + 정보 패널 갱신
- 공정 박스 헤더 클릭 → 해당 공정 구간 3D 줌인

**BOG 순환 루프 표현:**
- 2단계 박스 내에서 저장탱크 → BOG 발생 → BOG 압축기 → 재액화기 → 저장탱크 순환 화살표
- BOG 발생량이 처리용량 초과 시 "벤트스택" 경로가 적색으로 활성화

**설비 아이콘 옆 잠재 위험요소 인디케이터 (선택):**
- 설비 아이콘에 마우스 호버 시 해당 설비의 주요 위험요소 툴팁 표시
- 예: ARM-101 호버 → "하역 중 누출 / ESD 오작동 / 선박 이탈"
- 위험요소는 HAZOP 데이터에서 자동 추출

**이벤트 팝업** (이벤트 발생 시 중앙 오버레이):
```
┌─── 이벤트 알림 ─────────────────────────┐
│ ⚠ CRITICAL | BOG 압축기 트립              │
│ 공정: 2단계 저장·BOG | 설비: BOG-201      │
│ 시간: 10:06:00                           │
│ 요약: BOG 처리 실패로 저장탱크 압력 상승        │
│ 잠재위험: 탱크 과압, 안전밸브 개방, BOG 급증    │
│                                         │
│ [설비상세] [이상탐지] [위험예측] [시뮬레이션]    │
│ [SOP 팝업실행] [SOP 전체화면] [이력조회]      │
└─────────────────────────────────────────┘
```

**KPI 대시보드** (3D 뷰어 하단 고정):
- 9개 설비의 대표 센서값 + 상태를 가로 카드로 배치
- 공정 흐름 패널과 독립적으로 동작 (전체 설비 한눈 요약)
- 이상 시 🔵→🟡→🔴 자동 변경
- 카드 클릭 → 설비 카메라 이동 (공정 흐름 패널의 해당 설비도 동시 하이라이트)

### 9.3 위험예측 (M-RSK) — 3분할 + 실행 제어

```
┌────────────────────────────────────────────────────────────────────┐
│ ┌─ 분석 입력 ──────────────────────────────────────────────────┐   │
│ │ 이벤트 연계: EVT-SC-01-001 (BOG 압축기 트립)  [자동채움]        │   │
│ │ 또는 수동 선택: 설비 [BOG-201 ▼] 분석시간 [2시간 ▼]            │   │
│ │ KGS 분석 파라미터: 압력초과율 [15%] 온도편차 [±5℃]             │   │
│ │                 🟢KGS 연결정상    [▶ 위험예측 실행]  [↻ 초기화] │   │
│ └──────────────────────────────────────────────────────────────┘   │
├────────────┬──────────────────┬────────────────────────────────────┤
│ 2D 영향 네트워크 │   3D 뷰어 (40%)    │ HAZOP + 상세 패널 (30%)          │
│ (30%)       │                    │                                  │
│ [react-flow]│  [GLB + 영향 컬러링] │ ┌─ HAZOP 상세 ────────────────┐  │
│  ●BOG-201  │                    │ │ 원인: BOG 처리 실패           │  │
│  ↓ 88점    │  trigger: 🔴적색   │ │ 이벤트: 저장탱크 압력 상승      │  │
│  ●TK-101   │  affected: 🟡황색  │ │ 위험: 안전밸브 작동 가능성      │  │
│  ↓ 64점    │                    │ │ 예방: BOG 재액화기 즉시 가동    │  │
│  ●REL-701  │  영향 전파 애니메이션: │ │ 비상: 벤트스택 수동 개방       │  │
│             │  trigger→affected  │ └─────────────────────────────┘  │
│ ── zone 영향 ─│  점선 흐름 효과      │                                  │
│ Z-STO ██░░  │                    │ ┌─ 권고조치 ─────────────────┐   │
│ Z-BOG ████  │  2D 노드 클릭 시    │ │ KGS: 저장탱크 압력상승률 감시 │   │
│ Z-PIPE █░░░ │  3D 카메라 자동이동  │ │ HAZOP: 안전밸브 수동개방 준비 │   │
│             │                    │ └─────────────────────────────┘  │
│ 시간축 예측:   │  시간축 슬라이더:    │                                  │
│ ┌──┬──┬──┐ │  [0분──●──30분──60분]│ ┌─ 연계 SOP ────────────────┐   │
│ │0분│10│30│ │  드래그 시 3D 컬러링  │ │ SOP-BOG-TRIP-01          │   │
│ │60분│  │  │ │  시간에 따라 변화    │ │ [SOP 팝업실행] [SOP 전체화면]│   │
│ └──┴──┴──┘ │                    │ └─────────────────────────────┘  │
└────────────┴──────────────────┴────────────────────────────────────┘

* [▶ 위험예측 실행] 버튼: 
  - 이벤트 연계: EventContext에서 자동으로 파라미터 채움 → 클릭 시 KGS mock 결과 로드
  - 수동 실행: 설비 선택 + 파라미터 입력 후 클릭 → KGS mock 결과 로드
  - 실행 후 2D 네트워크 + 3D 컬러링 + HAZOP 텍스트 동시 갱신
* 3D 영향 전파 애니메이션: trigger 설비에서 affected 설비로 점선이 흘러가는 효과
* 시간축 슬라이더: 드래그 시 predicted_after_sec에 따라 3D 컬러링 단계적 변화
  (0분: trigger만 적색 → 10분: 1차 affected 황색 추가 → 30분: 2차 affected 추가)
* KGS 데이터 전송: 이벤트 연계 시 자동으로 센서값+설비정보를 KGS API로 전송.
  수동 실행 시에는 입력 패널의 파라미터를 사용자가 확인/수정 후 [실행] 클릭.
```

### 9.4 설비 상태감시/이상탐지 (M-ANO)

레퍼런스 이미지(이상감지.png) 기반 레이아웃. 9개 설비 전체를 탭으로 전환.

```
┌─────────────────────────────────────────────────────────────────────┐
│ ┌─ 좌측 센서차트 ──────┐ ┌─── 3D 설비 뷰어 ────────┐ ┌─ 우측 센서차트 ──────┐ │
│ │ ⊙ 압력 추세          │ │                        │ │ ⊙ 전류 추세          │ │
│ │ ───/──\────  임계선  │ │   [secondary_pump.glb] │ │ ───────\──── 임계선  │ │
│ │                     │ │                        │ │                     │ │
│ ├─────────────────────┤ │   impeller_stage_03    │ ├─────────────────────┤ │
│ │ ⊙ 온도 추세          │ │   🔴 이상 컬러링         │ │ ⊙ 진동 추세          │ │
│ │ ────────────  임계선  │ │                        │ │ ──────/\──── 임계선  │ │
│ │                     │ │  [reset] 버튼           │ │    ↑ 이상구간 강조     │ │
│ ├─────────────────────┤ │                        │ ├─────────────────────┤ │
│ │ ⊙ 유량 추세          │ │  센서고장 인디케이터:     │ │ ⊙ 캐비테이션 지표      │ │
│ │ ──\────────  임계선  │ │  ● 펌프부하  ● 모터부하  │ │ ────/──\──── 임계선  │ │
│ │                     │ │  ● 펌프반부하 ● 모터반부하│ │                     │ │
│ ├─────────────────────┤ │                        │ ├─────────────────────┤ │
│ │ ⊙ 레벨(또는 베어링)    │ │                        │ │ ⊙ KOGAS AI 진단점수   │ │
│ │ ────────────        │ │                        │ │ ████████░░ 78%      │ │
│ └─────────────────────┘ └────────────────────────┘ └─────────────────────┘ │
│                                                                           │
│ ┌── 설비 선택 ───────────────────────────────────────────────────────────┐   │
│ │ [🚢SHP] [⚓ARM] [🏭TK] [💨BOG] [🔧PMP◀] [🌡VAP] [🔗PIP] [🔒VAL] [♻REL] │   │
│ └────────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─ 이상탐지 그래프 ───────────┬─ 이상탐지 상세정보 ──────┬─ 진단 데이터 ────────┐ │
│ │ 설비유형 [▼] 센서유형 [▼]   │ 시간   │기준값│학습값│오차│ │ ▶ 비교 구간         │ │
│ │ 센서ID [▼]    [조회]       │ 01:00  │30.0│30.3│0.31│ │   (정상 패턴 차트)   │ │
│ │                           │ 00:59  │31.3│31.3│0.03│ │ ▶ 이상탐지 구간      │ │
│ │ ■ 실측값 — 학습값 ∵ 오차   │ 00:58  │31.3│31.3│0.03│ │   (이상 패턴 차트)   │ │
│ │ ───────/──────────       │ 00:57  │31.3│31.3│0.03│ │                     │ │
│ │ ████████████████░░░       │ ...    │    │    │   │ │ ▶ 이상탐지 진단 결과   │ │
│ │ (24h 타임라인 바)          │        │    │    │   │ │ "[00:30~01:00] 구간에│ │
│ │ ⏮ ⏪ ⏩ ⏭ 시간선택        │        │    │    │   │ │ 서 진동값 급변 감지"  │ │
│ └───────────────────────────┴────────────────────┴─────────────────────┘ │
│                                                                           │
│ ┌─ KOGAS 진단 결과 ──────────────────────────────────────────────────────┐   │
│ │ 🟢KOGAS 연결정상 | 고장명: 캐비테이션(impeller_stage_03) | 확신도: 78%      │   │
│ │ 의심부위: 3단 임펠러 블레이드 마모 | 고장코드: FLT-PMP-CAV                    │   │
│ │ [위험예측] [시뮬레이션] [SOP] [이력조회]                                     │   │
│ └────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘

* 설비 선택 탭: 9개 설비를 수평 탭으로 배치. 현재 선택 설비 강조.
* 3D 뷰어: 선택 설비에 따라 다른 GLB 로드
  - PMP-301 선택 시: secondary_pump.glb (임펠러/디퓨저 상세)
  - 기타 설비: 테스트베드 GLB에서 해당 설비 줌인 + 하이라이트
* 좌우 센서 차트 4쌍: 선택 설비의 주요 센서 시계열. 임계선 표시. 이상구간 빨간 배경.
* 하단 좌: KOGAS AI 모델 학습값 대비 실측값 비교 (24시간 타임라인)
* 하단 중: 시간별 상세 테이블 (기준값, 학습값, 오차)
* 하단 우: 비교구간 / 이상탐지구간 차트 + 진단 결과 텍스트
* KOGAS 진단 결과 바: API 연결상태 + 고장명 + 확신도 + 의심부위 + 모드전환 버튼
```

### 9.5 시뮬레이션/의사결정지원 (M-SIM) — 3D 시각화 포함

```
┌──────────────────────────────────────────────────────────────────────┐
│ [이벤트 연계 실행] [수동 실행]                                            │ ← 탭
├──────────────────────────────────────────────────────────────────────┤
│ ┌─ 시뮬레이션 입력/제어 ──────────────────────────────────────────┐     │
│ │ 시나리오: SC-01 BOG 압축기 트립 [▼]     🟢KETI 연결정상            │     │
│ │ 트리거 설비: [BOG-201 ▼]  이상유형: [과압 ▼]                      │     │
│ │ 파라미터: 초기압력 [■■■■■●━━ 12.5bar]  지속시간 [■■●━━━ 2hr]      │     │
│ │          온도편차 [■■■●━━━ ±5℃]       유량변화 [■■■■●━ -40%]     │     │
│ │                                                                │     │
│ │ [▶ 시뮬레이션 실행]  [⏸ 일시정지]  [⏹ 중지]  [↻ 초기화]            │     │
│ │ 진행: ████████████░░░░░░░ 60%  시뮬레이션 시간: 12분/20분          │     │
│ └────────────────────────────────────────────────────────────────┘     │
│                                                                        │
│ ┌─── 3D 시뮬레이션 뷰어 (50%) ──────────┬─ 결과 패널 (50%) ──────────┐ │
│ │                                      │                            │ │
│ │  [GLB 테스트베드 전체 뷰]              │ ┌─ KGS 위험영향 결과 ─────┐ │ │
│ │                                      │ │ trigger: BOG-201 🔴90점 │ │ │
│ │  시뮬레이션 시간축에 따라:              │ │ → TK-101 🟡76점 (3분후) │ │ │
│ │  - trigger 설비: 🔴 적색 점멸          │ │ → REL-701 🟡64점 (5분후)│ │ │
│ │  - affected 설비: 🟡→🔴 점진적 변화    │ │ 위험 전파 경로 다이어그램  │ │ │
│ │  - 영향 반경: 반투명 원형 오버레이       │ └──────────────────────┘ │ │
│ │  - 가스 확산: 파티클 효과 (누출 시)     │                            │ │
│ │                                      │ ┌─ KETI 대응안 비교 ──────┐ │ │
│ │  ┌──────────────────────┐            │ │  Option A    Option B   │ │ │
│ │  │ 시간: 12:00 / 20:00  │            │ │ ┌─────────┬──────────┐ │ │ │
│ │  │ [◀◀ ◀ ▶ ▶▶]  1x    │            │ │ │재액화기가동│벤트후정비  │ │ │ │
│ │  │ ■■■■■■●━━━━━━━━━━   │            │ │ │안정화:18분│안정화:25분 │ │ │ │
│ │  │ (타임라인 스크러버)     │            │ │ │위험도: 중  │위험도: 저  │ │ │ │
│ │  └──────────────────────┘            │ │ │ [적용▶]  │ [적용▶]   │ │ │ │
│ │                                      │ │ └─────────┴──────────┘ │ │ │
│ │  대응안 [적용▶] 클릭 시 3D에서:        │ └──────────────────────┘ │ │
│ │  영향범위 축소 애니메이션 재생           │                            │ │
│ │                                      │ ┌─ KETI 시뮬레이션 요약 ──┐ │ │
│ │                                      │ │ 안전밸브 개방 전 18분 내 │ │ │
│ │                                      │ │ 조치 필요. Option A 권고│ │ │
│ │                                      │ └──────────────────────┘ │ │
│ └──────────────────────────────────────┴────────────────────────┘ │
│                                                                        │
│ [SOP 연계] [보고서에 반영]                                               │
└──────────────────────────────────────────────────────────────────────┘

* [▶ 시뮬레이션 실행]: KETI + KGS mock 동시 호출 → 3D + 결과 패널 동시 갱신
* 3D 뷰어: 타임라인 스크러버로 시뮬레이션 시간 탐색, 설비 컬러링 시간별 변화
* 대응안 [적용▶]: 3D에서 영향범위 축소/정상화 애니메이션 재생
* [수동 실행] 탭: 파라미터 슬라이더로 직접 조건 설정 후 실행
* KETI 데이터 전송: [실행] 클릭 시 입력 파라미터를 KETI API로 자동 전송
```

### 9.6 이력조회/분석 (M-HIS)

```
┌──────────┬──────────────────────────────────────────┐
│ 설비 필터   │ 이력 목록                                   │
│           │                                          │
│ [전체 설비]│ ┌─────┬──────┬──────────┬────────┬────┐  │
│ ☑ TK-101 │ │ 구분  │ 일자    │ 내용        │ 설비     │ 상태 │  │
│ ☑ BOG-201│ ├─────┼──────┼──────────┼────────┼────┤  │
│ ☑ PMP-301│ │ 정비  │ 12/10  │ 압축기 정기점검│ BOG-201│ 완료 │  │
│ ☑ VAP-401│ │ 사고  │ 12/01  │ 펌프 진동 이상│ PMP-301│ 조치 │  │
│ ☑ PIP-501│ │ 교체  │ 11/20  │ 밸브 구동기   │ VAL-601│ 완료 │  │
│ ☑ VAL-601│ │ 점검  │ 11/15  │ 기화기 성능   │ VAP-401│ 완료 │  │
│ ☑ REL-701│ │ ...  │       │           │       │     │  │
│           │ └─────┴──────┴──────────┴────────┴────┘  │
│ ──────── │                                          │
│ 기간 필터   │ ┌─ 이력 상세 ──────────────────────────┐  │
│ [최근1개월]│ │ 정비이력: BOG 압축기 정기점검              │  │
│ [최근3개월]│ │ 일자: 2025-12-10                       │  │
│ [최근1년]  │ │ 내용: 베어링 상태 양호, 진동값 정상범위     │  │
│ [전체]     │ │ 관련 SOP: SOP-BOG-TRIP-01              │  │
│           │ │ 운영자 메모: 다음 점검 2026-03 예정       │  │
│           │ │                                       │  │
│ 유형 필터   │ │ [위험예측] [관련 이벤트 보기]              │  │
│ ☑ 정비     │ └─────────────────────────────────────┘  │
│ ☑ 점검     │                                          │
│ ☑ 교체     │                                          │
│ ☑ 사고     │                                          │
└──────────┴──────────────────────────────────────────┘
```

### 9.7 설정 (P-SET)

```
┌──────────────────────────────────────────────────────┐
│ [센서 메타데이터] [임계치 관리] [운영정책]                     │ ← 탭
├──────────────────────────────────────────────────────┤
│                                                        │
│ [센서 메타데이터 탭]                                       │
│ ┌──────┬──────┬──────┬────┬──────┬──────┬──────┐      │
│ │ ID    │ 이름   │ 유형   │ 설비  │ 단위   │ 주기(s) │ 활성  │      │
│ ├──────┼──────┼──────┼────┼──────┼──────┼──────┤      │
│ │TK-PRE│탱크압력│PRESSURE│TK-101│bar(g)│  5    │ ✅   │      │
│ │TK-TMP│탱크온도│TEMP    │TK-101│ ℃    │  5    │ ✅   │      │
│ │BOG-VIB│압축기진동│VIB  │BOG-201│mm/s │  5    │ ✅   │      │
│ └──────┴──────┴──────┴────┴──────┴──────┴──────┘      │
│                                     [저장]              │
│                                                        │
│ [임계치 관리 탭]                                          │
│ 설비 선택: [BOG-201 ▼]                                   │
│ ┌──────┬────────┬────────┬─────────┬─────────┐        │
│ │ 센서   │ 경고 하한 │ 경고 상한  │ 위험 하한   │ 위험 상한  │        │
│ ├──────┼────────┼────────┼─────────┼─────────┤        │
│ │ 압력   │  6.0    │  11.0   │   5.0    │  12.5   │        │
│ │ 온도   │ -35     │  45     │  -40     │   50    │        │
│ │ 진동   │  2.0    │   5.0   │   1.0    │   8.0   │        │
│ └──────┴────────┴────────┴─────────┴─────────┘        │
│                          [기본값 복원] [저장]              │
│                                                        │
│ [운영정책 탭]                                             │
│ SOP 자동팝업:          [ON ●○ OFF]                       │
│ 자동 보고서 초안 생성:    [ON ●○ OFF]                       │
│ Missing Data Timeout:  [30] 초                          │
│ 기본 샘플링 주기:        [5] 초                            │
│                                     [저장]              │
└──────────────────────────────────────────────────────┘
```

### 9.8 SOP 모드 (M-SOP)

```
┌────────────────────────────────────────────┐
│ [실행] [저작/편집] [실행이력]                     │  ← 탭
├──────────┬─────────────────────────────────┤
│ SOP 목록   │ SOP 실행 패널                      │
│           │ ┌───────────────────────────┐   │
│ ● BOG 트립 │ │ SOP-BOG-TRIP-01            │   │
│ ● 펌프 캐비 │ │ BOG 압축기 트립 대응           │   │
│ ● 탱크 압력 │ │ 대상: BOG-201 / Z-BOG       │   │
│ ● 밸브 고착 │ │                             │   │
│ ● 기화기 저온│ │ ☑ 1. 압축기 진동/소음 현장 확인  │   │
│ ● 일일점검  │ │ ☑ 2. 흡입/토출 압력차 확인     │   │
│           │ │ ☐ 3. 전류값 확인              │   │
│           │ │ ☐ 4. 예비기 기동 준비          │   │
│           │ │ ☐ 5. 탱크 압력 확인            │   │
│           │ │                             │   │
│           │ │ 메모: ___________________    │   │
│           │ │ [실행완료] [상황전파]            │   │
│           │ └───────────────────────────┘   │
└──────────┴─────────────────────────────────┘

* [저작/편집] 탭 선택 시:
  - 제목 입력/수정
  - 대상 공간(zone) 드롭다운 선택
  - 대상 설비(equipment) 드롭다운 선택
  - 우선순위 (1=최고 ~ 5=최저) 선택
  - 카메라 프리셋명 입력 (예: cam_bog_compressor_201)
  - 팝업 템플릿명 입력 (예: popup_bog_trip)
  - 단계 목록:
    [+단계 추가] 버튼
    각 단계: 유형(TEXT/CHECK) 드롭다운 + 내용 텍스트 입력 + [삭제] + [↑↓순서변경]
  - [저장] [취소]
```

### 9.9 보고서 (P-RPT)

```
┌─────────────────────────────────────────────┐
│ 보고서 목록 | 보고서 상세                          │
├──────────┬──────────────────────────────────┤
│ RPT-SC-01│ [DRAFT] BOG 압축기 트립 조치보고서       │
│ RPT-SC-02│                                    │
│ RPT-SC-03│ ┌─ 자동수집 ──────┬─ 관리자 작성 ───┐ │
│ RPT-SC-04│ │ 이벤트 개요     │ 관리자 의견:     │ │
│ RPT-SC-05│ │ 트리거 설비     │ ____________   │ │
│ RPT-SC-06│ │ KOGAS 진단     │              │ │
│          │ │ KGS 영향분석    │ 후속조치:       │ │
│          │ │ KETI 권고안     │ ____________   │ │
│          │ │ 이력 요약       │              │ │
│          │ │ SOP 수행이력    │              │ │
│          │ └───────────────┴──────────────┘ │
│          │ [저장] [제출] [PDF]                  │
└──────────┴──────────────────────────────────┘
```

---

## 10. 공통 코드 체계

### 10.1 설비 유형
LH2_CARRIER, LOADING_ARM, STORAGE_TANK, BOG_COMPRESSOR, TRANSFER_PUMP, VAPORIZER, MAIN_PIPE, VALVE_STATION, RELIQUEFIER, SEAWATER_PUMP

### 10.2 센서 유형
PRESSURE, TEMPERATURE, FLOW, VIBRATION, CURRENT, LEVEL

### 10.3 이벤트 심각도
INFO, WARNING, CRITICAL, EMERGENCY

### 10.4 시각 상태 (3D 컬러링)
normal, warning, affected, critical, emergency, simTarget

### 10.5 이벤트 상태
OPEN → PROCESSING → CLOSED

### 10.6 SOP 카테고리
EMERGENCY (비상대응), SAFETY (안전관리), ROUTINE (일상점검)

### 10.7 SOP 단계 유형
TEXT (안내 텍스트), CHECK (체크박스 실행 항목)

### 10.8 보고서 상태
DRAFT, SUBMITTED

### 10.9 센서 품질
GOOD, ESTIMATED, MISSING

### 10.10 센서 라벨
NORMAL, WARNING, ANOMALY

### 10.11 Phase
NORMAL, SYMPTOM, FAULT, SECONDARY_IMPACT, RESPONSE

---

## 11. SOP 추천 로직

```
이벤트 발생 시:
1. event.trigger_equipment_id 조회
2. equipment_master에서 zone_id 조회
3. sop_equipment_map에서:
   a. equipment_id 일치 + event_severity >= event_severity_min → 1차 후보
   b. zone_id 일치 → 2차 후보
4. is_primary=true 우선 + sort_order 정렬
5. 결과가 0건이면 SOP-GENERIC-INSPECT-01 (fallback)
6. 대표 SOP 1건 + 관련 SOP 전체 목록 반환
```

### 11.1 시나리오-HAZOP-SOP 연결 매트릭스

| 시나리오 | HAZOP ID | 1차 SOP | fallback |
|---------|----------|---------|----------|
| SC-01 | HZ-LH2-001 | SOP-BOG-TRIP-01 | SOP-GENERIC-INSPECT-01 |
| SC-02 | HZ-LH2-002 | SOP-PUMP-CAV-01 | SOP-GENERIC-INSPECT-01 |
| SC-03 | HZ-LH2-003 | SOP-TANK-PRES-01 | SOP-GENERIC-INSPECT-01 |
| SC-04 | HZ-LH2-004 | SOP-VAL-STUCK-01 | SOP-GENERIC-INSPECT-01 |
| SC-05 | HZ-LH2-005 | SOP-BOG-SURGE-01 | SOP-GENERIC-INSPECT-01 |
| SC-06 | HZ-LH2-006 | SOP-VAP-COLD-01 | SOP-GENERIC-INSPECT-01 |
| SC-07 | HZ-LH2-007 | SOP-NORMAL-OPS-01 | — |
| SC-08 | HZ-LH2-008 | SOP-ARM-ESD-01 | SOP-GENERIC-INSPECT-01 |

### 11.2 SOP 카탈로그 목록 (9종)

| SOP ID | 이름 | 카테고리 | 대상 설비 | 단계 수 |
|--------|------|---------|---------|--------|
| SOP-BOG-TRIP-01 | BOG 압축기 트립 대응 | EMERGENCY | BOG-201 | 5 |
| SOP-PUMP-CAV-01 | 이송펌프 캐비테이션 대응 | EMERGENCY | PMP-301 | 5 |
| SOP-TANK-PRES-01 | 저장탱크 압력상승 대응 | EMERGENCY | TK-101 | 5 |
| SOP-VAL-STUCK-01 | 밸브 Stuck Close 대응 | EMERGENCY | VAL-601 | 4 |
| SOP-VAP-COLD-01 | 기화기 후단 저온 대응 | EMERGENCY | VAP-401 | 4 |
| SOP-BOG-SURGE-01 | BOG 압축기 전단 저유량 대응 | EMERGENCY | BOG-201 | 5 |
| SOP-NORMAL-OPS-01 | 정상운전 일일 점검 체크리스트 | ROUTINE | TK-101 | 6 |
| SOP-GENERIC-INSPECT-01 | 공통 현장점검 체크리스트 | SAFETY | — (fallback) | 3 |
| SOP-ARM-ESD-01 | 로딩암 긴급차단(ESD) 대응 | EMERGENCY | ARM-101 | 7 |

---

## 12. 보고서 자동생성 로직

```
이벤트 CLOSED 시:
1. event_log에서 이벤트 요약 추출
2. mock_kogas_result에서 진단 요약 추출
3. mock_kgs_result에서 영향설비/위험도 추출
4. mock_keti_result에서 권고안 추출
5. mock_safetia_history에서 이력 추출
6. sop_execution_log에서 수행이력 추출
7. report_template(RPT-TPL-001) 기반으로 generated_summary 조합
8. report_document 레코드 생성 (status: DRAFT)
```

---

## 13. 프로젝트 구조

```
lh2-digital-twin-poc/
├── CLAUDE.md
├── package.json
├── apps/
│   ├── web/                          # Next.js Frontend
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx        # 공통 레이아웃 (GNB + 하단바)
│   │   │   │   ├── page.tsx          # 메인 (→ /monitoring 리다이렉트)
│   │   │   │   ├── monitoring/       # M-MON (KPI 대시보드 포함)
│   │   │   │   ├── anomaly/          # M-ANO
│   │   │   │   ├── risk/             # M-RSK
│   │   │   │   ├── simulation/       # M-SIM
│   │   │   │   ├── history/          # M-HIS
│   │   │   │   ├── sop/             # M-SOP
│   │   │   │   ├── settings/         # P-SET
│   │   │   │   └── reports/          # P-RPT
│   │   │   ├── components/
│   │   │   │   ├── layout/           # GNB, AlarmBanner, EmulatorBar, ModeNav, ApiStatusBar
│   │   │   │   ├── process-flow/     # ProcessFlowNavigator, ProcessStageCard, EquipmentNode, FlowArrow
│   │   │   │   ├── viewer3d/         # ThreeCanvas, GlbLoader, EquipmentMesh, CameraController
│   │   │   │   ├── common/           # EventPopup, EquipmentInfoPanel, SensorChart
│   │   │   │   ├── sop/             # SopExecutionPanel, SopListPanel, SopEditorPanel
│   │   │   │   ├── risk/            # ImpactNetwork2D, HazopPanel, TimeAxisCards
│   │   │   │   └── reports/          # ReportDetail, AutoSummaryPanel
│   │   │   ├── stores/
│   │   │   │   ├── appStore.ts       # 모드, EventContext, 선택 설비
│   │   │   │   └── emulatorStore.ts  # 에뮬레이터 상태
│   │   │   ├── hooks/
│   │   │   │   ├── useSSE.ts         # SSE 연결
│   │   │   │   ├── useEquipment.ts
│   │   │   │   └── useSopRecommend.ts
│   │   │   └── lib/
│   │   │       ├── api.ts            # API 클라이언트
│   │   │       └── constants.ts      # 코드 상수, 컬러맵
│   │   └── public/
│   └── api/                          # Express Backend
│       ├── src/
│       │   ├── index.ts
│       │   ├── routes/
│       │   │   ├── scenarios.ts
│       │   │   ├── emulator.ts
│       │   │   ├── equipment.ts
│       │   │   ├── sensors.ts
│       │   │   ├── events.ts
│       │   │   ├── providers.ts      # KOGAS/KGS/KETI/세이프티아 mock
│       │   │   ├── hazop.ts
│       │   │   ├── sop.ts
│       │   │   ├── reports.ts
│       │   │   └── settings.ts
│       │   ├── services/
│       │   │   ├── emulatorEngine.ts # 시나리오 재생 엔진
│       │   │   ├── sopRecommender.ts # SOP 추천 로직
│       │   │   └── reportGenerator.ts # 보고서 자동생성
│       │   └── providers/
│       │       ├── mockKogas.ts
│       │       ├── mockKgs.ts
│       │       ├── mockKeti.ts
│       │       └── mockSafetia.ts
│       └── prisma/
│           ├── schema.prisma
│           └── seed.ts
├── seed/                             # seed JSON 파일 전체
└── docs/                             # 참고 문서
```

---

## 14. 개발 로드맵 (단계별)

### Phase 1: 기반 구조
- Prisma schema + migration + seed.ts
- Express 서버 + 전체 API 라우트 스텁
- Mock Provider 구현 (scenario_id 기준 JSON 반환)
- 시나리오 에뮬레이터 엔진 (SSE 기반)

### Phase 2: 모니터링 + 3D
- Next.js 앱 프레임 + GNB + 모드 라우팅
- Three.js GLB 로더 + mesh 컬러링 시스템
- 기본 모니터링 UI (설비 트리, 센서 패널, 알람 바)
- 에뮬레이터 UI (시나리오 선택 + 재생 컨트롤 + 하단 진행바)
- EventPopup 컴포넌트

### Phase 3: 이상탐지 + 위험예측
- M-ANO: KOGAS 진단 패널 + 센서 추세 차트
- M-RSK: 3분할 화면 (react-flow 2D + 3D + HAZOP 텍스트)
- 2D↔3D 동기화 (노드 클릭 → 카메라 이동)
- EventContext enrichment

### Phase 4: SOP + 시뮬레이션
- SOP 추천 로직 + SOP 링크 모듈
- SopExecutionPanel (compact/full 듀얼 UI)
- M-SOP 전체 화면 (실행 + 저작/편집 + 이력)
- M-SIM: 이벤트 연계 + 수동 실행 모드

### Phase 5: 보조 기능 완성
- P-RPT: 보고서 자동생성 + 편집 + 상태관리
- P-SET: 설정 페이지 (센서 메타, 임계치, 운영정책)
- M-HIS: 이력조회 (세이프티아 이력 표출)
- 전체 시나리오 end-to-end 테스트

---

## 15. 코드 최적화 가이드

### 15.1 3D 성능
- GLB는 R2에서 런타임 로드, 로딩 중 스켈레톤 UI
- mesh traverse 시 material clone은 최초 1회만
- 컬러링 변경은 material.color.set()만 호출 (새 material 생성 금지)
- frustum culling 활성화

### 15.2 데이터 페칭
- SWR 또는 React Query 사용하여 API 응답 캐싱
- 센서 시계열은 에뮬레이터 SSE로 수신 (polling 미사용)
- 모드 전환 시 이미 로드된 데이터는 store에서 재사용

### 15.3 컴포넌트 재사용
- SopExecutionPanel: compact prop으로 팝업/전체화면 전환
- SensorChart: 재사용 가능한 시계열 차트 (sensor_id, timeRange props)
- EquipmentInfoPanel: 설비 정보 + 센서값 (equipment_id prop)

### 15.4 토큰 효율 (Claude Code 작업 시)
- Phase별로 나눠서 구현 (한 번에 전체 코드 생성하지 않음)
- 공통 컴포넌트/타입을 먼저 만들고, 모드별 페이지를 점진적 추가
- seed.ts는 JSON 파일을 직접 import하여 Prisma upsert로 적재

---

## 16. Claude Code 투입 가이드

### 16.1 컨텍스트에 넣을 것 vs 디스크에 둘 것

```
[컨텍스트에 넣음] → CLAUDE.md + FUNC_SPEC_POC_v5.md (~18K tokens)
[디스크에만 둠]   → /seed/*.json (28개 파일, ~500K tokens → 컨텍스트 초과이므로 절대 넣지 않음)
```

- seed JSON은 프로젝트의 `/seed/` 폴더에 압축해제하여 배치
- Claude Code는 seed 파일 내용을 직접 읽지 않고, CLAUDE.md의 스키마 정의만 참조하여 코드 작성
- seed.ts에서 `fs.readFileSync`로 JSON을 로드하는 코드를 작성하면 됨

### 16.2 작업 순서 (권장 프롬프트 흐름)

```
[프롬프트 1] Phase 1 — 기반 구조
  "CLAUDE.md 섹션 8, 20을 참고하여 Prisma schema, seed.ts, Express 서버 기본 구조를 생성해줘.
   API 라우트는 섹션 7의 전체 엔드포인트를 스텁으로 만들어줘."

[프롬프트 2] Phase 1 — 에뮬레이터 엔진
  "섹션 6의 시나리오 에뮬레이터 명세대로 emulatorEngine.ts를 구현해줘.
   SSE 기반으로 phase별 센서 데이터를 push하는 구조."

[프롬프트 3] Phase 2 — 프론트 프레임 + 3D
  "Next.js 앱 기본 구조를 만들어줘. 섹션 9.1 공통 레이아웃(GNB + 하단 에뮬레이터 바),
   섹션 13의 디렉토리 구조, Zustand store(섹션 4.1 EventContext)."

[프롬프트 4] Phase 2 — 기본 모니터링
  "섹션 9.2의 M-MON 화면을 구현해줘. Three.js GLB 로더, 설비 트리, 
   KPI 대시보드(9개 설비 카드), 센서 정보 패널."

[프롬프트 5] Phase 3 — 이상탐지 + 위험예측
  "섹션 9.4 M-ANO와 섹션 9.3 M-RSK를 구현해줘.
   M-RSK는 react-flow 2D 네트워크 + 3D 뷰어 + HAZOP 텍스트 3분할."

[프롬프트 6] Phase 4 — SOP + 시뮬레이션
  "섹션 9.8 M-SOP(SopExecutionPanel compact/full), 섹션 9.5 M-SIM을 구현해줘.
   SOP 추천 로직은 섹션 11 참고."

[프롬프트 7] Phase 5 — 보조 기능
  "섹션 9.9 P-RPT, 섹션 9.7 P-SET, 섹션 9.6 M-HIS를 구현해줘.
   보고서 자동생성 로직은 섹션 12 참고."

[프롬프트 8] 통합 테스트
  "SC-01 시나리오를 에뮬레이터에서 실행하여 전체 흐름을 테스트해줘.
   모니터링 → 이벤트 팝업 → 위험예측 → SOP 실행 → 보고서 생성."
```

### 16.3 핵심 참조 매핑

Claude Code가 각 작업에서 참조해야 할 섹션:

| 작업 | CLAUDE.md 섹션 |
|------|---------------|
| DB/ORM | 8 (Prisma Schema), 19 (적용 가이드) |
| API | 7 (REST API 명세) |
| Mock Provider | 7.4, 1.2 (외부기관 연동 원칙) |
| 에뮬레이터 | 6 (동작 흐름, SSE 포맷) |
| 3D 뷰어 | 5 (GLB, 컬러링, 카메라 프리셋) |
| 화면 UI | 9 (모드별 와이어프레임) |
| 상태관리 | 4 (EventContext, 모드간 연계) |
| SOP 로직 | 11 (추천, 매트릭스, 카탈로그) |
| 보고서 로직 | 12 (자동생성) |
| 코드 체계 | 10 (코드 상수) |
| 배포 | 18 (Draco), 19 (Railway/Vercel/R2) |

---

## 17. seed 데이터 파일 목록

```
seed/
├── seed_manifest.json
├── seed_master_zone.json              (8 zones)
├── seed_master_equipment.json         (9 equipment: 선박+로딩암 포함)
├── seed_master_sensor_type.json       (6 types)
├── seed_master_sensor.json            (34 sensors)
├── seed_equipment_sensor_map.json     (34 mappings)
├── seed_sensor_thresholds.json        (34 thresholds)
├── seed_mock_scenarios.json           (8 scenarios: SC-08 하역 시나리오 포함)
├── seed_hazop_lh2.json                (8 hazop entries)
├── seed_event_log.json                (8 events)
├── seed_mock_kgs_results.json         (24 results)
├── seed_mock_kogas_results.json       (8 results)
├── seed_mock_keti_results.json        (8 results)
├── seed_mock_safetia_history.json     (8 histories)
├── seed_sop_catalog.json              (9 SOPs: SOP-ARM-ESD-01 포함)
├── seed_sop_equipment_map.json        (18 mappings)
├── seed_sop_execution_samples.json    (7 executions)
├── seed_report_templates.json         (1 template)
├── seed_report_samples.json           (7 reports)
├── seed_settings_metadata.json        (5 settings)
├── seed_pump_mesh_coloring.json       (SC-02 임펠러 이상 시 mesh별 컬러링 규칙)
├── seed_process_stages.json           (4단계 공정 흐름 정의 + 설비 매핑 + 연결 경로)
├── seed_sensor_timeseries_SC-01.json  (806 records)
├── seed_sensor_timeseries_SC-02.json
├── seed_sensor_timeseries_SC-03.json
├── seed_sensor_timeseries_SC-04.json
├── seed_sensor_timeseries_SC-05.json
├── seed_sensor_timeseries_SC-06.json
├── seed_sensor_timeseries_SC-07.json
└── seed_sensor_timeseries_SC-08.json  (574 records: 선박-로딩암 하역 시나리오)
```

---

## 18. GLB 파일 처리 및 Draco 압축

### 18.1 Draco 압축 현황

| 파일 | Draco 적용 | 원본(추정) | 압축 후 | GPU 메모리(디코딩 후) |
|------|-----------|----------|---------|-------------------|
| h2.glb | ✅ Required (`KHR_draco_mesh_compression`) | ~300MB | 30MB | ~306MB |
| secondary_pump.glb | ❌ 미사용 | 210KB | 210KB | ~0.3MB |

> **중요**: Draco는 네트워크 전송량만 줄임. GPU 메모리는 디코딩 후 원본 크기로 복원됨.
> 진정한 GPU 성능 향상은 Blender Decimate(geometry 축소)로 달성해야 함.

### 18.2 Draco 디코더 Self-hosting (권장)

Google CDN 의존도를 제거하기 위해 Draco 디코더를 프로젝트에 포함:

```bash
# Three.js에 번들된 Draco 디코더를 public 폴더로 복사
mkdir -p apps/web/public/draco
cp node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.js apps/web/public/draco/
cp node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm apps/web/public/draco/
cp node_modules/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js apps/web/public/draco/
```

### 18.3 Three.js Draco 디코더 설정

```typescript
// components/viewer3d/GlbLoader.tsx
import { useGLTF } from '@react-three/drei';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// 방법 1: Self-hosted Draco 디코더 (권장)
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');  // public/draco/ 에서 로드
dracoLoader.setDecoderConfig({ type: 'js' }); // WASM이 더 빠르지만 js가 호환성 좋음
dracoLoader.preload();

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

// 방법 2: @react-three/drei useGLTF (간편, Google CDN 사용)
// useGLTF의 두 번째 인자 true = Draco 자동 감지 활성화
const TESTBED_URL = process.env.NEXT_PUBLIC_GLB_BASE_URL + '/h2.glb';
useGLTF.preload(TESTBED_URL);

function TestbedModel() {
  const { scene } = useGLTF(TESTBED_URL, true);
  return <primitive object={scene} />;
}

// secondary_pump.glb는 Draco 미사용 → 두 번째 인자 불필요
function PumpDetailModel() {
  const { scene } = useGLTF('/models/secondary_pump.glb');
  return <primitive object={scene} />;
}
```

**로딩 프로그레스 UI:**
```typescript
// h2.glb 30MB → Draco 디코딩 포함 약 3~10초 소요
import { useProgress } from '@react-three/drei';

function LoadingOverlay() {
  const { progress, active } = useProgress();
  if (!active) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
      <div className="text-white text-lg">
        3D 모델 로딩 중... {progress.toFixed(0)}%
      </div>
    </div>
  );
}
```

### 18.4 GLB → R2 업로드

```bash
# Cloudflare Wrangler CLI 사용
npm install -g wrangler
wrangler login

# R2 버킷 생성 (최초 1회)
wrangler r2 bucket create lh2-poc-assets

# GLB 업로드
wrangler r2 object put lh2-poc-assets/testbed_draco.glb --file=./testbed_draco.glb
wrangler r2 object put lh2-poc-assets/pump_detail_draco.glb --file=./pump_detail_draco.glb

# 퍼블릭 접근 설정 (R2 대시보드에서 "Public access" 활성화)
# 또는 Custom Domain 연결
```

### 18.5 GLB mesh name 확인 (확정 완료)

h2.glb의 mesh name은 Blender MCP를 통해 seed 데이터의 `glb_object_name`과 일치하도록 변경 완료됨.
아래 스크립트는 향후 GLB 파일 교체 시 검증용으로 사용:

```javascript
// scripts/inspect-glb.js
const { NodeIO } = require('@gltf-transform/core');

async function inspectGLB(filepath) {
  const io = new NodeIO();
  const document = await io.read(filepath);
  const root = document.getRoot();
  
  console.log('=== Nodes (EMPTY + MESH 구조) ===');
  root.listNodes().forEach(node => {
    const mesh = node.getMesh();
    const children = node.listChildren();
    console.log(`  ${node.getName()} → mesh: ${mesh?.getName() || 'none'}, children: ${children.length}`);
  });
}

inspectGLB('./h2.glb');
```

---

## 19. 배포 가이드

### 19.1 아키텍처 구성

```
[사용자 브라우저]
    ↕ HTTPS
[Vercel] ← Next.js Frontend (정적 + SSR)
    ↕ HTTPS (API 호출)
[Railway] ← Express Backend + PostgreSQL
    ↕ HTTPS
[Cloudflare R2] ← GLB 파일 (퍼블릭 CDN)
```

### 19.2 Railway 설정

#### PostgreSQL 생성

```bash
# Railway CLI 설치
npm install -g @railway/cli
railway login

# 프로젝트 생성
railway init

# PostgreSQL 플러그인 추가 (Railway 대시보드에서)
# Services → New → Database → PostgreSQL
# 생성 후 DATABASE_URL 환경변수가 자동 설정됨
```

#### Backend 배포

```bash
# Railway에 Express 백엔드 배포

# 1. railway.json 설정
cat > railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run start",
    "healthcheckPath": "/api/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
EOF

# 2. 환경변수 설정 (Railway 대시보드 또는 CLI)
railway variables set NODE_ENV=production
railway variables set PORT=3001
railway variables set SEED_DIR=./seed
# DATABASE_URL은 PostgreSQL 서비스 연결 시 자동 설정됨

# 3. 배포
railway up

# 4. Prisma migration + seed 실행
railway run npx prisma migrate deploy
railway run npx prisma db seed
```

#### Backend package.json 핵심

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "seed": "tsx prisma/seed.ts",
    "migrate": "prisma migrate deploy"
  },
  "engines": {
    "node": ">=18"
  }
}
```

### 19.3 Vercel 설정

```bash
# 1. Vercel CLI
npm install -g vercel
vercel login

# 2. 프로젝트 연결
cd apps/web
vercel link

# 3. 환경변수 설정
vercel env add NEXT_PUBLIC_API_URL  # Railway 백엔드 URL (예: https://lh2-api.up.railway.app)
vercel env add NEXT_PUBLIC_GLB_BASE_URL  # R2 퍼블릭 URL

# 4. 배포
vercel --prod
```

#### next.config.js 핵심

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // R2에서 GLB 로드를 위한 외부 이미지/리소스 허용
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.r2.dev' },
      { protocol: 'https', hostname: '*.cloudflare.com' },
    ],
  },
  // API 프록시 (CORS 회피용, 선택사항)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;
```

### 19.4 Cloudflare R2 설정

```bash
# 1. R2 버킷 생성 (18.4 참조)
# 2. CORS 설정 (R2 대시보드 → Settings → CORS Policy)
```

R2 CORS 정책:
```json
[
  {
    "AllowedOrigins": ["https://lh2-poc.vercel.app", "http://localhost:3000"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```

### 19.5 환경변수 요약

| 변수 | 위치 | 값 예시 |
|------|------|--------|
| DATABASE_URL | Railway (자동) | postgresql://... |
| PORT | Railway | 3001 |
| NODE_ENV | Railway | production |
| SEED_DIR | Railway | ./seed |
| NEXT_PUBLIC_API_URL | Vercel | https://lh2-api.up.railway.app |
| NEXT_PUBLIC_GLB_BASE_URL | Vercel | https://pub-xxx.r2.dev |
| NEXT_PUBLIC_GLB_TESTBED | Vercel | h2.glb |
| NEXT_PUBLIC_GLB_PUMP | Vercel | — (앱 번들 포함: /models/secondary_pump.glb) |

### 19.6 배포 후 체크리스트

```
[ ] Railway PostgreSQL 접속 확인
[ ] Railway Backend /api/health 응답 확인
[ ] Prisma migration 정상 적용 확인
[ ] Prisma seed 정상 적재 확인 (GET /api/equipment → 7건)
[ ] R2 GLB 파일 퍼블릭 접근 확인
[ ] Vercel Frontend 정상 로드 확인
[ ] Frontend → Backend API 통신 확인
[ ] 3D GLB 정상 로드 + Draco 디코딩 확인
[ ] 시나리오 에뮬레이터 SSE 연결 확인
[ ] 전체 시나리오 1건(SC-01) end-to-end 재생 확인
```

### 19.7 비용 참고 (POC 5명 미만 동시접속 기준)

| 서비스 | 플랜 | 예상 월비용 |
|--------|------|-----------|
| Vercel | Hobby (무료) 또는 Pro ($20) | $0 ~ $20 |
| Railway | Starter (크레딧 $5/월) 또는 Developer ($5+사용량) | $5 ~ $15 |
| Cloudflare R2 | Free tier (10GB 스토리지, 월 1000만 읽기) | $0 |
| **합계** | | **$5 ~ $35/월** |

---

## 20. DB 스키마 적용 가이드

### 20.1 스키마 위치

본 문서 섹션 8의 Prisma Schema가 DB 설계의 단일 소스임. 기존 `DB_SCHEMA_POC_v2.md`의 SQL 테이블 정의는 참고용이며, 실제 개발에는 Prisma schema를 사용함.

### 20.2 초기 설정 순서

```bash
# 1. Prisma 초기화
cd apps/api
npx prisma init

# 2. schema.prisma에 섹션 8.1 내용 작성
# datasource는 Railway PostgreSQL URL 사용

# 3. Migration 생성 및 적용
npx prisma migrate dev --name init

# 4. Prisma Client 생성
npx prisma generate

# 5. Seed 실행
npx prisma db seed
```

### 20.3 seed.ts 구조

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const SEED_DIR = process.env.SEED_DIR || path.join(__dirname, '../../seed');

function loadJson(filename: string) {
  return JSON.parse(fs.readFileSync(path.join(SEED_DIR, filename), 'utf-8'));
}

async function main() {
  // 순서 중요: 참조 무결성
  // 1. Zone → Equipment → Sensor → Threshold
  // 2. Scenario → Hazop
  // 3. SOP Catalog → SOP Equipment Map
  // 4. Event Log → SOP Execution → Report
  // 5. Mock Results (KOGAS, KGS, KETI, Safetia)
  // 6. Settings

  const zones = loadJson('seed_master_zone.json');
  // ... 각 테이블에 upsert
  for (const eq of loadJson('seed_master_equipment.json')) {
    await prisma.equipmentMaster.upsert({
      where: { equipment_id: eq.equipment_id },
      update: eq,
      create: eq,
    });
  }
  // ... 나머지 테이블도 동일 패턴
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### 20.4 시계열 데이터 처리

센서 시계열(seed_sensor_timeseries_SC-*.json)은 DB에 적재하지 않음:
- 에뮬레이터 엔진이 JSON 파일에서 직접 로딩
- phase/timestamp 기준으로 메모리에서 필터링 후 SSE 송출
- DB 적재 시 수만 건이 되어 POC 환경에서 불필요한 부하

---

## 21. 반응형 웹 설계

### 21.1 브레이크포인트

```typescript
// lib/constants.ts
export const BREAKPOINTS = {
  mobile:  640,   // < 640px: 모바일
  tablet:  1024,  // 640~1024px: 태블릿
  desktop: 1280,  // 1024~1280px: 소형 데스크탑
  wide:    1536,  // 1280+: 와이드 모니터
} as const;

// hooks/useMediaQuery.ts
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return matches;
}
```

### 21.2 모드별 반응형 전략

| 화면 요소 | Desktop (1280+) | Tablet (640~1024) | Mobile (<640) |
|-----------|----------------|-------------------|---------------|
| GNB 모드탭 | 6모드 수평 나열 | 아이콘+축약 텍스트 | 햄버거 메뉴 드로어 |
| M-MON 3분할 | 좌15%+중65%+우20% | 중앙 3D 100% + 하단 탭 | 3D 풀스크린 + 바텀시트 |
| M-RSK 3분할 | 좌30%+중40%+우30% | 탭 전환(2D/3D/HAZOP) | 탭 전환(스택) |
| M-ANO 센서차트 | 좌4+중3D+우4 | 중3D + 하단 스크롤 | 3D + 아코디언 |
| 3D 뷰어 | Canvas 고정 비율 | 전체 너비 | 전체 너비, 높이 50vh |
| 이벤트 팝업 | 중앙 모달(480px) | 중앙 모달(90vw) | 바텀시트 (전체폭) |
| SOP 팝업실행 | 우측 패널 400px | 바텀시트 | 전체화면 |
| KPI 대시보드 | 9카드 수평 | 3×3 그리드 | 수평 스크롤 |
| 에뮬레이터 바 | 풀바 | 축약 바 | 미니 플로팅 버튼 |

### 21.3 반응형 3D Canvas

```typescript
// components/viewer3d/ResponsiveCanvas.tsx
import { Canvas } from '@react-three/fiber';

export function ResponsiveCanvas({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');

  return (
    <Canvas
      dpr={isMobile ? 1 : isTablet ? 1.5 : 2}
      gl={{
        antialias: !isMobile,
        powerPreference: isMobile ? 'low-power' : 'high-performance',
      }}
      camera={{
        fov: isMobile ? 60 : 50,
        near: 0.1,
        far: 5000,  // h2.glb 좌표 범위 ~738 단위 대응
      }}
      style={{ width: '100%', height: isMobile ? '50vh' : '100%' }}
    >
      {children}
    </Canvas>
  );
}
```

### 21.4 Tailwind 반응형 패턴

```typescript
// 모니터링 3분할 레이아웃 예시
<div className="flex flex-col lg:flex-row h-full">
  {/* 공정 흐름 패널 - 데스크탑에서만 사이드바 */}
  <aside className="hidden lg:block lg:w-[15%] border-r overflow-y-auto">
    <ProcessFlowNavigator />
  </aside>

  {/* 3D 뷰어 - 항상 표시 */}
  <main className="flex-1 relative">
    <ResponsiveCanvas>
      <TestbedModel />
    </ResponsiveCanvas>
    {/* 모바일: 하단에 KPI 오버레이 */}
    <div className="absolute bottom-0 left-0 right-0 lg:relative">
      <KpiDashboard />
    </div>
  </main>

  {/* 정보 패널 - 태블릿/모바일에서 바텀시트 */}
  <aside className="lg:w-[20%] lg:border-l">
    <EquipmentInfoPanel />
  </aside>
</div>
```

---

## 22. 성능 계층화

### 22.1 디바이스별 이펙트 분기

```typescript
// hooks/usePerformanceTier.ts
export function usePerformanceTier() {
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isLowEnd = typeof navigator !== 'undefined' && navigator.hardwareConcurrency <= 4;

  return {
    tier: isMobile ? 'low' : isLowEnd ? 'medium' : 'high',
    enableGlow: !isMobile && !isLowEnd,
    enableParticles: !isMobile,
    enableHeatmap: !isMobile,
    enableShadows: false,  // POC에서는 일괄 비활성
    maxParticlesPerPipe: isMobile ? 0 : isLowEnd ? 50 : 200,
    dracoDecoderType: isMobile ? 'js' as const : 'wasm' as const,
  };
}
```

### 22.2 이펙트 ON/OFF 토글 (설정 페이지)

P-SET 운영정책 탭에 아래 토글 추가:

| 설정 | 기본값 (Desktop) | 기본값 (Mobile) |
|------|-----------------|----------------|
| 배관 유체 흐름 | ON | OFF |
| 설비 글로우 이펙트 | ON | OFF |
| 히트맵 오버레이 | ON | OFF |
| 영향 전파 애니메이션 | ON | OFF |
| 안티앨리어싱 | ON | OFF |

### 22.3 GPU 메모리 모니터링

```typescript
// components/viewer3d/GpuMonitor.tsx (개발 모드 전용)
import { useThree } from '@react-three/fiber';

export function GpuMonitor() {
  const { gl } = useThree();
  useEffect(() => {
    const info = gl.info;
    const interval = setInterval(() => {
      console.log(`[GPU] geometries: ${info.memory.geometries}, textures: ${info.memory.textures}, programs: ${info.programs?.length}`);
    }, 5000);
    return () => clearInterval(interval);
  }, [gl]);
  return null;
}
```

---

## 23. h2.glb 씬 구조 상세 (확정)

### 23.1 객체 계층 구조

```
Scene
├── SHP-001 (EMPTY) ← 설비 ID
│   └── ship_carrier_001 (MESH, 260,661 verts) ← glb_object_name
├── ARM-101 (EMPTY)
│   └── loading_arm_101 (MESH, 5,007,469 verts)
├── TK-101 (EMPTY)
│   └── tank_101 (MESH, 461,107 verts)
├── TK-102 (EMPTY)
│   └── tank_102 (MESH, 461,107 verts)
├── BOG-201 (EMPTY)
│   └── bog_compressor_201 (MESH, 1,739,558 verts)
├── PMP-301 (EMPTY)
│   └── pump_301 (MESH, 195,854 verts)
├── VAP-401 (EMPTY)
│   └── vaporizer_401 (MESH, 215,859 verts)
├── REL-701 (EMPTY)
│   └── reliquefier_701 (MESH, 6,218 verts)
├── VAL-601 (EMPTY)
│   └── valve_station_601 (MESH, 90,465 verts)
├── VAL-602 (EMPTY)
│   └── valve_station_602 (MESH, 90,465 verts)
├── PIP-501 (EMPTY)
│   ├── pipe_main_a (MESH, 1,714 verts)
│   └── pipe_main_b (MESH, 358 verts)
├── SWP-001 (EMPTY)
│   └── seawater_pump_001 (MESH, 56,028 verts)
├── TERRAIN (EMPTY)
│   └── terrain_ground (MESH, 981 verts)
└── GROUND (EMPTY)
```

### 23.2 좌표계 정보

| 항목 | 값 |
|------|-----|
| 단위 체계 | 미터(추정, Blender 기본) |
| 바운딩박스 Min | (-165.1, -14.0, -337.3) |
| 바운딩박스 Max | (334.8, 79.8, 401.0) |
| 씬 범위 | ~500 × 94 × 738 단위 |
| Up 축 | +Z (Blender 기본, Three.js 로드 시 자동 변환) |

### 23.3 정점 분포 및 Decimate 권고

| 메시 | 현재 정점 | 비율 | Decimate 권고 | 목표 정점 |
|------|----------|------|-------------|----------|
| loading_arm_101 | 5,007,469 | 60.1% | ratio 0.1 | ~500K |
| bog_compressor_201 | 1,739,558 | 20.9% | ratio 0.15 | ~260K |
| tank_101 | 461,107 | 5.5% | ratio 0.3 | ~138K |
| tank_102 | 461,107 | 5.5% | ratio 0.3 | ~138K |
| vaporizer_401 | 215,859 | 2.6% | — (유지) | 215K |
| pump_301 | 195,854 | 2.4% | — (유지) | 195K |
| 기타 | 245K | 2.9% | — (유지) | 245K |
| **합계** | **8,326,413** | **100%** | | **~1,691K** |

> Decimate 적용 시 전체 정점 약 80% 감소 → GPU 메모리 306MB → ~60MB 예상
