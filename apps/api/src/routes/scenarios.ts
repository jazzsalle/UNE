// ref: CLAUDE.md §7.1 — 시나리오 API
import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const scenarioRoutes = Router();

scenarioRoutes.get('/', async (_req, res) => {
  const scenarios = await prisma.scenarioMaster.findMany();
  res.json(scenarios.map(s => ({
    ...s,
    affected_equipment_ids: JSON.parse(s.affected_equipment_ids),
    phases: JSON.parse(s.phases),
    playback_speed_options: JSON.parse(s.playback_speed_options),
  })));
});

scenarioRoutes.get('/:id', async (req, res) => {
  const scenario = await prisma.scenarioMaster.findUnique({ where: { scenario_id: req.params.id } });
  if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
  res.json({
    ...scenario,
    affected_equipment_ids: JSON.parse(scenario.affected_equipment_ids),
    phases: JSON.parse(scenario.phases),
    playback_speed_options: JSON.parse(scenario.playback_speed_options),
  });
});
