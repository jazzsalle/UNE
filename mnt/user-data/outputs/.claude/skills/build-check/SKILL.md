---
name: build-check
description: "Quick build and type check for both frontend and backend. Use when you need to verify the project compiles without errors after making changes."
allowed-tools: Bash, Read, Grep
---

# 빌드 검증 스킬

프로젝트의 빌드 상태를 빠르게 검증합니다.

## 실행 순서

1. **Backend TypeScript 체크**
```bash
cd apps/api && npx tsc --noEmit 2>&1
```

2. **Frontend TypeScript 체크**
```bash
cd apps/web && npx tsc --noEmit 2>&1
```

3. **Backend 빌드**
```bash
cd apps/api && npm run build 2>&1
```

4. **Frontend 빌드**
```bash
cd apps/web && npm run build 2>&1
```

## 결과 보고
- 에러 0건이면: "✅ 빌드 성공 — Backend/Frontend 모두 정상"
- 에러 있으면: 에러 목록을 파일별로 정리하여 보고
