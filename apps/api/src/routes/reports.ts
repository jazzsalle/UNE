// ref: CLAUDE.md §7.7, §12 — 보고서 API + 자동생성
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { generateReport } from '../services/reportGenerator';

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
  try {
    const report = await generateReport(event_id, prisma);
    res.status(201).json(report);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
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
