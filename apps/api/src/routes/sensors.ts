// ref: CLAUDE.md §7.2 — 센서 시계열 API
import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';

export const sensorRoutes = Router();

const SEED_DIR = process.env.SEED_DIR || path.join(__dirname, '../../../../seed');

// GET /api/sensors/:id/timeseries
sensorRoutes.get('/:id/timeseries', (req, res) => {
  const { scenario_id, from, to } = req.query;
  if (!scenario_id) return res.status(400).json({ error: 'scenario_id required' });

  const filename = `seed_sensor_timeseries_${scenario_id}.json`;
  const filepath = path.join(SEED_DIR, filename);

  if (!fs.existsSync(filepath)) return res.status(404).json({ error: `Timeseries file not found: ${filename}` });

  const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  const sensorId = req.params.id;

  let filtered = data.filter((d: any) => d.sensor_id === sensorId);

  if (from) filtered = filtered.filter((d: any) => d.elapsed_sec >= Number(from));
  if (to) filtered = filtered.filter((d: any) => d.elapsed_sec <= Number(to));

  res.json(filtered);
});
