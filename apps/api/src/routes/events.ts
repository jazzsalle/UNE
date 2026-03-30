// ref: CLAUDE.md §7.3 — 이벤트/알람 API
import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const eventRoutes = Router();

// GET /api/events
eventRoutes.get('/', async (req, res) => {
  const { status, severity, scenario_id } = req.query;
  const where: any = {};
  if (status) where.status = status;
  if (severity) where.severity = severity;
  if (scenario_id) where.scenario_id = scenario_id;
  const events = await prisma.eventLog.findMany({ where, orderBy: { opened_at: 'desc' } });
  res.json(events);
});

// GET /api/events/:id
eventRoutes.get('/:id', async (req, res) => {
  const event = await prisma.eventLog.findUnique({
    where: { event_id: req.params.id },
    include: { sop_executions: true, reports: true },
  });
  if (!event) return res.status(404).json({ error: 'Event not found' });

  // Enrich with mock provider data
  const kogas = await prisma.mockKogasResult.findFirst({ where: { scenario_id: event.scenario_id } });
  const kgs = await prisma.mockKgsResult.findMany({ where: { scenario_id: event.scenario_id } });
  const keti = await prisma.mockKetiResult.findFirst({ where: { scenario_id: event.scenario_id } });
  const safetia = await prisma.mockSafetiaHistory.findMany({ where: { scenario_id: event.scenario_id } });

  res.json({ ...event, kogas_result: kogas, kgs_results: kgs, keti_result: keti, safetia_history: safetia });
});

// PATCH /api/events/:id
eventRoutes.patch('/:id', async (req, res) => {
  const { status, severity, summary } = req.body;
  const updated = await prisma.eventLog.update({
    where: { event_id: req.params.id },
    data: {
      ...(status && { status }),
      ...(severity && { severity }),
      ...(summary && { summary }),
      ...(status === 'CLOSED' && { closed_at: new Date() }),
    },
  });
  res.json(updated);
});

// SSE: GET /api/events/stream (placeholder - emulator handles this)
eventRoutes.get('/stream', (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write('data: {"type":"CONNECTED"}\n\n');
});
