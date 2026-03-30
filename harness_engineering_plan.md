# LH2 디지털 트윈 POC — 하네스 엔지니어링 & 개발 착수 계획서

> 작성일: 2026-03-30  
> 대상: Claude Code (MAX 계정) 기반 멀티에이전트 개발 체계  
> 목적: 클로드 코드 착수 전 전략 수립 + Git 워크플로우 + 환경변수/인프라 준비

---

## 1. 하네스 엔지니어링 개요

### 1.1 하네스 엔지니어링이란?

레퍼런스 영상(EP.04)에서 제시한 "하네스 엔지니어링"은 **Claude Code 내에서 멀티 에이전트를 역할별로 분리하여 자동화된 생산라인처럼 운영하는 방법론**입니다. 핵심은 다음과 같습니다:

- **CLAUDE.md** = 오케스트레이터 (전체 흐름 지휘)
- **agents/** 폴더 = 역할별 에이전트 지시서 (Planner, Generator, Evaluator)
- **evaluation_criteria.md** = 공용 채점 기준
- **output/** = 결과물 저장소
- **START.md** = 실행 방법 안내

### 1.2 3단계 생산 라인 (레퍼런스 이미지 기반)

```
┌─────────────────────────────────────────────────────────────────┐
│                협업 워크플로우: 3단계 생산 라인                       │
├──────────────┬──────────────────┬───────────────────────────────┤
│  Station 1   │   Station 2      │   Station 3                   │
│  기획팀장     │   개발자          │   QA 엔지니어                  │
│              │                  │                               │
│  상세 기획서   │   디자인 청사진을   │   상세 거절 노트               │
│  → 상세 프롬프│   토대로 코드 및   │   ✓ 버그 발견                 │
│  트로 기능    │   시제품 생성      │   ↳ 버그 발견                 │
│  도출 + 새로운│                  │   ↳ 디자인 불일치              │
│  기능 발견    │   CODE            │   ↳ 디자인 불일치              │
│              │   GENERATING...   │   → 합격(PASS) / 불합격(FAIL)  │
│  [Planner]   │   [Generator]     │   [Evaluator]                │
└──────────────┴──────────────────┴───────────────────────────────┘
```

---

## 2. 프로젝트 맞춤 하네스 구조 설계

### 2.1 디렉토리 구조

```
lh2-digital-twin-poc/
├── CLAUDE.md                          ← 오케스트레이터 (기존 문서 = 전체 흐름 지휘)
├── agents/
│   ├── planner.md                     ← Planner 에이전트 지시서
│   ├── generator.md                   ← Generator 에이전트 지시서
│   ├── evaluator.md                   ← Evaluator 에이전트 지시서
│   └── evaluation_criteria.md         ← 공용 채점 기준
├── docs/
│   ├── FUNC_SPEC_POC_v5.md            ← 기능명세서 (PRD)
│   └── CLAUDE_CODE_PROMPTS.md         ← 단계별 프롬프트 가이드
├── seed/                              ← seed JSON 파일 (ZIP 해제)
│   ├── seed_manifest.json
│   ├── seed_master_zone.json
│   ├── ... (30개 파일)
│   └── seed_sensor_timeseries_SC-08.json
├── apps/
│   ├── web/                           ← Next.js Frontend
│   └── api/                           ← Express Backend
├── public/models/                     ← secondary_pump.glb
├── output/                            ← 에이전트 결과물 저장
│   ├── phase1/
│   ├── phase2/
│   └── ...
├── .env.example                       ← 환경변수 템플릿
├── .gitignore
├── package.json
└── START.md                           ← 실행 방법 안내
```

### 2.2 에이전트 역할 정의

#### Planner (기획팀장)

```markdown
# agents/planner.md 핵심 내용

## 역할
- CLAUDE.md와 FUNC_SPEC_POC_v5.md를 기반으로 각 Phase의 구현 계획 수립
- 단순 프롬프트를 상세 기획서로 변환
- 새로운 기능/엣지케이스 도출
- Generator가 즉시 코딩 가능한 수준의 태스크 분해

## 입력
- 사용자의 Phase 실행 요청 (예: "Phase 1 시작")
- CLAUDE.md 해당 섹션
- 이전 Phase 결과물 (있을 경우)

## 출력
- 구현 태스크 목록 (우선순위 포함)
- 각 태스크별 참조 섹션 (CLAUDE.md 섹션 번호)
- 예상 파일 목록
- 의존성 순서
- 수락 기준 (evaluation_criteria.md 매핑)
```

#### Generator (개발자)

```markdown
# agents/generator.md 핵심 내용

## 역할
- Planner의 태스크 목록을 받아 실제 코드 생성
- CLAUDE.md의 기술 명세를 그대로 구현
- 디자인 청사진(와이어프레임)을 코드로 변환

## 입력
- Planner가 산출한 태스크 목록
- CLAUDE.md 기술 명세 (해당 섹션)
- 기존 코드베이스 (이전 Phase 결과물)

## 출력
- 구현된 소스 코드
- 실행 가능한 상태 (빌드/에러 없음)
- output/{phase}/ 에 결과물 기록

## 코딩 원칙
- TypeScript strict mode
- 공통 컴포넌트 우선 생성
- seed 파일은 직접 읽지 않고 스키마 정의만 참조
- material.color.set()만 호출 (새 material 생성 금지)
```

#### Evaluator (QA 엔지니어)

```markdown
# agents/evaluator.md 핵심 내용

## 역할
- Generator 결과물의 품질 검증
- evaluation_criteria.md 기준으로 채점
- PASS / FAIL 판정 + 상세 거절 노트 작성

## 검증 항목
1. 빌드 성공 여부 (npm run build)
2. API 엔드포인트 응답 검증 (curl 테스트)
3. 타입 에러 0건 확인
4. CLAUDE.md 명세와의 일치도
5. UI 와이어프레임 반영도
6. seed 데이터 정합성
7. SSE 이벤트 정상 수신

## 출력
- 합격(PASS): 다음 Phase 진행 승인
- 불합격(FAIL): 상세 거절 노트 (버그/디자인불일치/누락 항목)
  → Generator에게 수정 요청 루프
```

### 2.3 evaluation_criteria.md (공용 채점 기준)

```markdown
# 채점 기준

## 필수 통과 (MUST)
- [ ] TypeScript 빌드 에러 0건
- [ ] API 헬스체크 200 응답
- [ ] Prisma migration 정상 적용
- [ ] seed 데이터 적재 후 equipment 7건 이상 조회
- [ ] SSE 연결 시 이벤트 수신 확인

## 기능 검증 (Phase별)
### Phase 1
- [ ] GET /api/equipment 정상 응답
- [ ] GET /api/scenarios 8건 반환
- [ ] POST /api/emulator/start → SSE stream 수신
- [ ] Phase 전환 시 PHASE_CHANGE 이벤트 발생

### Phase 2
- [ ] GNB 6개 모드 탭 정상 렌더링
- [ ] 3D GLB(secondary_pump.glb) 로드 성공
- [ ] 에뮬레이터 하단바 진행률 표시
- [ ] 설비 컬러링 COLOR_MAP 적용 확인

### Phase 3~5
- [ ] 각 모드별 와이어프레임 레이아웃 일치
- [ ] EventContext 모드 전환 시 유지
- [ ] SOP 추천 로직 정상 동작
- [ ] 보고서 자동생성 6개 데이터 소스 포함

## 성능 기준
- [ ] 3D 씬 60fps 유지 (데스크톱)
- [ ] API 응답 < 500ms
- [ ] GLB 로드 시 프로그레스 UI 표시
```

---

## 3. 실행 워크플로우

### 3.1 Phase별 에이전트 실행 흐름

```
┌──────────────────────────────────────────────────────────────┐
│                    Phase N 실행 흐름                           │
│                                                              │
│  사용자: "Phase 1 시작"                                       │
│       ↓                                                      │
│  [Planner] CLAUDE.md 섹션 분석 → 태스크 분해 → 구현 계획서       │
│       ↓                                                      │
│  [Generator] 태스크별 코드 생성 → 빌드 → output/phase1/        │
│       ↓                                                      │
│  [Evaluator] evaluation_criteria 기준 검증                     │
│       ↓                                                      │
│  PASS? ──→ YES ──→ "Phase 1 완료. Phase 2 진행 가능"          │
│       │                                                      │
│       └──→ NO ──→ 거절 노트 작성 → Generator 수정 루프         │
│                    (최대 3회 반복)                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Claude Code에서의 실제 실행 방법

Claude Code에서 하네스를 실행하는 방법은 두 가지입니다:

**방법 A: 단일 세션 오케스트레이션 (권장)**

```bash
# Claude Code 시작
claude

# 오케스트레이터 모드로 실행
> @CLAUDE.md 를 참고하고, agents/planner.md 역할로 Phase 1을 계획해줘.
> 계획이 완료되면 agents/generator.md 역할로 코드를 생성해줘.
> 생성이 완료되면 agents/evaluator.md 역할로 검증해줘.
```

**방법 B: 프롬프트별 수동 전환 (세밀 제어)**

```bash
# CLAUDE_CODE_PROMPTS.md의 [P-01]~[P-20] 프롬프트를 순서대로 입력
# 각 프롬프트 실행 → 결과 확인 → 다음 프롬프트
```

### 3.3 Phase-에이전트 매핑 (CLAUDE_CODE_PROMPTS.md 연동)

| Phase | Planner 참조 | Generator 프롬프트 | Evaluator 검증 |
|-------|-------------|-------------------|---------------|
| Phase 1: 기반구조 | CLAUDE.md §7,8,20 | P-01~P-06 | API health + seed 적재 |
| Phase 2: 모니터링+3D | CLAUDE.md §5,9.1,9.2,13 | P-07~P-11 | GNB + 3D + SSE |
| Phase 3: 이상탐지+위험예측 | CLAUDE.md §9.3,9.4 | P-12~P-13 | 2D/3D/HAZOP 연동 |
| Phase 4: SOP+시뮬레이션 | CLAUDE.md §9.5,9.8,11 | P-14~P-15 | SOP 추천 + 실행 |
| Phase 5: 보조기능 | CLAUDE.md §9.6,9.7,9.9,12 | P-16~P-17 | 보고서 + 설정 |
| Phase 6: 이펙트+통합 | CLAUDE.md §5.7 | P-18~P-20 | E2E 전체 시나리오 |

---

## 4. Git 워크플로우 & 멀티 PC 작업 방안

### 4.1 Git 저장소 초기화

회사 PC와 개인 PC 간 작업을 원활하게 하려면 Git 원격 저장소가 필수입니다.

```bash
# 1. GitHub 저장소 생성 (Private 권장)
# GitHub.com → New Repository → lh2-digital-twin-poc (Private)

# 2. 로컬 초기화 + 원격 연결
cd lh2-digital-twin-poc
git init
git remote add origin https://github.com/{your-username}/lh2-digital-twin-poc.git

# 3. 초기 커밋
git add .
git commit -m "init: 프로젝트 구조 + CLAUDE.md + seed 데이터"
git push -u origin main
```

### 4.2 .gitignore 필수 항목

```gitignore
# 환경변수 (절대 커밋 금지)
.env
.env.local
.env.production

# 의존성
node_modules/
.next/
dist/

# GLB 대용량 파일 (Git LFS 또는 R2로 관리)
*.glb

# Prisma
prisma/migrations/**/migration_lock.toml

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/settings.json
.idea/

