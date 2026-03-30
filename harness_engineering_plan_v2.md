# LH2 디지털 트윈 POC — 하네스 엔지니어링 & 개발 착수 계획서 (v2)

> 작성일: 2026-03-30
> 대상: Claude Code (MAX 계정) 기반 멀티에이전트 개발 체계
> 목적: 클로드 코드 착수 전 전략 수립 + Git 워크플로우 + 환경변수/인프라 준비
> 변경: v2 — Claude Code 공식 subagent/skills/hooks 체계로 전면 재설계

---

## 1. 하네스 엔지니어링 v2 개요

### 1.1 v1 → v2 변경 사항

| 항목 | v1 (agents/ 폴더) | v2 (Claude Code 공식 체계) |
|------|------------------|------------------------|
| 에이전트 위치 | `agents/*.md` (자체 규약) | `.claude/agents/*.md` (YAML frontmatter) |
| 호출 방식 | 수동 프롬프트로 역할 전환 | Claude가 자동 위임 또는 `@agent` 명시 호출 |
| 스킬 | 없음 | `.claude/skills/*/SKILL.md` → `/phase-run`, `/build-check` 등 |
| 자동화 | 없음 | `.claude/settings.json` hooks — 파일 저장 시 알림, 빌드 체크 |
| 도구 제한 | 없음 | 에이전트별 `tools` 필드로 허용 도구 제한 |
| 메모리 | 없음 | subagent `memory` 필드로 세션 간 학습 축적 가능 |

### 1.2 3단계 생산 라인 (Claude Code 네이티브)

```
┌─────────────────────────────────────────────────────────────────┐
│              협업 워크플로우: Claude Code 네이티브 파이프라인            │
├──────────────┬──────────────────┬───────────────────────────────┤
│  Station 1   │   Station 2      │   Station 3                   │
│  @planner    │   @generator     │   @evaluator                  │
│              │                  │                               │
│  CLAUDE.md + │   태스크 목록 수신  │   빌드/API/명세 검증             │
│  FUNC_SPEC   │   → 코드 생성     │   → PASS/FAIL 판정            │
│  분석 → 태스크│   → 빌드 확인     │   → FAIL 시 거절 노트           │
│  분해 + 계획서│                  │   → Generator 수정 루프         │
│              │                  │   (최대 3회)                    │
│  [Subagent]  │   [Subagent]     │   [Subagent]                  │
│  Read-only   │   Full access    │   Read + Bash only            │
└──────────────┴──────────────────┴───────────────────────────────┘

오케스트레이션: /phase-run N → Planner → Generator → Evaluator 자동 순환
```

### 1.3 Claude Code 기능 활용 매핑

| Claude Code 기능 | 프로젝트 활용 |
|-----------------|------------|
| **Custom Subagents** (`.claude/agents/`) | planner, generator, evaluator 3개 에이전트 |
| **Skills** (`.claude/skills/`) | `/phase-run`, `/build-check`, `/api-test`, `/seed-validate` |
| **Hooks** (`.claude/settings.json`) | PostToolUse: TS 파일 수정 시 빌드 체크 알림 |
| **Built-in Explore** | 코드베이스 스캔 시 자동 위임 (planner가 활용) |
| **Built-in Plan** | Phase 계획 수립 시 자동 활용 |
| **CLAUDE.md** | 프로젝트 루트에 배치 → Claude Code 자동 인식 |
| **Permissions** | 에이전트별 도구 제한 (evaluator는 Write 금지) |

---

## 2. 프로젝트 디렉토리 구조

```
lh2-digital-twin-poc/
├── CLAUDE.md                              ← 오케스트레이터 (Claude Code 자동 인식)
├── evaluation_criteria.md                 ← 공용 채점 기준
├── .claude/
│   ├── settings.json                      ← hooks + permissions
│   ├── agents/                            ← 커스텀 서브에이전트
│   │   ├── planner.md                     ← 기획팀장 (Read-only)
│   │   ├── generator.md                   ← 풀스택 개발자 (Full access)
│   │   └── evaluator.md                   ← QA 엔지니어 (Read + Bash)
│   └── skills/                            ← 커스텀 스킬 (슬래시 커맨드)
│       ├── phase-run/SKILL.md             ← /phase-run N → 3단계 파이프라인
│       ├── build-check/SKILL.md           ← /build-check → 빌드 검증
│       ├── api-test/SKILL.md              ← /api-test → API 스모크 테스트
│       └── seed-validate/SKILL.md         ← /seed-validate → seed 검증
├── docs/
│   ├── FUNC_SPEC_POC_v5.md               ← 기능명세서 (PRD)
│   └── CLAUDE_CODE_PROMPTS.md            ← 단계별 프롬프트 가이드
├── seed/                                  ← seed JSON 파일 (ZIP 해제, 30개)
├── apps/
│   ├── web/                               ← Next.js Frontend
│   └── api/                               ← Express Backend
├── public/models/                         ← secondary_pump.glb (210KB)
├── .env.example
├── .gitignore
├── package.json
└── START.md                               ← 실행 방법 안내
```

