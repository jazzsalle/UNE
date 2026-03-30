# Claude Code 바이브코딩 실행 가이드

> 이 문서는 Claude Code에서 POC 개발을 시작하기 위한 사전 설정과 단계별 프롬프트를 제공합니다.
> CLAUDE.md + FUNC_SPEC_POC_v5.md + seed ZIP을 프로젝트에 배치한 후 사용합니다.

---

## Part 1. 사전 설치 및 환경 설정

### 1.1 Claude Code 설치 (아직 안 되어 있다면)

```bash
# Node.js 18+ 필수
node -v  # v18 이상 확인

# Claude Code 설치
npm install -g @anthropic-ai/claude-code

# 설치 확인
claude --version
```

### 1.2 프로젝트 초기 디렉토리 생성

```bash
mkdir lh2-digital-twin-poc
cd lh2-digital-twin-poc

# seed 데이터 배치
mkdir -p seed
# lh2_poc_seed_bundle_v2.4.zip을 seed/ 폴더에 압축해제

# GLB 파일 배치
mkdir -p public/models
# secondary_pump.glb → public/models/
# (테스트베드 GLB는 추후 R2 업로드)

# 문서 배치
mkdir -p docs
# CLAUDE.md → 프로젝트 루트에 배치 (Claude Code가 자동 인식)
# FUNC_SPEC_POC_v5.md → docs/
```

### 1.3 필요한 글로벌 도구

```bash
# 필수
npm install -g typescript ts-node prisma vercel

# 권장
npm install -g gltf-pipeline   # GLB Draco 압축
npm install -g wrangler         # Cloudflare R2 관리 (배포 시)
npm install -g @railway/cli     # Railway 배포 (배포 시)
```

### 1.4 VS Code 확장 (Claude Code와 병행 사용 시)

```
필수:
- Prisma (prisma.prisma) — 스키마 하이라이트/자동완성
- ESLint (dbaeumer.vscode-eslint)
- Tailwind CSS IntelliSense (bradlc.vscode-tailwindcss)

권장:
- Three.js Snippets — 3D 개발 보조
- Thunder Client — API 테스트 (Postman 대체)
- PostgreSQL (ckolkman.vscode-postgres) — DB 직접 조회
- GitLens — Git 히스토리 추적
```

### 1.5 CLAUDE.md 배치 확인

```bash
# 프로젝트 루트에 CLAUDE.md가 있어야 Claude Code가 자동 참조
ls -la CLAUDE.md
# → 있어야 함

# seed 폴더 확인
ls seed/*.json | wc -l
# → 30개여야 함
```

---

## Part 2. 단계별 프롬프트

### 주의사항
- 각 프롬프트는 **하나씩 순서대로** 입력합니다
- 이전 단계가 완료되고 정상 동작을 확인한 후 다음 단계로 넘어갑니다
- 에러가 발생하면 해당 단계에서 수정 완료 후 진행합니다
- 프롬프트 앞의 [P-01] 등은 식별용이며 입력하지 않습니다

---

### Phase 1: 기반 구조 (Backend + DB + Seed)

#### [P-01] 프로젝트 초기화 + 모노레포 구조 생성

```
프로젝트를 초기화해줘. CLAUDE.md 섹션 13의 디렉토리 구조를 따라서.

1. 루트에 package.json (workspaces: apps/web, apps/api)
2. apps/web: Next.js 14 App Router + TypeScript + Tailwind CSS 초기화
3. apps/api: Express + TypeScript 초기화
4. 공통 tsconfig 설정

아직 코드는 작성하지 말고 디렉토리 구조와 package.json만 만들어줘.
```

#### [P-02] Prisma 스키마 + DB 설정

```
CLAUDE.md 섹션 8.1의 Prisma Schema를 apps/api/prisma/schema.prisma에 작성해줘.

- datasource: postgresql (DATABASE_URL 환경변수)
- 모든 모델 포함: EquipmentMaster, SensorMaster, SensorThreshold, ScenarioMaster, HazopMaster, EventLog, SopCatalog, SopEquipmentMap, SopExecutionLog, ReportDocument, SettingsMetadata, MockKogasResult, MockKgsResult, MockKetiResult, MockSafetiaHistory
- CLAUDE.md 섹션 8.1의 관계(relation) 정의 그대로 적용
- .env 파일에 DATABASE_URL 템플릿 추가

완료 후 npx prisma generate가 성공하는지 확인해줘.
```

