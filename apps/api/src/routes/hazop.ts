// ref: CLAUDE.md §7.5 — HAZOP API
import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const hazopRoutes = Router();

hazopRoutes.get('/', async (_req, res) => {
  const hazops = await prisma.hazopMaster.findMany();
  res.json(hazops);
});

hazopRoutes.get('/:scenario_id', async (req, res) => {
  const hazop = await prisma.hazopMaster.findFirst({ where: { scenario_id: req.params.scenario_id } });
  if (!hazop) return res.status(404).json({ error: 'HAZOP not found' });
  res.json(hazop);
});