---

## 3. 실행 워크플로우

### 3.1 Phase별 실행 (권장: /phase-run 스킬)

```bash
# Claude Code 시작
claude

# Phase 1 실행 (자동 파이프라인)
> /phase-run 1

# 또는 수동 에이전트 지정
> @planner Phase 1의 구현 계획을 수립해줘
> @generator 위 계획에 따라 코드를 생성해줘
> @evaluator 결과물을 검증해줘
```

### 3.2 빠른 검증 (개별 스킬)

```bash
# 빌드만 체크
> /build-check

# API 엔드포인트 테스트
> /api-test

# seed 데이터 검증
> /seed-validate
```

### 3.3 수동 프롬프트 (CLAUDE_CODE_PROMPTS.md 연동)

```bash
# P-01~P-20 프롬프트를 순서대로 입력
# 각 프롬프트 실행 → 결과 확인 → 다음 프롬프트
> @CLAUDE.md 를 참고하여 P-01을 실행해줘
```

### 3.4 Phase-에이전트-프롬프트 매핑

| Phase | Planner 참조 | Generator 프롬프트 | Evaluator 검증 |
|-------|-------------|-------------------|---------------|
| 1: 기반구조 | CLAUDE.md §2,7,8,17,20 | P-01~P-06 | API health + seed 적재 + SSE |
| 2: 모니터링+3D | CLAUDE.md §3,4,5,9.1,9.2,13 | P-07~P-11 | GNB + 3D + 공정흐름 + KPI |
| 3: 이상탐지+위험예측 | CLAUDE.md §9.3,9.4,11 | P-12~P-13 | M-ANO + M-RSK + 2D/3D 연동 |
| 4: SOP+시뮬레이션 | CLAUDE.md §3.3,9.5,9.8,11 | P-14~P-15 | M-SOP + M-SIM + SOP추천 |
| 5: 보조기능 | CLAUDE.md §9.6,9.7,9.9,12 | P-16~P-17 | P-RPT + P-SET + M-HIS |
| 6: 이펙트+통합 | CLAUDE.md §5.7,15,19,21,22 | P-18~P-20 | E2E SC-01 시나리오 |

---

## 4. Git 워크플로우

### 4.1 저장소 초기화

```bash
cd lh2-digital-twin-poc
git init
git remote add origin https://github.com/{your-username}/lh2-digital-twin-poc.git

# .claude/ 디렉토리 포함하여 초기 커밋
git add .
git commit -m "init: 프로젝트 구조 + CLAUDE.md + .claude/ 에이전트/스킬 + seed"
git push -u origin main
```

### 4.2 .gitignore

```gitignore
# 환경변수
.env
.env.local
.env.production

# 의존성
node_modules/
.next/
dist/

# GLB 대용량 (R2 관리)
*.glb
!public/models/secondary_pump.glb

# Prisma
prisma/migrations/**/migration_lock.toml

# OS/IDE
.DS_Store
Thumbs.db
.vscode/settings.json
.idea/

# 빌드 결과물
output/

# Claude Code 로컬 설정 (개인별)
.claude/settings.local.json
```

### 4.3 브랜치 전략

```bash
# Phase별 브랜치 (권장)
git checkout -b phase/1-foundation
# ... Phase 1 작업 ...
git checkout main && git merge phase/1-foundation

git checkout -b phase/2-monitoring-3d
# ... Phase 2 작업 ...
```

### 4.4 커밋 컨벤션

```
feat(phase1): Prisma schema + seed loader + API stubs
feat(phase2): GNB + 3D viewer + process flow navigator
fix(phase2): COLOR_MAP 상수 오타 수정
refactor(phase3): M-RSK react-flow 노드 레이아웃 개선
test(phase1): API 스모크 테스트 추가
```