# 빌드 결과물
output/
```

### 4.3 GLB 파일 관리 전략

GLB 파일(h2.glb 30MB, secondary_pump.glb 210KB)은 Git에 직접 올리기엔 큽니다:

**전략 1: Git LFS (간편)**
```bash
git lfs install
git lfs track "*.glb"
git add .gitattributes
git add public/models/secondary_pump.glb
git commit -m "feat: GLB 파일 추가 (LFS)"
```

**전략 2: Cloudflare R2 + .env (권장, 본 프로젝트 채택)**
- `secondary_pump.glb` → `public/models/` (210KB이므로 Git 직접 커밋 가능)
- `h2.glb` → Cloudflare R2 업로드 → `NEXT_PUBLIC_GLB_BASE_URL`로 참조
- `.env.example`에 URL 템플릿만 기록

### 4.4 멀티 PC 작업 플로우

```
┌──────────────────┐          ┌──────────────────┐
│    개인 PC        │          │    회사 PC        │
│  (MAX 계정)       │          │                  │
│                  │          │                  │
│  git push        │ ──────→  │  git pull         │
│                  │ ←──────  │  git push         │
│  Claude Code     │          │  Claude Code      │
│  (MAX Plan)      │          │  (동일 계정)       │
└──────────────────┘          └──────────────────┘
         │                             │
         └──────── GitHub ─────────────┘
                 (Private Repo)
