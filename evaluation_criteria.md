# 채점 기준 — LH2 디지털 트윈 POC

> 이 문서는 Evaluator 에이전트가 각 Phase 결과물을 검증할 때 사용하는 공용 채점 기준입니다.
> 위치: 프로젝트 루트 `evaluation_criteria.md`

---

## 필수 통과 (MUST — 모든 Phase 공통)

| # | 항목 | 검증 방법 | 합격 기준 |
|---|------|---------|---------|
| M-01 | TypeScript 빌드 에러 0건 | `npx tsc --noEmit` (api + web) | exit 0, 에러 출력 없음 |
| M-02 | Backend 빌드 성공 | `cd apps/api && npm run build` | exit 0 |
| M-03 | Frontend 빌드 성공 | `cd apps/web && npm run build` | exit 0 (warning 허용) |
| M-04 | API 헬스체크 200 | `curl -sf localhost:3001/api/health` | HTTP 200 |
| M-05 | Prisma migration 정상 | `npx prisma migrate status` | 미적용 migration 없음 |
| M-06 | seed 데이터 적재 | `GET /api/equipment` | 9건 이상 반환 |
| M-07 | SSE 연결 수신 | `GET /api/emulator/stream` (에뮬레이터 시작 후) | 이벤트 1건 이상 수신 |

> **M-01~M-03 중 하나라도 FAIL이면 해당 Phase 즉시 FAIL 판정**

---

## Phase 1: 기반 구조 (Backend + DB + Seed + 에뮬레이터)

### API 엔드포인트 검증

| # | 엔드포인트 | 기대 응답 | 우선순위 |
|---|----------|---------|---------|
| P1-01 | `GET /api/equipment` | 9건 배열 (SHP~REL) | 상 |
| P1-02 | `GET /api/equipment/BOG-201` | BOG-201 상세 JSON | 상 |
| P1-03 | `GET /api/equipment/BOG-201/sensors` | 센서 배열 (5건 이상) | 상 |
| P1-04 | `GET /api/scenarios` | 8건 배열 (SC-01~SC-08) | 상 |
| P1-05 | `GET /api/scenarios/SC-01` | phases, hazop_id 포함 | 상 |
| P1-06 | `GET /api/zones` | 8건 zone 배열 | 중 |
| P1-07 | `GET /api/hazop/SC-01` | HAZOP 상세 JSON | 상 |
| P1-08 | `GET /api/sop` | 9건 SOP 카탈로그 | 상 |
| P1-09 | `GET /api/settings` | 설정 목록 | 중 |
| P1-10 | `GET /api/thresholds?equipment_id=BOG-201` | 임계치 배열 | 중 |

### Mock Provider 검증

| # | 엔드포인트 | 기대 응답 | 우선순위 |
|---|----------|---------|---------|
| P1-11 | `GET /api/provider/kogas/SC-01` | 진단결과 JSON (fault_name, confidence) | 상 |
| P1-12 | `GET /api/provider/kgs/SC-01` | 영향설비 배열 (impact_score 포함) | 상 |
| P1-13 | `GET /api/provider/keti/SC-01` | 시뮬레이션 결과 (option_a, option_b) | 상 |
| P1-14 | `GET /api/provider/safetia/SC-01` | 이력 배열 | 상 |
| P1-15 | `GET /api/provider/kogas/health` | HTTP 200 | 상 |
| P1-16 | `POST /api/provider/kgs/analyze` | KGS 분석 결과 (scenario_id 기반) | 중 |
| P1-17 | `POST /api/provider/keti/simulate` | KETI 시뮬레이션 결과 | 중 |

### 에뮬레이터 검증

| # | 항목 | 검증 방법 | 합격 기준 | 우선순위 |
|---|------|---------|---------|---------|
| P1-18 | 시나리오 시작 | `POST /api/emulator/start {SC-01, 60}` | HTTP 200, running=true | 상 |
| P1-19 | SSE 이벤트 수신 | `GET /api/emulator/stream` 5초간 | SENSOR_UPDATE 이벤트 수신 | 상 |
| P1-20 | Phase 전환 | SC-01 60x 실행 | PHASE_CHANGE: NORMAL→SYMPTOM→FAULT | 상 |
| P1-21 | 이벤트 생성 | FAULT phase 진입 시 | EventLog INSERT 확인 | 상 |
| P1-22 | 시나리오 중지 | `POST /api/emulator/stop` | running=false | 상 |
| P1-23 | 상태 조회 | `GET /api/emulator/status` | scenario_id, phase, elapsed 포함 | 중 |

### 서비스 로직 검증

| # | 항목 | 검증 방법 | 합격 기준 | 우선순위 |
|---|------|---------|---------|---------|
| P1-24 | SOP 추천 | `GET /api/sop/recommend?event_id=...` | SOP-BOG-TRIP-01 반환 (SC-01) | 상 |
| P1-25 | SOP fallback | 매칭 없는 event_id | SOP-GENERIC-INSPECT-01 반환 | 중 |
| P1-26 | 보고서 생성 | `POST /api/reports/generate {event_id}` | DRAFT 상태 보고서, 6개 소스 포함 | 상 |