#### [P-03] Seed 로더 작성

```
CLAUDE.md 섹션 20.3을 참고하여 apps/api/prisma/seed.ts를 작성해줘.

- /seed 폴더의 JSON 파일들을 읽어서 DB에 적재
- 적재 순서는 참조 무결성 순서를 지켜야 함:
  1. Zone → Equipment → Sensor → Threshold
  2. Scenario → Hazop
  3. SOP Catalog → SOP Equipment Map
  4. Event Log → SOP Execution → Report
  5. Mock Results (KOGAS, KGS, KETI, Safetia)
  6. Settings
- upsert 사용 (중복 실행해도 안전하게)
- 시계열 데이터(seed_sensor_timeseries_*.json)는 DB에 넣지 않음
- seed_process_stages.json과 seed_pump_mesh_coloring.json도 DB에 넣지 않음 (프론트에서 직접 로드)

package.json에 prisma seed 명령 등록까지 해줘.
```

#### [P-04] Express 서버 기본 구조 + API 라우트 스텁

```
CLAUDE.md 섹션 7의 REST API 명세를 참고하여 Express 서버 기본 구조를 만들어줘.

apps/api/src/
├── index.ts              (Express 앱 시작, CORS, JSON 파싱)
├── routes/
│   ├── scenarios.ts      (GET /api/scenarios, GET /api/scenarios/:id)
│   ├── emulator.ts       (POST start/stop, GET status/stream)
│   ├── equipment.ts      (GET /api/equipment, GET /:id, GET /:id/sensors)
│   ├── sensors.ts        (GET /api/sensors/:id/timeseries)
│   ├── events.ts         (GET /api/events, GET /:id, PATCH /:id, GET stream)
│   ├── providers.ts      (GET kogas/kgs/keti/safetia /:scenario_id + health)
│   ├── hazop.ts          (GET /api/hazop, GET /:scenario_id)
│   ├── sop.ts            (CRUD + recommend + execute)
│   ├── reports.ts        (CRUD + generate + status)
│   └── settings.ts       (GET/PUT settings, thresholds, sensor-meta)
└── lib/
    └── prisma.ts         (PrismaClient 싱글턴)

각 라우트는 일단 Prisma로 DB 조회하는 기본 구현만 해줘.
mock provider는 scenario_id로 DB에서 조회하여 반환하면 됨.
health 엔드포인트는 항상 200 반환.
POST /api/provider/kgs/analyze와 POST /api/provider/keti/simulate는
request body의 scenario_id를 기준으로 DB에서 mock 결과를 반환.

서버 시작 후 GET /api/health, GET /api/equipment이 정상 응답하는지 확인해줘.
```

#### [P-05] 시나리오 에뮬레이터 엔진

```
CLAUDE.md 섹션 6의 시나리오 에뮬레이터 명세를 구현해줘.

apps/api/src/services/emulatorEngine.ts

핵심 동작:
1. POST /api/emulator/start {scenario_id, speed} → 타이머 시작
2. seed_sensor_timeseries_{scenario_id}.json 파일을 메모리에 로드
3. elapsed_sec를 speed 배속으로 증가시키며, 현재 phase 결정
4. phase에 해당하는 센서 데이터를 SSE로 클라이언트에 push
5. phase 전환 시 PHASE_CHANGE 이벤트 발생
6. FAULT phase 진입 시 이벤트 생성 (DB에 EventLog insert)
7. 시나리오 종료 시 이벤트 CLOSED + SCENARIO_END 이벤트

SSE 엔드포인트: GET /api/emulator/stream
이벤트 타입: SENSOR_UPDATE, PHASE_CHANGE, ALARM, EVENT_CREATE, EVENT_UPDATE, SCENARIO_END

CLAUDE.md 섹션 6.3의 EmulatorEvent 포맷을 따라줘.
POST /api/emulator/stop → 타이머 정지 + 초기화
GET /api/emulator/status → {running, scenario_id, elapsed_sec, phase, speed}

구현 후 SC-01을 10x 속도로 실행해서 SSE 이벤트가 정상 수신되는지 curl로 테스트해줘.
```

