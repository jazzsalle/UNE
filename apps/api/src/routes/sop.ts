// ref: CLAUDE.md §7.6, §11 — SOP API + 추천 로직
import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const sopRoutes = Router();

// GET /api/sop
sopRoutes.get('/', async (req, res) => {
  const { category, equipment_id, status } = req.query;
  const where: any = {};
  if (category) where.sop_category = category;
  if (equipment_id) where.target_equipment_id = equipment_id;
  if (status) where.status = status;
  const sops = await prisma.sopCatalog.findMany({ where });
  res.json(sops.map(s => ({ ...s, steps: JSON.parse(s.steps), keywords: s.keywords ? JSON.parse(s.keywords) : null })));
});

// GET /api/sop/executions (MUST be before /:id to avoid being caught by :id param)
sopRoutes.get('/executions', async (req, res) => {
  const { event_id, scenario_id } = req.query;
  const where: any = {};
  if (event_id) where.event_id = event_id;
  if (scenario_id) where.scenario_id = scenario_id;
  const executions = await prisma.sopExecutionLog.findMany({ where, include: { sop: true }, orderBy: { started_at: 'desc' } });
  res.json(executions);
});

// GET /api/sop/recommend
sopRoutes.get('/recommend', async (req, res) => {
  const { event_id, equipment_id, severity } = req.query;

  let triggerEquipmentId = equipment_id as string;
  let eventSeverity = severity as string || 'WARNING';

  if (event_id) {
    const event = await prisma.eventLog.findUnique({ where: { event_id: event_id as string } });
    if (event) {
      triggerEquipmentId = event.trigger_equipment_id;
      eventSeverity = event.severity;
    }
  }

  if (!triggerEquipmentId) return res.status(400).json({ error: 'equipment_id or event_id required' });

  const equipment = await prisma.equipmentMaster.findUnique({ where: { equipment_id: triggerEquipmentId } });
  const zoneId = equipment?.zone_id;

  // SOP 추천: equipment_id 매치 → zone_id 매치 → fallback
  const maps = await prisma.sopEquipmentMap.findMany({
    where: {
      OR: [
        { equipment_id: triggerEquipmentId },
        ...(zoneId ? [{ space_id: zoneId }] : []),
      ],
    },
    include: { sop: true },
    orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
  });

  if (maps.length === 0) {
    const fallback = await prisma.sopCatalog.findUnique({ where: { sop_id: 'SOP-GENERIC-INSPECT-01' } });
    return res.json({ primary: fallback, all: fallback ? [fallback] : [] });
  }

  const allSops = maps.map(m => ({
    ...m.sop,
    steps: JSON.parse(m.sop.steps),
    keywords: m.sop.keywords ? JSON.parse(m.sop.keywords) : null,
    is_primary: m.is_primary,
  }));

  res.json({ primary: allSops[0], all: allSops });
});

// GET /api/sop/:id
sopRoutes.get('/:id', async (req, res) => {
  const sop = await prisma.sopCatalog.findUnique({ where: { sop_id: req.params.id } });
  if (!sop) return res.status(404).json({ error: 'SOP not found' });
  res.json({ ...sop, steps: JSON.parse(sop.steps), keywords: sop.keywords ? JSON.parse(sop.keywords) : null });
});

// POST /api/sop
sopRoutes.post('/', async (req, res) => {
  const data = req.body;
  const sop = await prisma.sopCatalog.create({
    data: { ...data, steps: JSON.stringify(data.steps || []), keywords: data.keywords ? JSON.stringify(data.keywords) : null },
  });
  res.status(201).json(sop);
});

// PUT /api/sop/:id
sopRoutes.put('/:id', async (req, res) => {
  const data = req.body;
  const sop = await prisma.sopCatalog.update({
    where: { sop_id: req.params.id },
    data: {
      ...data,
      ...(data.steps && { steps: JSON.stringify(data.steps) }),
      ...(data.keywords && { keywords: JSON.stringify(data.keywords) }),
    },
  });
  res.json(sop);
});

// POST /api/sop/:id/execute
sopRoutes.post('/:id/execute', async (req, res) => {
  const { event_id, scenario_id, executor_role } = req.body;
  if (!event_id) return res.status(400).json({ error: 'event_id required' });
  const execution = await prisma.sopExecutionLog.create({
    data: { sop_id: req.params.id, event_id, scenario_id, executor_role },
  });
  res.status(201).json(execution);
});

// PUT /api/sop/execution/:exec_id
sopRoutes.put('/execution/:exec_id', async (req, res) => {
  const { checked_steps, memo } = req.body;
  const execution = await prisma.sopExecutionLog.update({
    where: { execution_id: req.params.exec_id },
    data: {
      ...(checked_steps && { checked_steps: JSON.stringify(checked_steps) }),
      ...(memo !== undefined && { memo }),
    },
  });
  res.json(execution);
});

// POST /api/sop/execution/:exec_id/complete
sopRoutes.post('/execution/:exec_id/complete', async (req, res) => {
  const execution = await prisma.sopExecutionLog.update({
    where: { execution_id: req.params.exec_id },
    data: { execution_status: 'COMPLETED', ended_at: new Date() },
  });
  res.json(execution);
});

// POST /api/sop/execution/:exec_id/broadcast
sopRoutes.post('/execution/:exec_id/broadcast', async (req, res) => {
  res.json({ status: 'broadcast_logged', execution_id: req.params.exec_id });
});

