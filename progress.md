# LH2 디지털 트윈 POC — 진행상황

> 최종 업데이트: 2026-04-01

---

## 전체 Phase 진행률

| Phase | 설명 | 상태 |
|-------|------|------|
| Phase 1 | 기반 구조 (Prisma, API, Mock, 에뮬레이터) | ✅ 완료 |
| Phase 2 | 모니터링 + 3D (GNB, GLB, 컬러링, KPI) | ✅ 완료 |
| Phase 3 | 이상탐지 + 위험예측 (M-ANO, M-RSK) | ✅ 완료 |
| Phase 4 | SOP + 시뮬레이션 (M-SOP, M-SIM) | ✅ 완료 |
| Phase 5 | 보조 기능 (보고서, 설정, 이력) + E2E | ✅ 완료 |
| UI 개선 | 디자인 세련화 + 3D 시각 이펙트 | ✅ 완료 |
| 3D 버그 수정 | 카메라/POI/GLB 노드명 이슈 | ✅ 완료 |

---

## 완료된 주요 기능

### Backend (apps/api)
- [x] Prisma schema + migration + seed (28개 JSON 파일)
- [x] REST API 전체 라우트 (scenarios, equipment, sensors, events, providers, hazop, sop, reports, settings)
- [x] Mock Provider (KOGAS/KGS/KETI/세이프티아) — scenario_id 기반 결과 반환
- [x] 시나리오 에뮬레이터 엔진 — SSE 기반, phase별 센서 송출
- [x] RESPONSE phase 자동 이벤트 종료 + 보고서 자동생성
- [x] SOP 추천 로직 (sopRecommender.ts)
- [x] 보고서 자동생성 서비스 (reportGenerator.ts)

### Frontend (apps/web)
- [x] Next.js 14 App Router + Tailwind 다크 테마
- [x] GNB + 모드 네비게이션 (6모드 + 2보조)
- [x] API 연결상태 바 (KOGAS/KGS/KETI/세이프티아)
- [x] Zustand 상태관리 (appStore, emulatorStore)
- [x] SSE 훅 + EventContext 자동 enrichment

### 3D 뷰어 (Three.js)
- [x] h2.glb Draco 로딩 (30MB, self-hosted decoder)
- [x] secondary_pump.glb 상세 뷰 (M-ANO용)
- [x] 설비 mesh 컬러링 (6단계: normal → emergency)
- [x] 동적 바운딩박스 카메라 시스템 (하드코딩 프리셋 제거)
- [x] 설비 POI 라벨 (바운딩박스 상단 자동 배치, 한국어)
- [x] 설비 글로우/아우라 이펙트 (GLSL shader)
- [x] 탱크 레벨/압력 시각화 (GLSL shader, 리플 효과)
- [x] 히트맵 오버레이 (위험 반경)
- [x] 영향 전파 경로 애니메이션
- [x] 바다 셰이더 (파도 애니메이션)
- [x] 설비 클릭 → 카메라 이동 + 정보 패널 갱신

### 모드별 화면
- [x] **M-MON** 기본 모니터링: 공정 흐름 패널(4단계) + 3D + KPI 대시보드 + 정보패널 + 알람이력
- [x] **M-ANO** 이상탐지: 9설비 탭 전환 + 센서 차트 + KOGAS 진단 + 설비 상세 3D
- [x] **M-RSK** 위험예측: react-flow 2D 네트워크 + 3D 컬러링 + HAZOP 텍스트 3분할
- [x] **M-SIM** 시뮬레이션: 이벤트연계/수동 탭 + 3D 시뮬레이션 뷰어 + 대응안 비교
- [x] **M-HIS** 이력조회: 설비/기간/유형 필터 + 이력 테이블 + 상세 패널
- [x] **M-SOP** SOP: 실행(순차 체크리스트) + 저작/편집 + 실행이력 탭
- [x] **P-SET** 설정: 센서 메타(인라인 편집) + 임계치 관리 + 운영정책 토글
- [x] **P-RPT** 보고서: 목록 + 자동생성 요약 + 관리자 코멘트 + 상태관리

### 이벤트/연계 흐름
- [x] 에뮬레이터 → SSE → EventContext → EventPopup (드래그 가능)
- [x] EventPopup에서 모드 전환 버튼 (이상탐지/위험예측/시뮬레이션/SOP/이력)
- [x] EventPopup enrichment 카드 (KOGAS 진단/KGS 영향/SOP 추천)
- [x] SOP 듀얼 UI (팝업 실행 / 전체화면 전환)
- [x] 이벤트 종료 시 보고서 자동생성