#### [P-06] SOP 추천 + 보고서 자동생성 서비스

```
CLAUDE.md 섹션 11 SOP 추천 로직과 섹션 12 보고서 자동생성 로직을 구현해줘.

apps/api/src/services/sopRecommender.ts
- GET /api/sop/recommend?event_id=xxx 호출 시:
  1. event의 trigger_equipment_id → equipment의 zone_id 조회
  2. sop_equipment_map에서 equipment_id 일치 → 1차 후보
  3. zone_id 일치 → 2차 후보
  4. severity >= event_severity_min 필터
  5. is_primary 우선 + sort_order 정렬
  6. 결과 0건이면 SOP-GENERIC-INSPECT-01 fallback
  7. 대표 SOP 1건 + 관련 SOP 전체 목록 반환

apps/api/src/services/reportGenerator.ts
- POST /api/reports/generate {event_id} 호출 시:
  1. event_log에서 이벤트 요약
  2. mock_kogas_result에서 진단 요약
  3. mock_kgs_result에서 영향설비/위험도
  4. mock_keti_result에서 권고안
  5. mock_safetia_history에서 이력
  6. sop_execution_log에서 수행이력
  7. report_document 레코드 생성 (status: DRAFT)

구현 후 SC-01 이벤트에 대해 SOP 추천과 보고서 생성이 정상 동작하는지 테스트해줘.
```

---

### Phase 2: 프론트 프레임 + 3D + 모니터링

#### [P-07] Next.js 앱 프레임 + 공통 레이아웃

```
CLAUDE.md 섹션 9.1, 13을 참고하여 Next.js 앱 기본 구조를 만들어줘.

apps/web/src/app/layout.tsx:
- 공통 레이아웃: GNB(상단) + API 상태바 + 모드별 콘텐츠 + 에뮬레이터 바(하단)
- GNB: 6개 모드 탭 (M-MON ~ M-SOP) + 설정/보고서 링크 + 알람 인디케이터 + 시나리오 선택기
- API 상태바: KOGAS/KGS/KETI/세이프티아 4개 연결상태 (CLAUDE.md 섹션 9.1 참조)
- 에뮬레이터 하단 바: 시나리오 진행률, phase, 시간, 속도, 재생/정지/중지 버튼

apps/web/src/app/ 하위에 모드별 빈 페이지 생성:
- monitoring/page.tsx
- anomaly/page.tsx
- risk/page.tsx
- simulation/page.tsx
- history/page.tsx
- sop/page.tsx
- settings/page.tsx
- reports/page.tsx

Zustand store 생성 (CLAUDE.md 섹션 4.1):
- stores/appStore.ts: currentMode, eventContext, selectedEquipmentId
- stores/emulatorStore.ts: running, scenario_id, elapsed_sec, phase, speed

API 클라이언트:
- lib/api.ts: fetch wrapper (NEXT_PUBLIC_API_URL 기반)

다크 테마 기반 Tailwind 설정 (산업용 모니터링 느낌).
```

#### [P-08] 에뮬레이터 UI + SSE 연결

```
에뮬레이터 하단 바와 시나리오 선택 UI를 구현해줘.

components/layout/EmulatorBar.tsx:
- 시나리오 드롭다운 (8개: SC-01 ~ SC-08)
- 재생속도 선택 (1x, 10x, 30x, 60x)
- [▶시작] [⏸일시정지] [⏹중지] 버튼
- 진행바 (████████░░ 형태)
- 현재 phase 표시 + elapsed time / total time

hooks/useSSE.ts:
- GET /api/emulator/stream SSE 연결
- 이벤트 타입별로 Zustand store 업데이트
- SENSOR_UPDATE → 센서값 store에 반영
- PHASE_CHANGE → phase 업데이트
- ALARM → 알람 store에 추가
- EVENT_CREATE → eventContext 설정

SC-01을 10x로 실행하여 하단 바의 진행이 정상 표시되는지 확인해줘.
```

#### [P-09] 3D 뷰어 + GLB 로딩 + 컬러링 시스템

