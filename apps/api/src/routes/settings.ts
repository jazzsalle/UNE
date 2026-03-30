// ref: CLAUDE.md §7.8 — 설정 API
import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const settingRoutes = Router();

// GET /api/settings
settingRoutes.get('/', async (_req, res) => {
  const settings = await prisma.settingsMetadata.findMany();
  res.json(settings);
});

// PUT /api/settings/:id
settingRoutes.put('/:id', async (req, res) => {
  const { setting_value } = req.body;
  const setting = await prisma.settingsMetadata.update({
    where: { setting_id: req.params.id },
    data: { setting_value: String(setting_value) },
  });
  res.json(setting);
});

// GET /api/thresholds
settingRoutes.get('/thresholds', async (req, res) => {
  const { equipment_id } = req.query;
  if (equipment_id) {
    const sensors = await prisma.sensorMaster.findMany({
      where: { equipment_id: equipment_id as string },
      include: { threshold: true },
    });
    return res.json(sensors.map(s => s.threshold).filter(Boolean));
  }
  const thresholds = await prisma.sensorThreshold.findMany();
  res.json(thresholds);
});

// PUT /api/thresholds/:sensor_id
settingRoutes.put('/thresholds/:sensor_id', async (req, res) => {
  const data = req.body;
  const threshold = await prisma.sensorThreshold.update({
    where: { sensor_id: req.params.sensor_id },
    data,
  });
  res.json(threshold);
});

// GET /api/sensor-meta
settingRoutes.get('/sensor-meta', async (_req, res) => {
  const sensors = await prisma.sensorMaster.findMany({ include: { threshold: true } });
  res.json(sensors);
});

// PUT /api/sensor-meta/:sensor_id
settingRoutes.put('/sensor-meta/:sensor_id', async (req, res) => {
  const { enabled, sample_interval_sec } = req.body;
  const sensor = await prisma.sensorMaster.update({
    where: { sensor_id: req.params.sensor_id },
    data: { ...(enabled !== undefined && { enabled }), ...(sample_interval_sec && { sample_interval_sec }) },
  });
  res.json(sensor);
});
