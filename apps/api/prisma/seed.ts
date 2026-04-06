// ref: CLAUDE.md §20.3 — seed.ts 구조
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const SEED_DIR = process.env.SEED_DIR || path.join(__dirname, '../../../seed');

function loadJson<T = any>(filename: string): T[] {
  const filepath = path.join(SEED_DIR, filename);
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

async function main() {
  console.log('🌱 Seeding database...');
  console.log(`📁 Seed directory: ${SEED_DIR}`);

  // 1. Zones
  const zones = loadJson('seed_master_zone.json');
  for (const z of zones) {
    await prisma.zone.upsert({
      where: { zone_id: z.zone_id },
      update: { zone_name: z.zone_name, zone_type: z.zone_type || z.risk_map_color || 'GENERAL' },
      create: { zone_id: z.zone_id, zone_name: z.zone_name, zone_type: z.zone_type || z.risk_map_color || 'GENERAL' },
    });
  }
  console.log(`  ✅ Zones: ${zones.length}`);

  // 2. Equipment
  const equipment = loadJson('seed_master_equipment.json');
  for (const eq of equipment) {
    await prisma.equipmentMaster.upsert({
      where: { equipment_id: eq.equipment_id },
      update: {
        equipment_name: eq.equipment_name,
        equipment_type: eq.equipment_type,
        zone_id: eq.zone_id,
        glb_object_name: eq.glb_object_name,
        is_core: eq.is_core ?? true,
        description: eq.description || null,
      },
      create: {
        equipment_id: eq.equipment_id,
        equipment_name: eq.equipment_name,
        equipment_type: eq.equipment_type,
        zone_id: eq.zone_id,
        glb_object_name: eq.glb_object_name,
        is_core: eq.is_core ?? true,
        description: eq.description || null,
      },
    });
  }
  console.log(`  ✅ Equipment: ${equipment.length}`);

  // 3. Sensors
  const sensors = loadJson('seed_master_sensor.json');
  for (const s of sensors) {
    await prisma.sensorMaster.upsert({
      where: { sensor_id: s.sensor_id },
      update: {
        sensor_name: s.sensor_name,
        sensor_type: s.sensor_type,
        equipment_id: s.equipment_id,
        unit: s.unit,
        enabled: s.enabled ?? true,
        sample_interval_sec: s.sample_interval_sec ?? 5,
      },
      create: {
        sensor_id: s.sensor_id,
        sensor_name: s.sensor_name,
        sensor_type: s.sensor_type,
        equipment_id: s.equipment_id,
        unit: s.unit,
        enabled: s.enabled ?? true,
        sample_interval_sec: s.sample_interval_sec ?? 5,
      },
    });
  }
  console.log(`  ✅ Sensors: ${sensors.length}`);

  // 4. Thresholds
  const thresholds = loadJson('seed_sensor_thresholds.json');
  for (const t of thresholds) {
    await prisma.sensorThreshold.upsert({
      where: { sensor_id: t.sensor_id },
      update: {
        normal_value: t.normal_value,
        warning_low: t.warning_low,
        warning_high: t.warning_high,
        critical_low: t.critical_low,
        critical_high: t.critical_high,
      },
      create: {
        sensor_id: t.sensor_id,
        normal_value: t.normal_value,
        warning_low: t.warning_low,
        warning_high: t.warning_high,
        critical_low: t.critical_low,
        critical_high: t.critical_high,
      },
    });
  }
  console.log(`  ✅ Thresholds: ${thresholds.length}`);

  // 5. Scenarios
  const scenarios = loadJson('seed_mock_scenarios.json');
  for (const sc of scenarios) {
    await prisma.scenarioMaster.upsert({
      where: { scenario_id: sc.scenario_id },
      update: {
        scenario_name: sc.scenario_name,
        trigger_equipment_id: sc.trigger_equipment_id,
        affected_equipment_ids: JSON.stringify(sc.affected_equipment_ids),
        hazop_id: sc.hazop_id || null,
        default_duration_sec: sc.default_duration_sec,
        phases: JSON.stringify(sc.phases),
        sensor_data_file: sc.sensor_data_file || `seed_sensor_timeseries_${sc.scenario_id}.json`,
        playback_speed_options: JSON.stringify(sc.playback_speed_options || [1, 10, 30, 60]),
      },
      create: {
        scenario_id: sc.scenario_id,
        scenario_name: sc.scenario_name,
        trigger_equipment_id: sc.trigger_equipment_id,
        affected_equipment_ids: JSON.stringify(sc.affected_equipment_ids),
        hazop_id: sc.hazop_id || null,
        default_duration_sec: sc.default_duration_sec,
        phases: JSON.stringify(sc.phases),
        sensor_data_file: sc.sensor_data_file || `seed_sensor_timeseries_${sc.scenario_id}.json`,
        playback_speed_options: JSON.stringify(sc.playback_speed_options || [1, 10, 30, 60]),
      },
    });
  }
  console.log(`  ✅ Scenarios: ${scenarios.length}`);

  // 6. HAZOP
  const hazops = loadJson('seed_hazop_lh2.json');
  for (const h of hazops) {
    await prisma.hazopMaster.upsert({
      where: { hazop_id: h.hazop_id },
      update: {
        scenario_id: h.scenario_id,
        equipment_id: h.equipment_id,
        node: h.node,
        process_parameter: h.process_parameter,
        deviation: h.deviation,
        cause: h.cause,
        event_scenario: h.event_scenario,
        hazard_scenario: h.hazard_scenario,
        preventive_action: h.preventive_action,
        emergency_response: h.emergency_response,
        linked_sop_id: h.linked_sop_id || null,
        risk_level: h.risk_level,
        kgs_impact_score: h.kgs_impact_score || null,
      },
      create: {
        hazop_id: h.hazop_id,
        scenario_id: h.scenario_id,
        equipment_id: h.equipment_id,
        node: h.node,
        process_parameter: h.process_parameter,
        deviation: h.deviation,
        cause: h.cause,
        event_scenario: h.event_scenario,
        hazard_scenario: h.hazard_scenario,
        preventive_action: h.preventive_action,
        emergency_response: h.emergency_response,
        linked_sop_id: h.linked_sop_id || null,
        risk_level: h.risk_level,
        kgs_impact_score: h.kgs_impact_score || null,
      },
    });
  }
  console.log(`  ✅ HAZOP: ${hazops.length}`);

  // 7. SOP Catalog
  const sops = loadJson('seed_sop_catalog.json');
  for (const s of sops) {
    await prisma.sopCatalog.upsert({
      where: { sop_id: s.sop_id },
      update: {
        sop_name: s.sop_name,
        sop_category: s.sop_category,
        trigger_type: s.trigger_type,
        target_space_id: s.target_space_id || null,
        target_equipment_id: s.target_equipment_id || null,
        linked_hazop_id: s.linked_hazop_id || null,
        priority: typeof s.priority === 'number' ? s.priority : ({ '심각': 1, '경계': 2, '주의': 3, '관심': 4 }[s.priority as string] || 4),
        camera_preset: s.camera_preset || null,
        popup_template: s.popup_template || null,
        estimated_duration_min: s.estimated_duration_min || null,
        auto_open_popup: s.auto_open_popup ?? false,
        broadcast_action: s.broadcast_action || null,
        steps: JSON.stringify(s.steps || []),
        keywords: s.keywords ? JSON.stringify(s.keywords) : null,
        status: s.status || 'ACTIVE',
      },
      create: {
        sop_id: s.sop_id,
        sop_name: s.sop_name,
        sop_category: s.sop_category,
        trigger_type: s.trigger_type,
        target_space_id: s.target_space_id || null,
        target_equipment_id: s.target_equipment_id || null,
        linked_hazop_id: s.linked_hazop_id || null,
        priority: typeof s.priority === 'number' ? s.priority : ({ '심각': 1, '경계': 2, '주의': 3, '관심': 4 }[s.priority as string] || 4),
        camera_preset: s.camera_preset || null,
        popup_template: s.popup_template || null,
        estimated_duration_min: s.estimated_duration_min || null,
        auto_open_popup: s.auto_open_popup ?? false,
        broadcast_action: s.broadcast_action || null,
        steps: JSON.stringify(s.steps || []),
        keywords: s.keywords ? JSON.stringify(s.keywords) : null,
        status: s.status || 'ACTIVE',
      },
    });
  }
  console.log(`  ✅ SOP Catalog: ${sops.length}`);

  // 8. SOP Equipment Map
  const sopMaps = loadJson('seed_sop_equipment_map.json');
  for (const m of sopMaps) {
    await prisma.sopEquipmentMap.upsert({
      where: { map_id: m.map_id },
      update: {
        space_id: m.space_id,
        equipment_id: m.equipment_id || '',
        match_rule: m.match_rule,
        event_severity_min: m.event_severity_min,
        camera_preset: m.camera_preset || null,
        popup_template: m.popup_template || null,
        is_primary: m.is_primary ?? false,
        sort_order: m.sort_order ?? 0,
      },
      create: {
        map_id: m.map_id,
        space_id: m.space_id,
        equipment_id: m.equipment_id || '',
        match_rule: m.match_rule,
        event_severity_min: m.event_severity_min,
        camera_preset: m.camera_preset || null,
        popup_template: m.popup_template || null,
        is_primary: m.is_primary ?? false,
        sort_order: m.sort_order ?? 0,
        sop: { connect: { sop_id: m.sop_id } },
      },
    });
  }
  console.log(`  ✅ SOP Equipment Map: ${sopMaps.length}`);

  // 9. Event Log
  const events = loadJson('seed_event_log.json');
  for (const e of events) {
    await prisma.eventLog.upsert({
      where: { event_id: e.event_id },
      update: {
        scenario_id: e.scenario_id,
        trigger_equipment_id: e.trigger_equipment_id,
        status: e.status || 'CLOSED',
        severity: e.severity,
        summary: e.summary || null,
        opened_at: new Date(e.opened_at),
        closed_at: e.closed_at ? new Date(e.closed_at) : null,
      },
      create: {
        event_id: e.event_id,
        scenario_id: e.scenario_id,
        trigger_equipment_id: e.trigger_equipment_id,
        status: e.status || 'CLOSED',
        severity: e.severity,
        summary: e.summary || null,
        opened_at: new Date(e.opened_at),
        closed_at: e.closed_at ? new Date(e.closed_at) : null,
      },
    });
  }
  console.log(`  ✅ Events: ${events.length}`);

  // 10. SOP Execution Samples
  const executions = loadJson('seed_sop_execution_samples.json');
  for (const ex of executions) {
    await prisma.sopExecutionLog.upsert({
      where: { execution_id: ex.execution_id },
      update: {
        event_id: ex.event_id,
        scenario_id: ex.scenario_id || null,
        sop_id: ex.sop_id,
        execution_status: ex.execution_status || 'COMPLETED',
        started_at: new Date(ex.started_at),
        ended_at: ex.ended_at ? new Date(ex.ended_at) : null,
        executor_role: ex.executor_role || null,
        checked_steps: ex.checked_steps ? JSON.stringify(ex.checked_steps) : null,
        memo: ex.memo || null,
      },
      create: {
        execution_id: ex.execution_id,
        event_id: ex.event_id,
        scenario_id: ex.scenario_id || null,
        sop_id: ex.sop_id,
        execution_status: ex.execution_status || 'COMPLETED',
        started_at: new Date(ex.started_at),
        ended_at: ex.ended_at ? new Date(ex.ended_at) : null,
        executor_role: ex.executor_role || null,
        checked_steps: ex.checked_steps ? JSON.stringify(ex.checked_steps) : null,
        memo: ex.memo || null,
      },
    });
  }
  console.log(`  ✅ SOP Executions: ${executions.length}`);

  // 11. Reports
  const reports = loadJson('seed_report_samples.json');
  for (const r of reports) {
    await prisma.reportDocument.upsert({
      where: { report_id: r.report_id },
      update: {
        template_id: r.template_id,
        report_type: r.report_type,
        scenario_id: r.scenario_id || null,
        event_id: r.event_id || null,
        title: r.title,
        status: r.status || 'DRAFT',
        author_role: r.author_role || null,
        generated_summary: r.generated_summary ? JSON.stringify(r.generated_summary) : null,
        manager_comment: r.manager_comment || null,
      },
      create: {
        report_id: r.report_id,
        template_id: r.template_id,
        report_type: r.report_type,
        scenario_id: r.scenario_id || null,
        event_id: r.event_id || null,
        title: r.title,
        status: r.status || 'DRAFT',
        author_role: r.author_role || null,
        generated_summary: r.generated_summary ? JSON.stringify(r.generated_summary) : null,
        manager_comment: r.manager_comment || null,
      },
    });
  }
  console.log(`  ✅ Reports: ${reports.length}`);

  // 12. Mock KOGAS
  const kogas = loadJson('seed_mock_kogas_results.json');
  for (const k of kogas) {
    await prisma.mockKogasResult.upsert({
      where: { request_id: k.request_id },
      update: {
        scenario_id: k.scenario_id,
        target_equipment_id: k.target_equipment_id,
        fault_code: k.fault_code || null,
        fault_name: k.fault_name,
        diagnosis_confidence: k.diagnosis_confidence,
        suspected_part: k.suspected_part || null,
        sensor_evidence: k.sensor_evidence ? JSON.stringify(k.sensor_evidence) : null,
      },
      create: {
        request_id: k.request_id,
        scenario_id: k.scenario_id,
        target_equipment_id: k.target_equipment_id,
        fault_code: k.fault_code || null,
        fault_name: k.fault_name,
        diagnosis_confidence: k.diagnosis_confidence,
        suspected_part: k.suspected_part || null,
        sensor_evidence: k.sensor_evidence ? JSON.stringify(k.sensor_evidence) : null,
      },
    });
  }
  console.log(`  ✅ Mock KOGAS: ${kogas.length}`);

  // 13. Mock KGS
  const kgs = loadJson('seed_mock_kgs_results.json');
  for (const k of kgs) {
    await prisma.mockKgsResult.upsert({
      where: { analysis_id: k.analysis_id },
      update: {
        scenario_id: k.scenario_id,
        trigger_equipment_id: k.trigger_equipment_id,
        affected_equipment_id: k.affected_equipment_id,
        impact_type: k.impact_type,
        impact_score: k.impact_score,
        risk_level: k.risk_level,
        predicted_after_sec: k.predicted_after_sec ?? null,
        color_2d: k.color_2d || null,
        color_3d: k.color_3d || null,
        hazop_id: k.hazop_id || null,
        recommended_action: k.recommended_action || null,
      },
      create: {
        analysis_id: k.analysis_id,
        scenario_id: k.scenario_id,
        trigger_equipment_id: k.trigger_equipment_id,
        affected_equipment_id: k.affected_equipment_id,
        impact_type: k.impact_type,
        impact_score: k.impact_score,
        risk_level: k.risk_level,
        predicted_after_sec: k.predicted_after_sec ?? null,
        color_2d: k.color_2d || null,
        color_3d: k.color_3d || null,
        hazop_id: k.hazop_id || null,
        recommended_action: k.recommended_action || null,
      },
    });
  }
  console.log(`  ✅ Mock KGS: ${kgs.length}`);

  // 14. Mock KETI
  const keti = loadJson('seed_mock_keti_results.json');
  for (const k of keti) {
    await prisma.mockKetiResult.upsert({
      where: { simulation_id: k.simulation_id },
      update: {
        scenario_id: k.scenario_id,
        trigger_equipment_id: k.trigger_equipment_id,
        simulation_summary: k.simulation_summary || null,
        recommended_option_a: k.recommended_option_a || null,
        recommended_option_b: k.recommended_option_b || null,
        expected_stabilization_min: k.expected_stabilization_min || null,
        option_a_stabilization_min: k.option_a_stabilization_min || null,
        option_b_stabilization_min: k.option_b_stabilization_min || null,
        option_a_risk: k.option_a_risk || null,
        option_b_risk: k.option_b_risk || null,
        option_a_detail: k.option_a_detail || null,
        option_b_detail: k.option_b_detail || null,
      },
      create: {
        simulation_id: k.simulation_id,
        scenario_id: k.scenario_id,
        trigger_equipment_id: k.trigger_equipment_id,
        simulation_summary: k.simulation_summary || null,
        recommended_option_a: k.recommended_option_a || null,
        recommended_option_b: k.recommended_option_b || null,
        expected_stabilization_min: k.expected_stabilization_min || null,
        option_a_stabilization_min: k.option_a_stabilization_min || null,
        option_b_stabilization_min: k.option_b_stabilization_min || null,
        option_a_risk: k.option_a_risk || null,
        option_b_risk: k.option_b_risk || null,
        option_a_detail: k.option_a_detail || null,
        option_b_detail: k.option_b_detail || null,
      },
    });
  }
  console.log(`  ✅ Mock KETI: ${keti.length}`);

  // 15. Mock Safetia
  const safetia = loadJson('seed_mock_safetia_history.json');
  for (const s of safetia) {
    await prisma.mockSafetiaHistory.upsert({
      where: { history_id: s.history_id },
      update: {
        scenario_id: s.scenario_id,
        equipment_id: s.equipment_id,
        last_maintenance_date: s.last_maintenance_date || null,
        past_incident_summary: s.past_incident_summary || null,
        linked_sop_id: s.linked_sop_id || null,
        operator_note: s.operator_note || null,
      },
      create: {
        history_id: s.history_id,
        scenario_id: s.scenario_id,
        equipment_id: s.equipment_id,
        last_maintenance_date: s.last_maintenance_date || null,
        past_incident_summary: s.past_incident_summary || null,
        linked_sop_id: s.linked_sop_id || null,
        operator_note: s.operator_note || null,
      },
    });
  }
  console.log(`  ✅ Mock Safetia: ${safetia.length}`);

  // 16. Settings
  const settings = loadJson('seed_settings_metadata.json');
  for (const s of settings) {
    await prisma.settingsMetadata.upsert({
      where: { setting_key: s.setting_key },
      update: {
        setting_group: s.setting_group,
        setting_value: String(s.setting_value),
        value_type: s.value_type,
        description: s.description || null,
      },
      create: {
        setting_group: s.setting_group,
        setting_key: s.setting_key,
        setting_value: String(s.setting_value),
        value_type: s.value_type,
        description: s.description || null,
      },
    });
  }
  console.log(`  ✅ Settings: ${settings.length}`);

  console.log('\n🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