```
CLAUDE.md 섹션 5를 참고하여 3D 뷰어를 구현해줘.

components/viewer3d/ThreeCanvas.tsx:
- @react-three/fiber Canvas 설정
- 환경광 + 방향광
- OrbitControls (회전/줌/팬)
- 로딩 중 스켈레톤 UI

components/viewer3d/GlbLoader.tsx:
- useGLTF로 GLB 로드
- 일단 secondary_pump.glb (210KB)를 /public/models/에서 로드
- (테스트베드 GLB는 추후 R2에서 로드)

components/viewer3d/EquipmentColorizer.tsx:
- visual_state에 따라 mesh material.color 변경
- CLAUDE.md 섹션 5.3의 COLOR_MAP 적용
- material은 최초 1회만 clone, 이후 color.set()만 호출

components/viewer3d/CameraController.tsx:
- camera_preset 문자열 → position/target 매핑
- gsap 또는 lerp로 0.8초 부드러운 전환

monitoring/page.tsx에 3D 뷰어를 배치하고, 
secondary_pump.glb가 정상 렌더링되는지 확인해줘.
```

#### [P-10] 공정 흐름 패널 (Process Flow Navigator)

```
CLAUDE.md 섹션 9.2의 공정 흐름 패널을 구현해줘.

components/process-flow/ProcessFlowNavigator.tsx:
- seed_process_stages.json 데이터 로드 (프론트에서 직접 import 또는 API)
- 4단계 공정을 위→아래로 세로 배치
- 각 단계는 ProcessStageCard 컴포넌트

components/process-flow/ProcessStageCard.tsx:
- 접이식 카드 (단계명 클릭 시 확장/축소)
- 내부에 설비 아이콘 + 이름 배치
- 설비 간 화살표로 흐름 표현
- status에 따라 테두리 색상 변경 (normal/warning/critical/emergency)

components/process-flow/EquipmentNode.tsx:
- 설비 아이콘 + 이름 + 상태 뱃지
- 클릭 시 → 3D 카메라 이동 + 정보 패널 갱신 (Zustand store 통해)
- 이벤트 시 해당 설비 뱃지 색상 변경

components/process-flow/FlowArrow.tsx:
- 정상 시: 기본 화살표만 표시
- 이상 시: 화살표 위에 이상 센서값 라벨 표시 (적색)
- BOG 순환 루프는 2단계 내에서 순환 화살표

monitoring/page.tsx 좌측에 배치하고 동작 확인해줘.
설비 클릭 시 콘솔에 equipment_id가 출력되면 OK.
```

#### [P-11] 정보 패널 + KPI 대시보드 + 이벤트 팝업

```
M-MON 화면의 나머지 컴포넌트를 구현해줘.

components/common/EquipmentInfoPanel.tsx (우측 20%):
- 선택 설비 이름/타입/존 표시
- 센서 현재값 목록 (에뮬레이터 SSE에서 수신한 값)
- 임계치 초과 시 값 색상 변경
- 센서별 미니 sparkline 차트 (최근 5분)
- 알람 목록 (해당 설비)
- 모드 전환 버튼: [이상탐지] [위험예측] [시뮬레이션] [SOP] [이력조회]

components/common/KpiDashboard.tsx (3D 뷰어 하단):
- 9개 설비의 대표 센서값 + 상태를 가로 카드로 배치
- 이상 시 카드 색상 변경 (🔵→🟡→🔴)
- 카드 클릭 → 설비 선택 + 카메라 이동

components/common/EventPopup.tsx:
- 이벤트 발생 시 중앙 모달 오버레이
- 공정 단계명 + 설비명 + 심각도 + 요약 + 잠재위험
- 모드 전환 버튼 6개 (설비상세/이상탐지/위험예측/시뮬레이션/SOP팝업/SOP전체화면/이력조회)
- 닫기 후 GNB 알람 인디케이터에서 재접근 가능

SC-01을 10x로 실행하여:
- 공정 흐름 패널 2단계가 하이라이트되는지
- KPI 대시보드 BOG 카드가 변색되는지
- FAULT phase에서 이벤트 팝업이 뜨는지
확인해줘.
```

---

### Phase 3: 이상탐지 + 위험예측

#### [P-12] 이상탐지 모드 (M-ANO)

