# LH2 디지털 트윈 POC — 개발 진행 현황 & 이어가기 가이드

> 최종 업데이트: 2026-04-02

---

## 1. 완료된 Phase 요약

### Phase 1: 기반 구조 (완료)
- Prisma schema + migration + seed.ts (28개 seed JSON 파일 적재)
- Express 서버 + 전체 API 라우트 구현
- Mock Provider (KOGAS/KGS/KETI/세이프티아) 구현
- 시나리오 에뮬레이터 엔진 (SSE 기반, 8개 시나리오)

### Phase 2: 모니터링 + 3D (완료)
- Next.js 앱 프레임 + GNB + 모드 라우팅 (6모드 + 2보조페이지)
- Three.js GLB 로더 + Draco 디코딩 (h2.glb 30MB)
- 3D 시각 이펙트: 배관 유체 흐름(GLSL 파티클), 탱크 레벨, 설비 글로우, 히트맵
- 기본 모니터링 UI: 공정 흐름 패널 + 3D 뷰어 + 정보 패널 + KPI 대시보드
- 에뮬레이터 UI: 시나리오 선택 + 재생 컨트롤 + 하단 진행바
- EventPopup 컴포넌트 (이벤트 발생 시 모드 전환 버튼)
- 카메라 시점 저장/복원/초기화 (CameraBookmark)
- 상시 모니터링 애니메이션 (선박 부유, 로딩암 미세 회전)

### Phase 3: 이상탐지 + 위험예측 (완료)
- M-ANO: KOGAS 진단 패널 + 센서 추세 차트 (8쌍) + 설비 탭 전환 + PMP-301 상세 GLB
- M-RSK: 3분할 화면 구현 완료
  - 좌: react-flow 2D 영향 네트워크 (리사이즈 가능)
  - 중: 3D 뷰어 (아이소메트릭 그룹 프레이밍 + 2D/3D 토글)
  - 우: RiskDetailPanel (위험도 예측 / 피해범위 예측 2탭)
- 2D↔3D 동기화 (노드 클릭 → 카메라 이동)
- 에뮬레이터 연동 (FAULT phase 진입 시 자동 KGS/HAZOP 로드)
- 영향 전파 경로 튜브 애니메이션 (PropagationPath — 두꺼운 튜브 + 파티클)
- TopViewSwitcher (2D 모드 = 카메라 탑뷰 + 회전 제한)

### Phase 4: SOP + 시뮬레이션 (완료)
- SOP 추천 로직 + SOP 링크 모듈
- SopExecutionPanel (compact/full 듀얼 UI)
- M-SOP: 실행 + 저작/편집 + 실행이력 3탭
- M-SIM: 이벤트 연계 + 수동 실행 모드

### Phase 5: 보조 기능 (부분 완료)
- P-RPT: 보고서 CRUD API + UI (목록/상세/수정/제출)
- P-SET: 설정 3탭 (센서 메타/임계치/운영정책) — DB 연동 완료
- M-HIS: 이력조회 UI (safetia 데이터 표시 + 설비/기간 필터)

---

## 2. 오늘 세션에서 작업한 내용 (2026-04-02)

### 위험예측 모드 (M-RSK) 집중 개선

