// ref: CLAUDE.md §7.2 — 설비/센서/존 API
import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const equipmentRoutes = Router();

// GET /api/zones
equipmentRoutes.get('/zones', async (_req, res) => {
  const zones = await prisma.zone.findMany({ include: { equipment: true } });
  res.json(zones);
});

// GET /api/equipment
equipmentRoutes.get('/', async (_req, res) => {
  const equipment = await prisma.equipmentMaster.findMany({ include: { sensors: true } });
  res.json(equipment);
});

// GET /api/equipment/:id
equipmentRoutes.get('/:id', async (req, res) => {
  const eq = await prisma.equipmentMaster.findUnique({
    where: { equipment_id: req.params.id },
    include: { sensors: { include: { threshold: true } }, zone: true },
  });
  if (!eq) return res.status(404).json({ error: 'Equipment not found' });
  res.json(eq);
});

// GET /api/equipment/:id/sensors
equipmentRoutes.get('/:id/sensors', async (req, res) => {
  const sensors = await prisma.sensorMaster.findMany({
    where: { equipment_id: req.params.id },
    include: { threshold: true },
  });
  res.json(sensors);
});