---

## 5. 환경변수 & 인프라

### 5.1 .env.example

```bash
# ============================================
# Backend (apps/api/.env)
# ============================================
DATABASE_URL=postgresql://postgres:PASSWORD@HOST:PORT/railway
PORT=3001
NODE_ENV=development
SEED_DIR=../../seed

# ============================================
# Frontend (apps/web/.env.local)
# ============================================
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_GLB_BASE_URL=
NEXT_PUBLIC_GLB_TESTBED=h2.glb
```

### 5.2 인프라 목록

| 서비스 | 용도 | 비용 |
|--------|------|------|
| GitHub | Private Repo | 무료 |
| Railway | Backend + PostgreSQL | $5~15/월 |
| Vercel | Frontend 배포 | 무료~$20/월 |
| Cloudflare R2 | GLB 파일 CDN | 무료 (10GB) |

---

## 6. 개발 착수 전 체크리스트

### 6.1 로컬 환경

```
[ ] Node.js 18+ 설치 확인
[ ] Claude Code 설치: npm install -g @anthropic-ai/claude-code
[ ] Git + GitHub Private Repo 준비
[ ] 프로젝트 폴더 생성 + 아래 파일 배치:
    [ ] CLAUDE.md → 프로젝트 루트
    [ ] evaluation_criteria.md → 프로젝트 루트
    [ ] .claude/agents/*.md → 3개 에이전트
    [ ] .claude/skills/*/SKILL.md → 4개 스킬
    [ ] .claude/settings.json → hooks/permissions
    [ ] docs/FUNC_SPEC_POC_v5.md
    [ ] docs/CLAUDE_CODE_PROMPTS.md
    [ ] seed/ → ZIP 해제 (30개 JSON)
    [ ] public/models/secondary_pump.glb
    [ ] .env.example → 복사 후 .env 생성
    [ ] .gitignore
    [ ] START.md
[ ] 초기 커밋 + push
```

### 6.2 Claude Code 동작 확인

```bash
# Claude Code 시작
cd lh2-digital-twin-poc
claude

# CLAUDE.md 인식 확인
> 이 프로젝트의 기술스택은?
# → Next.js 14, Express, Prisma, Three.js 등 답변 확인

# 에이전트 목록 확인
> claude agents
# → planner, generator, evaluator 3개 표시

# 스킬 확인
> /build-check
# → (아직 코드 없으므로 에러가 나도 스킬 자체가 동작하면 OK)
```

### 6.3 인프라 준비 (배포 단계에서)

```
[ ] Railway 가입 + PostgreSQL 생성 → DATABASE_URL 확보
[ ] Vercel 가입 (배포 시)
[ ] Cloudflare R2 가입 (배포 시)
```

---

## 7. 리스크 및 대응

| 리스크 | 영향도 | 대응 |
|--------|-------|------|
| 토큰 한도 초과 | 높음 | Phase별 분리, /compact 적극 사용, subagent 활용 |
| 3D 성능 이슈 | 중간 | Decimate, 이펙트 ON/OFF, 성능 계층화 (§22) |
| seed 스키마 불일치 | 높음 | /seed-validate 스킬, upsert 패턴 |
| 멀티 PC 충돌 | 중간 | 작업 전 git pull, 한 번에 한 PC 작업 |
| 에이전트 루프 | 중간 | Evaluator 최대 3회 수정 후 에스컬레이션 |

---

## 8. 권장 실행 순서

```
1단계: 환경 세팅
   → Node.js + Claude Code + Git + GitHub Repo
   → .claude/ 구조 + 문서 + seed 배치 + 초기 커밋

2단계: Claude Code 시작 + 확인
   → claude 실행 → CLAUDE.md 인식 확인
   → claude agents → 3개 에이전트 확인
   → /build-check → 스킬 동작 확인

3단계: Phase 1 실행
   → /phase-run 1 (또는 P-01~P-06 수동)
   → Evaluator PASS 후 git commit + push

4단계: Phase 2~6 반복
   → 각 Phase마다 /phase-run N
   → 또는 P-07~P-20 수동 프롬프트
   → git commit + push 주기적으로

5단계: 배포
   → Railway Backend + Vercel Frontend + R2 GLB
   → E2E 테스트 (/api-test + SC-01 시나리오)
```