```
CLAUDE.md 섹션 9.4의 이상탐지 레이아웃을 구현해줘. 레퍼런스 이미지(이상감지.png) 기반.

anomaly/page.tsx 전체 레이아웃:
- 상단: 좌측 센서차트 4개 + 중앙 3D 설비 뷰어 + 우측 센서차트 4개
- 중앙: 9개 설비 수평 탭
- 하단: 이상탐지 그래프 + 상세정보 테이블 + 진단 데이터

핵심 컴포넌트:
1. 센서 추세 차트 (recharts): 설비별 주요 센서 시계열 + 임계선 + 이상구간 배경색
2. 3D 설비 뷰어: PMP-301 선택 시 secondary_pump.glb 로드
3. seed_pump_mesh_coloring.json 기반 임펠러 컬러링
4. 설비 탭: 9개 설비 수평 배치, 선택 시 전체 갱신
5. KOGAS 진단 결과 바: API 연결상태 + 고장명 + 확신도 + 의심부위
6. 하단 좌: 24h 타임라인 차트 (실측값 vs 학습값)
7. 하단 중: 시간별 상세 테이블 (기준값, 학습값, 오차)
8. 하단 우: 비교구간/이상구간 차트 + 진단 결과 텍스트
9. 모드 전환 버튼: [위험예측] [시뮬레이션] [SOP] [이력조회]

SC-02(펌프 캐비테이션) 에뮬레이터 실행 → PMP-301 탭 선택 →
FAULT phase에서 impeller_stage_03 mesh가 적색 컬러링되는지 확인해줘.
```

#### [P-13] 위험예측 모드 (M-RSK)

```
CLAUDE.md 섹션 9.3의 위험예측 3분할 + 실행 제어를 구현해줘.

risk/page.tsx 전체 레이아웃:
- 상단: 분석 입력 패널 (이벤트 연계 자동채움 + 수동 선택 + KGS 파라미터 + [▶실행] + [↻초기화])
- 좌측 30%: 2D 영향 네트워크 (react-flow)
- 중앙 40%: 3D 뷰어 (GLB + 영향 컬러링 + 영향 전파 애니메이션 + 시간축 슬라이더)
- 우측 30%: HAZOP 상세 + 권고조치 + 연계 SOP

핵심 구현:
1. react-flow 기반 2D 네트워크: trigger 노드(적색) + affected 노드(황색) + 링크(두께=impact_score)
2. zone 영향 히트맵 바 (Z-STO, Z-BOG 등)
3. 3D 뷰어: KGS color_3d 값으로 설비 컬러링 + 2D 노드 클릭 → 3D 카메라 이동
4. 시간축 슬라이더: 0~60분 드래그 → predicted_after_sec 기반 컬러링 변화
5. HAZOP 텍스트 패널: 원인/이벤트시나리오/위험시나리오/예방조치/비상대응
6. 권고조치 카드: KGS recommended_action + HAZOP emergency_response
7. 연계 SOP 바로가기

[▶ 위험예측 실행] 클릭 시:
- POST /api/provider/kgs/analyze 호출 (이벤트 연계 시 자동 파라미터)
- GET /api/provider/kgs/:scenario_id로 결과 로드
- 2D + 3D + HAZOP 동시 갱신

SC-01 이벤트 컨텍스트로 진입하여 [실행] 클릭 후 
2D/3D/HAZOP이 모두 갱신되는지 확인해줘.
```

---

### Phase 4: SOP + 시뮬레이션

#### [P-14] SOP 모드 (M-SOP) + SOP 팝업

```
CLAUDE.md 섹션 9.8, 섹션 3.3을 참고하여 SOP 모드를 구현해줘.

sop/page.tsx: [실행] [저작/편집] [실행이력] 3개 탭

[실행] 탭 (메인):
- 좌측: SOP 목록 (카테고리/설비 필터, 검색)
- 우측: SOP 실행 패널 (SopExecutionPanel)

components/sop/SopExecutionPanel.tsx:
- props: compact (true=팝업용 400px, false=전체화면용)
- SOP 제목 + 대상 공간/설비 + 연계 HAZOP
- 텍스트 블럭 + 체크박스 단계 목록
- 체크 시 checked_steps 업데이트 (PUT /api/sop/execution/:id)
- 메모 입력
- [실행완료] → POST /api/sop/execution/:id/complete
- [상황전파] → POST /api/sop/execution/:id/broadcast (action log만)

[저작/편집] 탭:
- SOP 생성: 제목, 공간/설비, 우선순위, 단계 추가/삭제, 유형(TEXT/CHECK), 카메라 프리셋, 팝업 템플릿
- SOP 수정: 기존 SOP 수정

[실행이력] 탭:
- 시나리오/이벤트별 실행이력 목록 + 상세

SOP 팝업 (운영모드에서 호출):
- 이벤트 팝업에서 [SOP 팝업실행] 클릭 시 우측에 400px 패널로 SopExecutionPanel(compact=true)
- [SOP 전체화면] 클릭 시 /sop 페이지로 이동 (EventContext 유지)

SC-01 이벤트에서 SOP 추천 → 실행 → 체크 → 완료까지 동작 확인해줘.
```