---

## Phase 2: 프론트 프레임 + 3D + 모니터링

### 공통 레이아웃

| # | 항목 | 합격 기준 | 우선순위 |
|---|------|---------|---------|
| P2-01 | GNB 모드 탭 | 6모드(M-MON~M-SOP) 수평 나열, 현재 모드 하이라이트 | 상 |
| P2-02 | 알람 인디케이터 | 미처리 알람 건수 배지, 클릭 시 드롭다운 | 상 |
| P2-03 | 시나리오 선택기 | 8개 시나리오 드롭다운 | 상 |
| P2-04 | API 상태바 | 4기관 🟢/🟡/🔴 표시, 클릭 시 상세 팝업 | 상 |
| P2-05 | 에뮬레이터 바 | 진행률, phase, elapsed/total, 속도, ▶⏸⏹ 버튼 | 상 |
| P2-06 | 설정/보고서 링크 | GNB에서 /settings, /reports 이동 | 상 |

### Zustand Store

| # | 항목 | 합격 기준 | 우선순위 |
|---|------|---------|---------|
| P2-07 | appStore.eventContext | CLAUDE.md §4.1 EventContext 인터페이스 일치 | 상 |
| P2-08 | appStore.switchModeWithContext | 모드 전환 시 EventContext 유지 | 상 |
| P2-09 | emulatorStore | running, scenario_id, elapsed_sec, phase, speed | 상 |

### 3D 뷰어

| # | 항목 | 합격 기준 | 우선순위 |
|---|------|---------|---------|
| P2-10 | GLB 로드 | secondary_pump.glb 정상 렌더링, 콘솔 에러 없음 | 상 |
| P2-11 | 컬러링 시스템 | COLOR_MAP 6개 상태 → mesh material.color.set() | 상 |
| P2-12 | 카메라 프리셋 | CAMERA_PRESETS 좌표로 0.8초 부드러운 전환 | 상 |
| P2-13 | 로딩 프로그레스 | GLB 로드 중 프로그레스 UI 표시 | 중 |

### 기본 모니터링 (M-MON)

| # | 항목 | 합격 기준 | 우선순위 |
|---|------|---------|---------|
| P2-14 | 공정 흐름 패널 | 좌측 15%, 4단계 세로, 설비 아이콘+이름, 접이식 카드 | 상 |
| P2-15 | 설비 클릭→카메라 | 공정 흐름 설비 클릭 → 3D 카메라 이동 + 정보패널 갱신 | 상 |
| P2-16 | 이벤트 하이라이트 | trigger 공정 박스 적색, affected 공정 박스 주황 | 상 |
| P2-17 | 조건부 센서값 | 이상 시에만 화살표 위 센서값 라벨 (적색) | 중 |
| P2-18 | 정보 패널 | 우측 20%, 설비명/센서값/알람/모드전환 버튼 | 상 |
| P2-19 | 센서 실시간 반영 | SSE SENSOR_UPDATE → 정보패널 값 갱신 | 상 |
| P2-20 | KPI 대시보드 | 3D 하단, 9설비 카드, 이상 시 색상 변경, 클릭→카메라 | 상 |
| P2-21 | 이벤트 팝업 | 중앙 모달, 공정/설비/심각도/요약, 모드전환 6버튼 | 상 |
| P2-22 | SSE 연결 | useSSE 훅 → 이벤트별 store 업데이트 | 상 |

---

## Phase 3: 이상탐지 + 위험예측

| # | 항목 | 합격 기준 | 우선순위 |
|---|------|---------|---------|
| P3-01 | M-ANO 레이아웃 | 좌4차트+중3D+우4차트, 설비탭 9개, 하단 3분할 | 상 |
| P3-02 | 설비별 3D 전환 | PMP-301→secondary_pump.glb, 기타→테스트베드 줌인 | 상 |
| P3-03 | 센서 추세 차트 | recharts 시계열 + 임계선 + 이상구간 배경색 | 상 |
| P3-04 | pump mesh 컬러링 | SC-02 FAULT 시 impeller_stage_03 적색 | 상 |
| P3-05 | KOGAS 진단 바 | 연결상태+고장명+확신도+의심부위+고장코드 | 상 |
| P3-06 | M-RSK 3분할 | 좌30%(react-flow)+중40%(3D)+우30%(HAZOP) | 상 |
| P3-07 | M-RSK 실행제어 | 상단 입력패널, 이벤트연계/수동선택, [▶실행][↻초기화] | 상 |
| P3-08 | 2D 영향 네트워크 | trigger(적색)+affected(황색)+link(두께=score) | 상 |
| P3-09 | 2D→3D 연동 | 2D 노드 클릭 → 3D 카메라 자동 이동 | 상 |
| P3-10 | HAZOP 텍스트 | 원인/이벤트/위험/예방/비상 5항목 | 상 |
| P3-11 | 시간축 슬라이더 | 0~60분 드래그 → predicted_after_sec 기반 컬러링 변화 | 중 |
| P3-12 | 연계 SOP 바로가기 | HAZOP 패널 내 SOP 팝업실행/전체화면 버튼 | 상 |