```

**동기화 루틴:**
```bash
# 작업 시작 전 (항상!)
git pull origin main

# 작업 후
git add .
git commit -m "feat(phase1): Prisma schema + seed loader 완료"
git push origin main

# 충돌 시
git stash
git pull origin main
git stash pop
# 충돌 해결 후 커밋
```

### 4.5 브랜치 전략 (선택)

POC 수준이라 `main` 단일 브랜치로 충분하지만, Phase 단위로 관리하고 싶다면:

```bash
git checkout -b phase/1-foundation
# ... Phase 1 작업 ...
git checkout main
git merge phase/1-foundation

git checkout -b phase/2-monitoring-3d
# ... Phase 2 작업 ...
```

---

## 5. 환경변수 & 인프라 정보 준비

### 5.1 필요 계정/서비스 목록

| 서비스 | 용도 | 필요 정보 | 비용 |
|--------|------|----------|------|
| **GitHub** | 코드 저장소 | 계정 + Private Repo | 무료 |
| **Railway** | Backend + PostgreSQL | 계정 + 프로젝트 | $5~15/월 |
| **Vercel** | Frontend 배포 | 계정 + 프로젝트 | 무료~$20/월 |
| **Cloudflare R2** | GLB 파일 CDN | 계정 + 버킷 | 무료 (10GB) |
| **Anthropic** | Claude Code (MAX) | API Key (MAX Plan) | MAX 구독료 |

### 5.2 .env.example 템플릿

```bash
# ============================================
# Backend (apps/api/.env)
# ============================================

