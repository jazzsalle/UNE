---
name: seed-validate
description: "Validate seed JSON files in the /seed directory against CLAUDE.md schema definitions. Checks file count, required fields, referential integrity between files, and data consistency."
allowed-tools: Bash, Read, Grep, Glob
---

# Seed 데이터 검증 스킬

`/seed` 디렉토리의 JSON 파일들이 CLAUDE.md 스키마 정의와 일치하는지 검증합니다.

## 검증 항목

### 1. 파일 존재 확인 (30개)
```bash
echo "=== Seed 파일 수 ==="
ls seed/*.json | wc -l  # 기대: 30
```

### 2. 필수 파일 목록
- seed_manifest.json
- seed_master_zone.json (8건)
- seed_master_equipment.json (9건)
- seed_master_sensor.json (34건)
- seed_sensor_thresholds.json (34건)
- seed_mock_scenarios.json (8건)
- seed_hazop_lh2.json (8건)
- seed_sop_catalog.json (9건)
- seed_sop_equipment_map.json (18건)
- seed_sensor_timeseries_SC-01~SC-08.json (8파일)

### 3. 참조 무결성 검증
- equipment의 zone_id → zone 존재 확인
- sensor의 equipment_id → equipment 존재 확인
- scenario의 trigger_equipment_id → equipment 존재 확인
- hazop의 equipment_id, scenario_id → 각각 존재 확인
- sop_equipment_map의 sop_id, equipment_id → 각각 존재 확인
- mock_kgs_results의 scenario_id → scenario 존재 확인

### 4. 필드 타입 검증
각 seed 파일의 레코드가 CLAUDE.md §8.1 Prisma 모델의 필수 필드를 포함하는지 확인.

## 결과 보고
- 전체 PASS: "✅ Seed 데이터 검증 완료 — 30파일, 참조무결성 정상"
- 일부 FAIL: 실패 항목 목록 + 수정 가이드