| 작업 | 파일 | 내용 |
|------|------|------|
| 좌측 패널 리사이즈 | `risk/page.tsx` | 드래그 핸들로 폭 조절 (160~480px) |
| 아이소메트릭 그룹 프레이밍 | `CameraController.tsx` | frameEquipmentIds prop → 합산 bbox 기반 ISO뷰 |
| 2D/3D 모드 토글 | `risk/page.tsx`, `TopViewSwitcher.tsx` (신규) | 2D=탑뷰 카메라 + 회전 제한 |
| 에뮬레이터-3D 연동 | `risk/page.tsx` | phase 기반 설비 컬러링 + FAULT시 자동 KGS 로드 |
| 글로우 이펙트 크기 수정 | `TestbedModel.tsx` | 고정 15x15x15 → 실제 bbox + 6 패딩 |
| 2D 네트워크 노드 겹침 수정 | `ImpactNetwork2D.tsx` | 트리거/영향 분리 배치 |
| 우측 패널 2탭 구조 | `risk/page.tsx` (RiskDetailPanel) | 위험도 예측 + 피해범위 예측 |
| 전파 경로 시각화 개선 | `PropagationPath.tsx` | 1px 점선 → 두꺼운 튜브(2.5r) + 파티클(4.0r) |
| 히트맵 가시성 개선 | `HeatmapOverlay.tsx` | 그라데이션 opacity 증가 |
| 바닥 그리드 어둡게 | `EnvironmentScene.tsx` | 베이스 #060810, 라인 #151c26 |

### 기타 모드 개선 (이전 세션 포함)

- **모니터링**: 공정 흐름 패널 4단계 + KPI 대시보드 9설비 + 센서 차트 개선
- **이상탐지**: 센서 차트 8쌍 + AI 진단 타임라인 + 설비 탭 전환
- **SOP**: 실행이력 API 라우트 수정 + 탭 조건분기
- **3D 공통**: 배관 유체 흐름 GLSL, 카메라 북마크, 상시 모니터링 애니메이션

---

## 3. 미완성 / 남은 작업

### Phase 5 잔여 (CLAUDE.md plan 참조)

| # | 작업 | 상태 | 우선순위 |
|---|------|------|---------|
| 1 | RESPONSE phase에서 이벤트 자동 CLOSED 처리 | 미구현 | 높음 |
| 2 | 보고서 자동생성 서비스 추출 (reportGenerator.ts) | 미구현 | 높음 |
| 3 | EventContext enrichment (useSSE에서 자동 fetch) | 미구현 | 중간 |
| 4 | EventPopup에 enrichment 요약 카드 표시 | 미구현 | 중간 |
| 5 | 이력조회 기간/유형 필터 실제 동작 | 미구현 | 낮음 |
| 6 | 설정 메타데이터 탭 인라인 편집 | 미구현 | 낮음 |

### 추가 개선 사항

| # | 작업 | 설명 |
|---|------|------|
| 1 | M-RSK 시간축 슬라이더 3D 연동 강화 | 시간에 따라 영향 설비 점진적 추가 애니메이션 |
| 2 | M-SIM 3D 시뮬레이션 타임라인 | 타임라인 스크러버로 시간별 3D 컬러링 변화 |
| 3 | 모바일/태블릿 반응형 | CLAUDE.md §21 참조, 현재 데스크탑 전용 |
| 4 | 성능 최적화 | GPU 모니터링, 이펙트 ON/OFF 토글 (§22) |
| 5 | 배포 (Vercel + Railway + R2) | CLAUDE.md §19 참조 |

---

## 4. 집 PC에서 이어가기 가이드

### 4.1 환경 준비

```bash
# 1. 레포 클론 (이미 있으면 pull)
git clone https://github.com/jazzsalle/UNE.git
cd UNE

# 또는 기존 레포에서
git pull origin main

# 2. 의존성 설치
npm install          # root workspace
cd apps/api && npm install
cd ../web && npm install
cd ../..

# 3. DB 설정 (PostgreSQL 필요)
cd apps/api
cp .env.example .env   # DATABASE_URL 수정
npx prisma migrate dev
npx prisma db seed
cd ../..

# 4. GLB 파일
# h2.glb (30MB) → apps/web/public/models/h2.glb 에 배치
# secondary_pump.glb → apps/web/public/models/secondary_pump.glb 에 배치
# (이미 public/models/에 있으면 OK)

# 5. Draco 디코더
mkdir -p apps/web/public/draco
cp node_modules/three/examples/jsm/libs/draco/gltf/* apps/web/public/draco/
```

### 4.2 개발 서버 실행

