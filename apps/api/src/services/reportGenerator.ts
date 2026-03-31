// ref: CLAUDE.md §12 — 보고서 자동생성 서비스
import { PrismaClient } from '@prisma/client';

export async function generateReport(eventId: string, prisma: PrismaClient) {
  const event = await prisma.eventLog.findUnique({ where: { event_id: eventId } });
  if (!event) throw new Error(`Event not found: ${eventId}`);

  const [kogas, kgs, keti, safetia, sopExecs] = await Promise.all([
    prisma.mockKogasResult.findFirst({ where: { scenario_id: event.scenario_id } }),
    prisma.mockKgsResult.findMany({ where: { scenario_id: event.scenario_id } }),
    prisma.mockKetiResult.findFirst({ where: { scenario_id: event.scenario_id } }),
    prisma.mockSafetiaHistory.findMany({ where: { scenario_id: event.scenario_id } }),
    prisma.sopExecutionLog.findMany({ where: { event_id: eventId } }),
  ]);

  const summary = {
    event: { event_id: event.event_id, scenario_id: event.scenario_id, severity: event.severity, summary: event.summary },
    kogas_diagnosis: kogas ? { fault_name: kogas.fault_name, confidence: kogas.diagnosis_confidence, suspected_part: kogas.suspected_part } : null,
    kgs_impact: kgs.map(k => ({ affected: k.affected_equipment_id, score: k.impact_score, risk: k.risk_level })),
    keti_recommendation: keti ? { option_a: keti.recommended_option_a, option_b: keti.recommended_option_b } : null,
    safetia_history: safetia.map(s => ({ equipment: s.equipment_id, incident: s.past_incident_summary })),
    sop_executions: sopExecs.map(e => ({ sop_id: e.sop_id, status: e.execution_status })),
  };

  const report = await prisma.reportDocument.create({
    data: {
      template_id: 'RPT-TPL-001',
      report_type: 'EVENT_ACTION',
      scenario_id: event.scenario_id,
      event_id: eventId,
      title: `${event.summary || event.scenario_id} 조치보고서`,
      status: 'DRAFT',
      generated_summary: JSON.stringify(summary),
    },
  });

  return { ...report, generated_summary: summary };
}