#### [P-15] 시뮬레이션 모드 (M-SIM)

```
CLAUDE.md 섹션 9.5의 시뮬레이션 3D 시각화를 구현해줘.

simulation/page.tsx: [이벤트 연계 실행] [수동 실행] 탭

[이벤트 연계] 탭:
- 상단: 입력/제어 패널 (시나리오+설비 자동채움, 파라미터 슬라이더, KETI 연결상태)
- [▶실행] [⏸일시정지] [⏹중지] [↻초기화] + 진행바
- 좌 50%: 3D 시뮬레이션 뷰어 (GLB + 시간축 컬러링 + 타임라인 스크러버)
- 우 50%: KGS 위험영향 결과 + KETI 대응안 비교(Option A/B 카드) + 시뮬레이션 요약

3D 뷰어 핵심:
- 타임라인 스크러버: 드래그 시 3D 컬러링 시간별 변화
- trigger 설비 적색 점멸, affected 설비 점진적 컬러 변화
- 대응안 [적용▶] 클릭 시 영향범위 축소 애니메이션

[수동 실행] 탭:
- 시나리오 드롭다운 또는 "신규 조건"
- 트리거 설비 선택
- 이상 유형 선택 (과압/저온/진동 등)
- 파라미터 슬라이더 4개 (초기압력, 온도편차, 유량변화, 지속시간)
- [실행] → KETI + KGS mock 결과 동시 로드 → 3D + 결과 패널 갱신

SC-01 이벤트에서 [시뮬레이션] 진입 → [실행] → 
3D 타임라인 + 대응안 비교 + KGS 결과가 모두 표시되는지 확인해줘.
```

---

### Phase 5: 보조 기능

#### [P-16] 보고서 + 설정

```
CLAUDE.md 섹션 9.9 보고서와 섹션 9.7 설정을 구현해줘.

reports/page.tsx:
- 좌측: 보고서 목록 (시나리오별, 상태 배지 DRAFT/SUBMITTED)
- 우측: 보고서 상세
  - 상단: 상태, 제목, 이벤트/시나리오 정보
  - 좌: 자동수집 데이터 (이벤트개요/KOGAS/KGS/KETI/세이프티아/SOP이력)
  - 우: 관리자 의견 + 후속조치 입력
  - 하단: [저장] [제출] [PDF] 버튼

settings/page.tsx:
- [센서 메타데이터] 탭: 센서 목록 테이블, enabled on/off, interval 수정
- [임계치 관리] 탭: 설비 선택 → 센서별 threshold 편집, 기본값 복원
- [운영정책] 탭: SOP 자동팝업 on/off, 자동 보고서 on/off, missing data timeout
- [이펙트 ON/OFF] 토글 (시각 이펙트 전체 on/off)

SC-01 이벤트 종료 후 보고서가 자동생성되고, 편집/제출이 되는지 확인해줘.
```

#### [P-17] 이력조회 모드 (M-HIS)

```
CLAUDE.md 섹션 9.6의 이력조회를 구현해줘.

history/page.tsx:
- 좌측: 설비 필터 (체크박스 9개) + 기간 필터 + 유형 필터 (정비/점검/교체/사고)
- 우측 상단: 이력 목록 테이블 (구분, 일자, 내용, 설비, 상태)
- 우측 하단: 선택 이력 상세 (일자, 내용, 관련 SOP, 운영자 메모)
- 모드 전환 버튼: [위험예측] [관련 이벤트 보기]

세이프티아 mock 데이터 기반으로 이력 표시.
설비 필터 변경 시 목록 갱신, 이력 항목 클릭 시 상세 표시 확인해줘.
```

---