---

## 최근 해결된 이슈 (2026-04-01)

### ARM-101 GLB 노드명 불일치 (해결됨)
- **문제**: GLB 파일에 `ARM-101`(children=0, 빈 노드)과 `ARM-101001`(실제 로딩암) 두 노드 존재
- **증상**: `getObjectByName('ARM-101')`이 빈 노드를 먼저 반환 → 카메라/POI/컬러링 실패
- **해결**: `equipmentUtils.ts` 공유 유틸리티 생성
  - `findEquipmentObject()` — 3단계 폴백: ① 직접 이름 검색+mesh 확인 → ② mesh name으로 검색+부모 반환 → ③ suffix 패턴 시도
  - 모든 설비 관련 함수를 한 곳에 통합 (중복 코드 ~155줄 제거)

### 카메라 지하 침투 (이전 세션에서 해결)
- **문제**: CLAUDE.md 하드코딩 좌표가 Blender 좌표계(Z-up) 기준이어서 Three.js(Y-up)에서 카메라가 지면 아래로 이동
- **해결**: 런타임 바운딩박스 기반 동적 카메라 프레이밍으로 전면 교체

---

## 파일 구조 핵심 변경사항

```
apps/web/src/components/viewer3d/
├── equipmentUtils.ts      ← 신규: 설비 검색/bbox 계산 공유 유틸리티
├── CameraController.tsx   ← 수정: equipmentUtils 사용
├── EquipmentPOI.tsx       ← 수정: equipmentUtils 사용
├── TestbedModel.tsx       ← 수정: equipmentUtils 사용 + 중복 코드 제거
├── ThreeCanvas.tsx
├── EnvironmentScene.tsx   ← 도로 제거됨
└── effects/
    ├── GlowEffect.tsx     ← GLSL 셰이더
    ├── TankLevel.tsx      ← GLSL 셰이더
    ├── HeatmapOverlay.tsx
    └── PropagationPath.tsx
```

---

## 남은 작업 / 개선 가능 사항

### 우선순위 높음
- [ ] 배관 유체 흐름 애니메이션 (파티클/UV 스크롤 셰이더)
- [ ] 시나리오 전체 E2E 재생 테스트 (SC-01~SC-08)
- [ ] 모바일/태블릿 반응형 레이아웃 검증

### 우선순위 중간
- [ ] 2D↔3D 동기화 개선 (M-RSK에서 react-flow 노드 클릭 → 3D 카메라 이동)
- [ ] 시간축 슬라이더 (M-RSK/M-SIM에서 predicted_after_sec 기반 단계적 컬러링)
- [ ] 에뮬레이터 바 진행률 표시 개선
- [ ] 성능 프로파일링 (8M+ 정점 GLB 최적화 여부)

### 우선순위 낮음
- [ ] PDF 보고서 내보내기
- [ ] 이펙트 ON/OFF 토글 (설정 페이지)
- [ ] GPU 메모리 모니터링 (개발 모드)
- [ ] Vercel/Railway/R2 배포

---

## 로컬 개발 실행 방법

```bash
# 1. 의존성 설치
npm install

# 2. DB 마이그레이션 + 시드
cd apps/api
npx prisma migrate dev
npx prisma db seed

# 3. 백엔드 실행 (포트 3001)
npm run dev          # apps/api

# 4. 프론트엔드 실행 (포트 3000)
npm run dev          # apps/web (별도 터미널)

# 5. 브라우저에서 http://localhost:3000/monitoring 접속
```

---

## Git 커밋 히스토리 (최근)

```
7eb8c66 feat: 모니터링/이상탐지/SOP UI 대폭 개선 + 동적 카메라 시스템
d49b223 fix: 에뮬레이터 센서 시계열 데이터 송출
6b35f2e fix: 바다 파란색 + 바닥판 마스킹 + 도로→배관 경로
df88e1d feat: 모니터링 3D 뷰어 — 카메라 ISO뷰 + POI + 바다/도로
5f55091 fix: sync emulator running state from SSE
c70f5d0 fix: 버그 3종 수정 — fetch 재시도·WebGL·이력 분류
a172ebc feat: Phase 5 완성 — 보조 기능 + E2E 자동화
fb05b2c feat: UI 디자인 세련화 + 미완성 기능 연결
c5a2553 feat: 실제 GLB 로딩 + Draco + mesh-equipment 매핑
47262ba feat: 3D 이펙트 + M-SIM 3D + SOP 팝업 + 모드 연계
```
