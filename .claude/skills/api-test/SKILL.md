---
name: api-test
description: "Run API endpoint smoke tests against the running backend server. Tests health, equipment, scenarios, providers, emulator, SOP, and reports endpoints. Use after backend changes or seed updates."
allowed-tools: Bash, Read
---

# API 스모크 테스트 스킬

백엔드 서버(localhost:3001)의 주요 API 엔드포인트를 검증합니다.

## 사전 조건
- `apps/api`에서 `npm run dev`로 서버 실행 중
- DB에 seed 데이터 적재 완료

## 테스트 순서

### 1. 기본 엔드포인트
```bash
echo "=== 1. Health Check ==="
curl -sf http://localhost:3001/api/health && echo " ✅" || echo " ❌"

echo "=== 2. Equipment ==="
COUNT=$(curl -sf http://localhost:3001/api/equipment | jq '.length')
echo "  설비 수: $COUNT (기대: 9+)"
[ "$COUNT" -ge 9 ] && echo " ✅" || echo " ❌"

echo "=== 3. Scenarios ==="
COUNT=$(curl -sf http://localhost:3001/api/scenarios | jq '.length')
echo "  시나리오 수: $COUNT (기대: 8)"
[ "$COUNT" -eq 8 ] && echo " ✅" || echo " ❌"

echo "=== 4. Zones ==="
COUNT=$(curl -sf http://localhost:3001/api/zones | jq '.length')
echo "  존 수: $COUNT (기대: 8)"

echo "=== 5. SOP Catalog ==="
COUNT=$(curl -sf http://localhost:3001/api/sop | jq '.length')
echo "  SOP 수: $COUNT (기대: 9)"

echo "=== 6. HAZOP ==="
curl -sf http://localhost:3001/api/hazop/SC-01 | jq '.hazop_id' && echo " ✅" || echo " ❌"
```

### 2. Mock Provider
```bash
echo "=== 7. Provider Health ==="
for p in kogas kgs keti safetia; do
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3001/api/provider/$p/health)
  echo "  $p: $STATUS"
done

echo "=== 8. Provider Data ==="
curl -sf http://localhost:3001/api/provider/kogas/SC-01 | jq '.fault_name' && echo " ✅" || echo " ❌"
curl -sf http://localhost:3001/api/provider/kgs/SC-01 | jq '.[0].impact_score' && echo " ✅" || echo " ❌"
curl -sf http://localhost:3001/api/provider/keti/SC-01 | jq '.simulation_summary' && echo " ✅" || echo " ❌"
curl -sf http://localhost:3001/api/provider/safetia/SC-01 | jq '.[0].equipment_id' && echo " ✅" || echo " ❌"
```

### 3. 에뮬레이터 (선택)
인자에 `--emulator`가 포함되면 에뮬레이터 테스트도 실행:
```bash
echo "=== 9. Emulator ==="
curl -sf -X POST http://localhost:3001/api/emulator/start \
  -H 'Content-Type: application/json' \
  -d '{"scenario_id":"SC-01","speed":60}' && echo " Started ✅"
sleep 2
curl -sf http://localhost:3001/api/emulator/status | jq '{running, phase, elapsed_sec}'
curl -sf -X POST http://localhost:3001/api/emulator/stop && echo " Stopped ✅"
```

## 결과 요약
각 테스트의 ✅/❌ 결과를 집계하여 보고합니다.
