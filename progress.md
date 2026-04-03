# LH2 디지털 트윈 POC — 개발 진행 현황 & 이어가기 가이드

> 최종 업데이트: 2026-04-03

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
- 영향 전파 경로 튜브 애니메이션 (PropagationPath — impactScore 기반 두께/색상)
- TopViewSwitcher (2D 모드 = 카메라 탑뷰 + 회전 제한)

### Phase 4: SOP + 시뮬레이션 (완료)
- SOP 추천 로직 + SOP 링크 모듈
- SopExecutionPanel (compact/full 듀얼 UI)
- M-SOP: 실행 + 저작/편집 + 실행이력 3탭
- M-SIM: 이벤트 연계 + 수동 실행 모드 + 가스 확산 시뮬레이션

### Phase 5: 보조 기능 (완료)
- P-RPT: 보고서 CRUD API + UI (목록/상세/수정/제출) + 자동생성 서비스
- P-SET: 설정 3탭 (센서 메타/임계치/운영정책) — DB 연동 + 인라인 편집 완료
- M-HIS: 이력조회 UI (safetia 데이터 표시 + 설비/기간/유형 필터)
- RESPONSE phase 자동 CLOSED + 보고서 자동생성
- EventContext enrichment (useSSE에서 자동 fetch)
- EventPopup enrichment 요약 카드 표시

---

## 2. deck.gl 컨셉 3D 시각화 강화 (2026-04-03)

Three.js 네이티브로 deck.gl 레이어 컨셉을 구현하여 시각화 품질 대폭 향상:

| Step | 구현 내용 | 파일 |
|------|----------|------|
| 1 | Three.js 카메라 동기화 기반 구조 + deckUtils.ts | `deckUtils.ts` |
| 2 | 다중포인트 Gaussian 히트맵 (DeckHeatmap) | `effects/DeckHeatmap.tsx` |
| 3 | PropagationPath impactScore 기반 두께/색상 그라데이션 | `effects/PropagationPath.tsx` |
| 4 | 가스 확산 InstancedMesh 파티클 (GasDispersion) | `effects/GasDispersion.tsx` |
| 5 | 설비 상태 Billboard 아이콘 (StatusIcons) | `effects/StatusIcons.tsx` |

### 상세 설명

- **DeckHeatmap**: 512x512 오프스크린 Canvas에 Gaussian blob을 렌더링 → CanvasTexture로 지면 평면에 매핑. 다중 위험 지점의 중첩 표현 지원.
- **PropagationPath**: impact_score(0~100)에 비례하여 튜브 두께(1.5~4.0), 파티클 크기(2.5~5.5), 아크 높이가 동적 변화. GLSL로 소스(적색)→타겟(황색) 색상 그라데이션.
- **GasDispersion**: 300개 InstancedMesh 파티클로 가스 구름 시뮬레이션. 풍향/풍속에 따른 비대칭 확산, progress 기반 반경 팽창. H2(시안)/BOG(주황) 구분.
- **StatusIcons**: 이상 상태 설비 위에 떠다니는 다이아몬드 형태 Billboard 아이콘. GPU 가속 InstancedMesh로 단일 드로우콜.

---

## 3. 남은 작업 / 개선 사항

| # | 작업 | 설명 | 우선순위 |
|---|------|------|---------|
| 1 | M-RSK 시간축 슬라이더 3D 연동 강화 | 시간에 따라 영향 설비 점진적 추가 애니메이션 | 중간 |
| 2 | 모바일/태블릿 반응형 | CLAUDE.md §21 참조, 현재 데스크탑 전용 | 중간 |
| 3 | 성능 최적화 | GPU 모니터링, 이펙트 ON/OFF 토글 (§22) | 낮음 |
| 4 | 배포 (Vercel + Railway + R2) | CLAUDE.md §19 참조 | 높음 |
| 5 | 전체 시나리오 E2E 테스트 | SC-01~SC-08 전체 흐름 검증 | 높음 |

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

### 4.3 Claude Code 사용 시 프롬프트 예시

```
# 배포
"CLAUDE.md §19를 참고해서 Railway + Vercel + R2 배포를 진행해줘"

# E2E 테스트
"에뮬레이터에서 SC-01 시나리오를 60x 속도로 실행해서
전체 phase 흐름(모니터링→이벤트→위험예측→SOP→보고서)을 테스트해줘"

# 반응형
"CLAUDE.md §21을 참고해서 모바일/태블릿 반응형 레이아웃을 구현해줘"
```

---

## 5. 프로젝트 구조 요약

```
apps/
├── web/                    # Next.js 14 Frontend (port 3000)
│   └── src/
│       ├── app/            # 라우트 (monitoring, anomaly, risk, simulation, history, sop, settings, reports)
│       ├── components/     # UI 컴포넌트
│       │   ├── viewer3d/   # 3D (ThreeCanvas, TestbedModel, CameraController, effects/)
│       │   │   └── effects/ # GlowEffect, TankLevel, HeatmapOverlay, DeckHeatmap, PropagationPath, GasDispersion, StatusIcons, PipeFlow
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
│       ├── services/       # (emulatorEngine, sopRecommender, reportGenerator)
│       └── providers/      # Mock providers
seed/                       # 28개 seed JSON 파일
CLAUDE.md                   # 전체 설계 문서 (단일 소스)
progress.md                 # 이 파일
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
| 셰이더 | GLSL (배관 흐름, 글로우, 그리드, 바다, 하늘, 히트맵, 전파경로) |
| 3D 이펙트 | InstancedMesh (가스확산, 상태아이콘), CanvasTexture (히트맵) |
| ORM | Prisma + PostgreSQL |