# Railway PostgreSQL (Railway 대시보드에서 복사)
DATABASE_URL=postgresql://postgres:PASSWORD@HOST:PORT/railway

# 서버 설정
PORT=3001
NODE_ENV=development
SEED_DIR=../../seed

# ============================================
# Frontend (apps/web/.env.local)
# ============================================

# Backend API URL
# 로컬 개발: http://localhost:3001
# 배포 후: https://lh2-api.up.railway.app
NEXT_PUBLIC_API_URL=http://localhost:3001

# GLB 파일 Base URL
# 로컬 개발: (사용 안 함, public/models/ 에서 직접 로드)
# 배포 후: https://pub-xxx.r2.dev
NEXT_PUBLIC_GLB_BASE_URL=

# GLB 파일명
NEXT_PUBLIC_GLB_TESTBED=h2.glb
```

### 5.3 Railway 설정 순서

```bash
# 1. Railway 가입 및 로그인
# https://railway.app → GitHub 연동 가입

# 2. 프로젝트 생성
railway login
railway init

# 3. PostgreSQL 추가
# Railway 대시보드 → New → Database → PostgreSQL
# → DATABASE_URL 자동 생성됨 (Variables 탭에서 복사)

# 4. Backend 서비스 추가
# Railway 대시보드 → New → GitHub Repo → lh2-digital-twin-poc
# Root Directory: apps/api
# Build Command: npm run build
# Start Command: npm run start

# 5. 환경변수 설정 (Railway 대시보드 Variables 탭)
# DATABASE_URL: (자동 연결)
# PORT: 3001
# NODE_ENV: production
# SEED_DIR: ./seed
```

### 5.4 Vercel 설정 순서

```bash
# 1. Vercel 가입
# https://vercel.com → GitHub 연동

# 2. 프로젝트 Import
# Import Git Repository → lh2-digital-twin-poc
# Root Directory: apps/web
# Framework Preset: Next.js

# 3. 환경변수 설정
# NEXT_PUBLIC_API_URL: https://lh2-api.up.railway.app (Railway 배포 후)
# NEXT_PUBLIC_GLB_BASE_URL: https://pub-xxx.r2.dev (R2 설정 후)
```

### 5.5 Cloudflare R2 설정 순서

```bash
# 1. Cloudflare 가입 → R2 활성화
# https://dash.cloudflare.com → R2