---

## Phase 4: SOP + 시뮬레이션

| # | 항목 | 합격 기준 | 우선순위 |
|---|------|---------|---------|
| P4-01 | M-SOP 3탭 | [실행] [저작/편집] [실행이력] 탭 전환 | 상 |
| P4-02 | SOP 실행 패널 | 체크리스트 체크→PUT→메모→완료→상황전파 | 상 |
| P4-03 | 듀얼 UI | compact=true(400px), compact=false(전체화면) 동일 컴포넌트 | 상 |
| P4-04 | SOP 저작 | 생성/수정/단계추가삭제/유형선택/저장 | 중 |
| P4-05 | M-SIM 2탭 | [이벤트연계] [수동실행] 탭 전환 | 상 |
| P4-06 | 시뮬레이션 입력 | 시나리오/설비 자동채움, 파라미터 슬라이더 4개 | 상 |
| P4-07 | KETI+KGS 동시호출 | [▶실행] → 3D + 결과 패널 동시 갱신 | 상 |
| P4-08 | 3D 타임라인 | 스크러버 드래그 → 시간별 컬러링 변화 | 중 |
| P4-09 | 대응안 비교 | Option A/B 카드 (안정화시간/위험도) + [적용▶] | 상 |
| P4-10 | SOP 팝업 호출 | 이벤트 팝업 → [SOP 팝업실행] → 우측 400px 패널 | 상 |

---

## Phase 5: 보조 기능

| # | 항목 | 합격 기준 | 우선순위 |
|---|------|---------|---------|
| P5-01 | P-RPT 레이아웃 | 좌 목록 + 우 상세 (자동수집 6소스 + 관리자 의견) | 상 |
| P5-02 | 보고서 자동생성 | 이벤트 종료 시 DRAFT 자동 생성 | 상 |
| P5-03 | 보고서 편집/제출 | 관리자 의견 입력 → 저장 → 제출 (DRAFT→SUBMITTED) | 상 |
| P5-04 | P-SET 3탭 | 센서메타/임계치/운영정책 탭 전환 | 상 |
| P5-05 | 임계치 편집 | 설비 선택 → 센서별 warning/critical 상하한 편집 → 저장 | 중 |
| P5-06 | M-HIS 필터 | 설비/기간/유형 3필터 + 이력 목록 + 상세 | 상 |
| P5-07 | 이력 상세 | 일자/내용/관련SOP/운영자메모 + 모드전환 버튼 | 중 |

---

## Phase 6: 3D 이펙트 + 통합 테스트

| # | 항목 | 합격 기준 | 우선순위 |
|---|------|---------|---------|
| P6-01 | 설비 글로우 | WARNING=주황, CRITICAL=적색 펄스 | 상 |
| P6-02 | 탱크 레벨/압력 | 액면 높이 조절 + 외벽 압력 글로우 | 상 |
| P6-03 | 위험 반경 히트맵 | trigger 중심 방사형 (M-RSK/M-SIM) | 중 |
| P6-04 | 배관 유체 흐름 | 셰이더/파티클 흐름 애니메이션 | 중 |
| P6-05 | 영향 전파 경로 | trigger→affected 점선 흐름 | 중 |
| P6-06 | 이펙트 토글 | P-SET에서 ON/OFF 가능 | 중 |
| P6-07 | E2E SC-01 | 모니터링→이벤트→이상탐지→위험예측→시뮬레이션→SOP→보고서 | 상 |
| P6-08 | 성능 60fps | 데스크톱 Chrome DevTools Performance | 상 |
| P6-09 | API < 500ms | 주요 엔드포인트 P95 응답시간 | 중 |

---

## 채점 요약

| Phase | 총 항목 | PASS 기준 | FAIL 기준 |
|-------|--------|---------|---------|
| 1 | 26 | 상 우선순위 전체 + 중 80% | 상 1건이라도 FAIL |
| 2 | 22 | 상 우선순위 전체 + 중 80% | 상 1건이라도 FAIL |
| 3 | 12 | 상 우선순위 전체 + 중 80% | 상 1건이라도 FAIL |
| 4 | 10 | 상 우선순위 전체 + 중 80% | 상 1건이라도 FAIL |
| 5 | 7 | 상 우선순위 전체 + 중 80% | 상 1건이라도 FAIL |
| 6 | 9 | 상 우선순위 전체 + 중 60% | 상 1건이라도 FAIL |