### Phase 6: 3D 시각 이펙트 + 통합 테스트

#### [P-18] 3D 시각 이펙트

```
CLAUDE.md 섹션 5.7의 3D 시각 이펙트를 구현해줘.

우선순위 순서:
1. 설비 상태 글로우: 이상 설비 주변 반투명 글로우 (WARNING 주황, CRITICAL 적색 펄스)
2. 탱크 레벨/압력: 저장탱크 내부 액면 높이 + 외벽 압력 글로우 (시안→주황→적색)
3. 위험 반경 히트맵: trigger 중심 방사형 그라데이션 (M-RSK, M-SIM에서)
4. 배관 유체 흐름: UV 셰이더 기반 녹색 흐름 애니메이션 (유량 비례 속도)
5. 영향 전파 경로: trigger→affected 점선 흐름

성능 가이드라인:
- 파티클 전체 합계 1000개 이내
- 모든 이펙트는 uniform 업데이트로 처리 (새 material 생성 금지)
- 설정 페이지의 이펙트 ON/OFF 토글 연동

※ 테스트베드 GLB가 아직 없으므로, secondary_pump.glb 기준으로 글로우/컬러링만 먼저 구현하고,
   테스트베드 GLB 제공 후 나머지 이펙트를 완성하는 방식으로 진행해줘.
```

#### [P-19] 통합 테스트 (전체 시나리오 E2E)

```
SC-01(BOG 압축기 트립) 시나리오를 10x 속도로 실행하여 전체 흐름을 테스트해줘.

체크리스트:
[ ] 에뮬레이터 시작 → 하단 바 진행 표시
[ ] NORMAL phase: 전 설비 정상, 공정 흐름 패널 기본 상태
[ ] SYMPTOM phase: 2단계(저장·BOG) 공정 박스 주황 하이라이트
[ ] FAULT phase: 이벤트 팝업 출력 + KPI 대시보드 BOG 카드 변색
[ ] 이벤트 팝업 → [이상탐지] 클릭 → M-ANO 전환, KOGAS 진단 표시
[ ] [위험예측] 클릭 → M-RSK 전환, [▶실행] → 2D/3D/HAZOP 갱신
[ ] [시뮬레이션] 클릭 → M-SIM 전환, [▶실행] → 3D 타임라인 + 대응안
[ ] [SOP 팝업실행] → 현재 모드에서 SOP 패널, 체크 실행 가능
[ ] RESPONSE phase: 점진적 정상화
[ ] 시나리오 종료: 이벤트 CLOSED, 보고서 자동생성
[ ] 보고서 페이지: 초안 확인, 관리자 의견 입력, 제출

문제가 있으면 수정해줘.
```

#### [P-20] 배포 준비

```
CLAUDE.md 섹션 19~20의 배포 가이드를 참고하여 배포를 준비해줘.

1. Backend (Railway):
   - railway.json 생성
   - Prisma migration 명령 확인
   - 환경변수 목록 정리

2. Frontend (Vercel):
   - next.config.js API rewrite 설정
   - 환경변수 (NEXT_PUBLIC_API_URL, NEXT_PUBLIC_GLB_BASE_URL)
   - vercel.json (있다면)

3. GLB (Cloudflare R2):
   - secondary_pump.glb 업로드 명령
   - CORS 설정
   - (테스트베드 GLB는 추후)

4. 배포 후 체크리스트 실행

실제 배포는 내가 직접 하겠지만, 설정 파일과 명령어를 준비해줘.
```

---

## Part 3. 트러블슈팅 팁

### Prisma 관련
```bash
# migration 초기화
npx prisma migrate reset --force
npx prisma migrate dev --name init
npx prisma db seed
```

### SSE 연결 끊김
```bash
# 브라우저 SSE 연결 제한 (HTTP/1.1에서 도메인당 6개)
# → API rewrites로 같은 도메인에서 호출하면 해결
```

### GLB 로드 실패
```bash
# CORS 에러 → next.config.js rewrites 또는 R2 CORS 설정
# 용량 에러 → Draco 압축 적용
gltf-pipeline -i input.glb -o output.glb --draco.compressionLevel 7
```

### Three.js 메모리 누수
```typescript
// 컴포넌트 unmount 시 dispose 필수
useEffect(() => {
  return () => {
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  };
}, []);
```