# 2. 버킷 생성
wrangler r2 bucket create lh2-poc-assets

# 3. GLB 업로드
wrangler r2 object put lh2-poc-assets/h2.glb --file=./h2.glb

# 4. Public Access 활성화
# R2 대시보드 → lh2-poc-assets → Settings → Public access → Enable

# 5. CORS 설정
# Allowed Origins: https://lh2-poc.vercel.app, http://localhost:3000
# Allowed Methods: GET, HEAD
```

---

## 6. 개발 착수 전 체크리스트

### 6.1 사전 준비 (로컬 환경)

```
[ ] Node.js 18+ 설치 확인
[ ] Claude Code 설치: npm install -g @anthropic-ai/claude-code
[ ] Git 설치 + GitHub 계정 준비
[ ] GitHub Private Repository 생성
[ ] 프로젝트 폴더 생성 + Git 초기화
[ ] CLAUDE.md → 프로젝트 루트 배치
[ ] FUNC_SPEC_POC_v5.md → docs/ 배치
[ ] CLAUDE_CODE_PROMPTS.md → docs/ 배치
[ ] seed ZIP 해제 → seed/ 폴더 (30개 JSON)
[ ] secondary_pump.glb → public/models/ 배치
[ ] agents/ 폴더 생성 + planner.md, generator.md, evaluator.md, evaluation_criteria.md
[ ] .env.example 작성
[ ] .gitignore 작성
[ ] 초기 커밋 + push
```

### 6.2 인프라 준비

```
[ ] Railway 가입 + 프로젝트 생성
[ ] Railway PostgreSQL 생성 → DATABASE_URL 확보
[ ] Vercel 가입 (배포 단계에서 사용)
[ ] Cloudflare R2 가입 (배포 단계에서 사용)
```

### 6.3 회사 PC 세팅

```
[ ] Node.js 18+ 설치
[ ] Claude Code 설치 (동일 MAX 계정 로그인)
[ ] Git 설치 + GitHub 동일 계정 로그인
[ ] git clone https://github.com/{username}/lh2-digital-twin-poc.git
[ ] npm install (루트 + apps/web + apps/api)
[ ] .env 파일 생성 (DATABASE_URL 등 복사)
[ ] Claude Code 실행 → CLAUDE.md 인식 확인
```

---

## 7. 리스크 및 대응 방안

| 리스크 | 영향도 | 대응 방안 |
|--------|-------|----------|
| Claude Code 토큰 한도 초과 | 높음 | Phase별 분리 실행, 공통 컴포넌트 우선 생성 |
| 3D GLB 렌더링 성능 이슈 | 중간 | Decimate 적용, 이펙트 ON/OFF 토글 |
| Railway 무료 크레딧 소진 | 낮음 | POC 기간 한정 사용, 불필요 시 서비스 중지 |
| 멀티 PC 간 코드 충돌 | 중간 | 작업 전 항상 git pull, 한 번에 한 PC 작업 |
| seed 데이터 스키마 불일치 | 높음 | Evaluator가 seed 적재 검증, upsert 패턴 사용 |
| 회사 네트워크 방화벽 | 중간 | Railway/Vercel 도메인 확인, 필요시 VPN |

---

## 8. 권장 실행 순서 요약

```
1단계: 로컬 환경 세팅
   → Node.js + Claude Code + Git + GitHub Repo
   → 프로젝트 구조 생성 + 문서 배치 + 초기 커밋

2단계: 하네스 에이전트 파일 작성
   → agents/planner.md, generator.md, evaluator.md, evaluation_criteria.md
   → START.md 작성

3단계: Railway PostgreSQL 생성
   → DATABASE_URL 확보 → .env 작성

4단계: Claude Code로 Phase 1 시작
   → P-01 ~ P-06 순서대로 실행
   → Evaluator 검증 통과 후 Phase 2 진행

5단계: Phase 2~6 반복
   → 각 Phase마다 Planner → Generator → Evaluator 루프
   → git commit + push 주기적으로

6단계: 배포
   → Railway Backend + Vercel Frontend + R2 GLB
   → E2E 테스트 (P-19)
