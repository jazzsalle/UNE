# LH2 디지털 트윈 POC — 시작 가이드

## 빠른 시작

### 1. 환경 설정

```bash
# Node.js 18+ 필수
node -v  # v18 이상 확인

# 의존성 설치
npm install              # 루트 (workspaces)
cd apps/api && npm install
cd apps/web && npm install
```

### 2. DB 설정

```bash
# .env 파일 생성 (apps/api/.env)
cp .env.example apps/api/.env
# DATABASE_URL 을 Railway PostgreSQL URL로 수정

# Prisma 초기화
cd apps/api
npx prisma migrate dev --name init
npx prisma generate
npx prisma db seed
```

### 3. 개발 서버 시작

```bash
# 터미널 1: Backend
cd apps/api && npm run dev
# → http://localhost:3001/api/health

# 터미널 2: Frontend
cd apps/web && npm run dev
# → http://localhost:3000
```

### 4. 동작 확인

```bash
# API 상태
curl http://localhost:3001/api/health

# 설비 목록 (9건)
curl http://localhost:3001/api/equipment | jq '.length'

# 시나리오 목록 (8건)
curl http://localhost:3001/api/scenarios | jq '.length'
```

---

## Claude Code로 개발

### 시작

```bash
cd lh2-digital-twin-poc
claude
```

### 자동 파이프라인 (권장)

```bash
# Phase N 전체 자동 실행 (Planner→Generator→Evaluator)
> /phase-run 1
> /phase-run 2
# ...
```

### 수동 에이전트 호출

```bash
> @planner Phase 1의 구현 계획을 수립해줘
> @generator 위 계획에 따라 코드를 생성해줘
> @evaluator 결과물을 검증해줘
```

### 유틸리티 스킬

```bash
> /build-check       # 빌드 검증
> /api-test          # API 스모크 테스트
> /seed-validate     # seed 데이터 검증
```

### 수동 프롬프트 (docs/CLAUDE_CODE_PROMPTS.md 참고)

```bash
> CLAUDE.md를 읽고 Phase 1부터 시작해줘
# 또는 P-01~P-20 프롬프트를 하나씩 입력
```

---

## Phase별 프롬프트

`docs/CLAUDE_CODE_PROMPTS.md` 참고

| Phase | 프롬프트 | 주요 산출물 |
|-------|---------|-----------|
| 1 | P-01~P-06 | DB, API, 에뮬레이터, SOP추천, 보고서 |
| 2 | P-07~P-11 | GNB, 3D뷰어, 공정흐름, KPI, 이벤트팝업 |
| 3 | P-12~P-13 | 이상탐지, 위험예측 |
| 4 | P-14~P-15 | SOP, 시뮬레이션 |
| 5 | P-16~P-17 | 보고서, 설정, 이력조회 |
| 6 | P-18~P-20 | 3D이펙트, E2E테스트, 배포 |

---

## 트러블슈팅

### Prisma 초기화
```bash
npx prisma migrate reset --force
npx prisma migrate dev --name init
npx prisma db seed
```

### SSE 연결 끊김
- HTTP/1.1 도메인당 SSE 6개 제한
- next.config.js rewrites로 같은 도메인 사용

### GLB 로드 실패
- CORS 에러 → R2 CORS 설정 또는 next.config.js rewrites
- Draco 디코더 → public/draco/ 에 self-hosting

### Three.js 메모리 누수
- 컴포넌트 unmount 시 geometry/material dispose 필수
