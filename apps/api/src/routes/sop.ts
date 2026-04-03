// ref: CLAUDE.md §7.6, §11 — SOP API + 추천 로직
import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const sopRoutes = Router();

// Priority 매핑: 한글 문자열 ↔ 정수
const PRIORITY_TO_INT: Record<string, number> = { '심각': 1, '경계': 2, '주의': 3, '관심': 4 };
const INT_TO_PRIORITY: Record<number, string> = { 1: '심각', 2: '경계', 3: '주의', 4: '관심' };

function priorityToInt(val: any): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string' && PRIORITY_TO_INT[val] !== undefined) return PRIORITY_TO_INT[val];
  return 4; // default: 관심
}

function enrichSop(s: any) {
  return {
    ...s,
    steps: typeof s.steps === 'string' ? JSON.parse(s.steps) : s.steps,
    keywords: s.keywords ? (typeof s.keywords === 'string' ? JSON.parse(s.keywords) : s.keywords) : null,
    priority: INT_TO_PRIORITY[s.priority] || '관심',
  };
}

// GET /api/sop
sopRoutes.get('/', async (req, res) => {
  const { category, equipment_id, status } = req.query;
  const where: any = { status: { not: 'DELETED' } };
  if (category) where.sop_category = category;
  if (equipment_id) where.target_equipment_id = equipment_id;
  if (status) where.status = status;
  const sops = await prisma.sopCatalog.findMany({ where });
  res.json(sops.map(enrichSop));
});

// GET /api/sop/trash — 휴지통 목록 (30일 이내 삭제된 SOP)
sopRoutes.get('/trash', async (req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const trashed = await prisma.sopCatalog.findMany({
    where: { status: 'DELETED', deleted_at: { gte: thirtyDaysAgo } },
    orderBy: { deleted_at: 'desc' },
  });
  res.json(trashed.map(s => ({
    ...enrichSop(s),
    deleted_at: s.deleted_at,
    days_remaining: s.deleted_at ? Math.max(0, 30 - Math.floor((Date.now() - new Date(s.deleted_at).getTime()) / 86400000)) : 0,
  })));
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
    return res.json({ primary: fallback ? enrichSop(fallback) : null, all: fallback ? [enrichSop(fallback)] : [] });
  }

  const allSops = maps.map(m => ({
    ...enrichSop(m.sop),
    is_primary: m.is_primary,
  }));

  res.json({ primary: allSops[0], all: allSops });
});

// GET /api/sop/:id
sopRoutes.get('/:id', async (req, res) => {
  const sop = await prisma.sopCatalog.findUnique({ where: { sop_id: req.params.id } });
  if (!sop) return res.status(404).json({ error: 'SOP not found' });
  res.json(enrichSop(sop));
});

// POST /api/sop
sopRoutes.post('/', async (req, res) => {
  try {
    const data = req.body;
    const { steps, keywords, _isNew, priority, ...rest } = data;
    const sop = await prisma.sopCatalog.create({
      data: {
        ...rest,
        priority: priorityToInt(priority),
        steps: JSON.stringify(steps || []),
        keywords: keywords ? JSON.stringify(keywords) : null,
      },
    });
    res.status(201).json(enrichSop(sop));
  } catch (err: any) {
    console.error('SOP create error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sop/:id
sopRoutes.put('/:id', async (req, res) => {
  const { steps, keywords, priority, _isNew, ...rest } = req.body;
  const sop = await prisma.sopCatalog.update({
    where: { sop_id: req.params.id },
    data: {
      ...rest,
      ...(priority !== undefined && { priority: priorityToInt(priority) }),
      ...(steps && { steps: JSON.stringify(steps) }),
      ...(keywords && { keywords: JSON.stringify(keywords) }),
    },
  });
  res.json(enrichSop(sop));
});

// DELETE /api/sop/:id — 소프트 삭제 (휴지통 이동)
sopRoutes.delete('/:id', async (req, res) => {
  try {
    const sop = await prisma.sopCatalog.update({
      where: { sop_id: req.params.id },
      data: { status: 'DELETED', deleted_at: new Date() },
    });
    res.json({ success: true, sop_id: sop.sop_id });
  } catch (err: any) {
    res.status(404).json({ error: 'SOP not found' });
  }
});

// POST /api/sop/:id/restore — 휴지통에서 복원
sopRoutes.post('/:id/restore', async (req, res) => {
  try {
    const sop = await prisma.sopCatalog.update({
      where: { sop_id: req.params.id },
      data: { status: 'ACTIVE', deleted_at: null },
    });
    res.json(enrichSop(sop));
  } catch (err: any) {
    res.status(404).json({ error: 'SOP not found' });
  }
});

// DELETE /api/sop/:id/permanent — 영구 삭제
sopRoutes.delete('/:id/permanent', async (req, res) => {
  try {
    // 관련 equipment_map과 execution은 유지 (참조 무결성)
    await prisma.sopCatalog.delete({ where: { sop_id: req.params.id } });
    res.json({ success: true, permanently_deleted: req.params.id });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
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