```

---

## 부록 A: agents/ 파일 초안

아래는 Claude Code에서 바로 사용할 수 있는 에이전트 지시서 초안입니다. 프로젝트 착수 시 agents/ 폴더에 배치하세요.

### planner.md

```markdown
# Planner 에이전트 지시서

## 역할
너는 LH2 디지털 트윈 POC 프로젝트의 기획팀장이다.
CLAUDE.md와 FUNC_SPEC_POC_v5.md를 숙지하고 있다.

## 작업 방식
1. 사용자가 Phase N 실행을 요청하면:
2. CLAUDE.md의 해당 섹션을 분석하여 구현 태스크를 분해한다
3. 각 태스크에 우선순위, 참조 섹션, 예상 파일, 의존성을 명시한다
4. Generator가 바로 코딩할 수 있는 수준으로 상세화한다
5. 놓칠 수 있는 엣지케이스나 연동 포인트를 미리 식별한다

## 출력 형식
### Phase N 구현 계획서
- 태스크 ID: T-{phase}-{number}
- 태스크명:
- 참조: CLAUDE.md §{섹션번호}
- 의존성: T-{phase}-{number} (선행 태스크)
- 예상 파일: {파일 경로 목록}
- 수락 기준: evaluation_criteria.md의 {항목}
```

### generator.md

```markdown
# Generator 에이전트 지시서

## 역할
너는 LH2 디지털 트윈 POC 프로젝트의 풀스택 개발자다.
Planner의 구현 계획서를 받아 실제 코드를 생성한다.

## 코딩 원칙
1. TypeScript strict mode 사용
2. CLAUDE.md의 기술 명세(타입, API 포맷, 컬러맵 등)를 정확히 따른다
3. 공통 컴포넌트/타입을 먼저 만들고, 모드별 페이지를 점진적으로 추가한다
4. seed JSON 파일 내용은 직접 읽지 않는다. CLAUDE.md의 스키마 정의만 참조한다
5. 3D material은 최초 1회만 clone, 이후 color.set()만 호출한다
6. 각 태스크 완료 시 빌드 에러가 없는 상태를 유지한다

## 에러 처리
- 빌드 에러 발생 시 즉시 수정
- 타입 에러는 any 사용 금지, 올바른 타입 정의
- API 응답 실패 시 적절한 에러 메시지 반환
```

### evaluator.md

```markdown
# Evaluator 에이전트 지시서

## 역할
너는 LH2 디지털 트윈 POC 프로젝트의 QA 엔지니어다.
Generator의 결과물을 evaluation_criteria.md 기준으로 검증한다.

## 검증 절차
1. 빌드 테스트: npm run build 성공 여부
2. API 테스트: curl로 주요 엔드포인트 응답 확인
3. 타입 검증: TypeScript 에러 0건
4. 명세 일치: CLAUDE.md 해당 섹션과 구현 비교
5. 데이터 정합성: seed 적재 후 예상 건수 확인

## 판정
- PASS: 모든 필수 기준 통과 → "Phase N 완료" 선언
- FAIL: 상세 거절 노트 작성
  - 버그: 재현 경로 + 예상 동작 vs 실제 동작
  - 디자인 불일치: CLAUDE.md 섹션 번호 + 차이점
  - 누락: 미구현 기능 ID (FR-xxx-xx)

## 수정 루프
- FAIL 시 Generator에게 거절 노트 전달
- 최대 3회 수정 후에도 FAIL이면 사용자에게 에스컬레이션
```

---

## 부록 B: START.md 초안

```markdown
# LH2 디지털 트윈 POC — 시작 가이드

## 빠른 시작

### 1. 환경 설정
npm install (루트에서)
cd apps/api && npm install
cd apps/web && npm install

### 2. DB 설정
apps/api/.env에 DATABASE_URL 설정
npx prisma migrate dev --name init
npx prisma db seed

### 3. 개발 서버 시작
# 터미널 1: Backend
cd apps/api && npm run dev

# 터미널 2: Frontend
cd apps/web && npm run dev

### 4. 확인
- Backend: http://localhost:3001/api/health
- Frontend: http://localhost:3000

## Claude Code로 개발
claude
> CLAUDE.md를 읽고 Phase 1부터 시작해줘.

## Phase별 프롬프트
docs/CLAUDE_CODE_PROMPTS.md 참고
```
