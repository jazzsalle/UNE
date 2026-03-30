---
name: phase-run
description: "Orchestrate a full Phase implementation cycle: Plan → Generate → Evaluate. Use when user says 'Phase N 시작' or 'Phase N 실행'. Coordinates the planner, generator, and evaluator subagents in sequence."
---

# Phase 실행 오케스트레이터

Phase $ARGUMENTS 구현을 3단계 파이프라인으로 실행합니다.

## 실행 순서

### Step 1: 기획 (Planner)
@planner 에이전트를 호출하여 Phase $ARGUMENTS 구현 계획서를 생성합니다.
- CLAUDE.md의 해당 Phase 섹션을 분석
- 태스크를 분해하고 우선순위/의존성 지정
- Generator가 즉시 코딩 가능한 수준으로 상세화

### Step 2: 구현 (Generator)
@generator 에이전트를 호출하여 계획서의 태스크를 순서대로 코드로 구현합니다.
- 각 태스크 완료 시 빌드 에러 0건 상태 유지
- CLAUDE.md 명세를 정확히 따름
- 공통 컴포넌트/타입 우선 생성

### Step 3: 검증 (Evaluator)
@evaluator 에이전트를 호출하여 결과물을 검증합니다.
- evaluation_criteria.md 기준 채점
- PASS → "Phase $ARGUMENTS 완료" 선언
- FAIL → 거절 노트 작성 → Generator 수정 루프 (최대 3회)

## 완료 조건
- Evaluator가 PASS 판정하면 Phase $ARGUMENTS 완료
- Git 커밋 메시지: `feat(phase$ARGUMENTS): Phase $ARGUMENTS 완료 - [주요 산출물 요약]`

## 주의사항
- 이전 Phase가 완료되지 않았으면 먼저 완료 확인
- Phase 1은 선행 조건 없음
- Phase 2는 Phase 1의 API/DB가 정상 동작해야 시작 가능
- 각 단계 사이에 진행 상황을 사용자에게 보고