```bash
# 터미널 1: API 서버
cd apps/api && npm run dev    # → http://localhost:3001

# 터미널 2: Web 프론트
cd apps/web && npm run dev    # → http://localhost:3000
```

### 4.3 작업 이어가기 — 추천 순서

1. **Phase 5 완성** — plan 파일 참조
   - Step 1: emulatorEngine.ts에 RESPONSE phase 자동 CLOSED + 보고서 생성
   - Step 2: reportGenerator.ts 서비스 추출
   - Step 3-4: EventContext enrichment + EventPopup 표시

2. **M-RSK 시간축 시각화 고도화**
   - 시간축 슬라이더 드래그 시 3D에서 영향 설비가 단계적으로 컬러링 변화
   - predicted_after_sec 기준으로 애니메이션

3. **전체 시나리오 E2E 테스트**
   - SC-01 시나리오 에뮬레이터 실행
   - NORMAL → SYMPTOM → FAULT → SECONDARY_IMPACT → RESPONSE 전체 흐름 검증

### 4.4 Claude Code 사용 시 프롬프트 예시

```
# Phase 5 잔여 작업
"CLAUDE.md를 참고해서 Phase 5 plan을 이어서 구현해줘.
Step 1: emulatorEngine에서 RESPONSE phase 진입 시 이벤트 CLOSED + 보고서 자동생성"

# M-RSK 개선
"위험예측 모드의 시간축 슬라이더를 드래그하면 3D에서
predicted_after_sec에 따라 영향 설비가 단계적으로 컬러링되도록 개선해줘"

# E2E 테스트
"에뮬레이터에서 SC-01 시나리오를 60x 속도로 실행해서
전체 phase 흐름(모니터링→이벤트→위험예측→SOP→보고서)을 테스트해줘"
```

---

## 5. 프로젝트 구조 요약

```
apps/
├── web/                    # Next.js 14 Frontend (port 3000)
│   └── src/
│       ├── app/            # 라우트 (monitoring, anomaly, risk, simulation, history, sop, settings, reports)
│       ├── components/     # UI 컴포넌트
│       │   ├── viewer3d/   # 3D (ThreeCanvas, TestbedModel, CameraController, TopViewSwitcher, effects/)
│       │   ├── risk/       # 위험예측 (ImpactNetwork2D, RiskPOIs)
│       │   ├── common/     # 공통 (EventPopup, SensorChart)
│       │   ├── layout/     # 레이아웃 (GNB, AmbientProvider)
│       │   ├── sop/        # SOP (SopExecutionPanel, SopListPanel, SopEditorPanel)
│       │   └── process-flow/ # 공정 흐름
│       ├── stores/         # Zustand (appStore, emulatorStore)
│       ├── hooks/          # (useSSE, useAmbientMonitor)
│       └── lib/            # (api.ts, constants.ts)
├── api/                    # Express Backend (port 3001)
│   └── src/
│       ├── routes/         # API 라우트
│       ├── services/       # (emulatorEngine, sopRecommender)
│       └── providers/      # Mock providers
seed/                       # 28개 seed JSON 파일
CLAUDE.md                   # 전체 설계 문서 (단일 소스)
```

---

## 6. 주요 기술 참고

| 항목 | 기술/방식 |
|------|----------|
| 3D 렌더링 | Three.js + @react-three/fiber + @react-three/drei |
| GLB 압축 | Draco (h2.glb), 디코더 self-hosted (/draco/) |
| 2D 네트워크 | react-flow |
| 차트 | recharts + 커스텀 SensorChart |
| 상태관리 | Zustand (appStore, emulatorStore) |
| 실시간 | SSE (Server-Sent Events) |
| 카메라 전환 | gsap 애니메이션 (0.8s ease) |
| 셰이더 | GLSL (배관 흐름, 글로우, 그리드, 바다, 하늘) |
| ORM | Prisma + PostgreSQL |
