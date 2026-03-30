// ref: CLAUDE.md §7.7, §12 — 보고서 API + 자동생성
import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const reportRoutes = Router();

// GET /api/reports
reportRoutes.get('/', async (_req, res) => {
  const reports = await prisma.reportDocument.findMany({ orderBy: { created_at: 'desc' } });
  res.json(reports.map(r => ({ ...r, generated_summary: r.generated_summary ? JSON.parse(r.generated_summary) : null })));
});

// GET /api/reports/:id
reportRoutes.get('/:id', async (req, res) => {
  const report = await prisma.reportDocument.findUnique({ where: { report_id: req.params.id } });
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json({ ...report, generated_summary: report.generated_summary ? JSON.parse(report.generated_summary) : null });
});

// POST /api/reports/generate — 자동생성 (CLAUDE.md §12)
reportRoutes.post('/generate', async (req, res) => {
  const { event_id } = req.body;
  if (!event_id) return res.status(400).json({ error: 'event_id required' });

  const event = await prisma.eventLog.findUnique({ where: { event_id } });
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const kogas = await prisma.mockKogasResult.findFirst({ where: { scenario_id: event.scenario_id } });
  const kgs = await prisma.mockKgsResult.findMany({ where: { scenario_id: event.scenario_id } });
  const keti = await prisma.mockKetiResult.findFirst({ where: { scenario_id: event.scenario_id } });
  const safetia = await prisma.mockSafetiaHistory.findMany({ where: { scenario_id: event.scenario_id } });
  const sopExecs = await prisma.sopExecutionLog.findMany({ where: { event_id } });

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
      event_id,
      title: `${event.summary || event.scenario_id} 조치보고서`,
      status: 'DRAFT',
      generated_summary: JSON.stringify(summary),
    },
  });

  res.status(201).json({ ...report, generated_summary: summary });
});

// PUT /api/reports/:id
reportRoutes.put('/:id', async (req, res) => {
  const { manager_comment, title, author_role } = req.body;
  const report = await prisma.reportDocument.update({
    where: { report_id: req.params.id },
    data: { ...(manager_comment !== undefined && { manager_comment }), ...(title && { title }), ...(author_role && { author_role }) },
  });
  res.json(report);
});

// PATCH /api/reports/:id/status
reportRoutes.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['DRAFT', 'SUBMITTED'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const report = await prisma.reportDocument.update({
    where: { report_id: req.params.id },
    data: { status },
  });
  res.json(report);
});
