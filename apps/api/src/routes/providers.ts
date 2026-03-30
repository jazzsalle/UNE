// ref: CLAUDE.md §7.4 — 외부기관 Mock Provider API
import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const providerRoutes = Router();

// Health checks
providerRoutes.get('/kogas/health', (_req, res) => res.json({ status: 'ok', provider: 'KOGAS' }));
providerRoutes.get('/kgs/health', (_req, res) => res.json({ status: 'ok', provider: 'KGS' }));
providerRoutes.get('/keti/health', (_req, res) => res.json({ status: 'ok', provider: 'KETI' }));
providerRoutes.get('/safetia/health', (_req, res) => res.json({ status: 'ok', provider: 'SAFETIA' }));

// KOGAS
providerRoutes.get('/kogas/:scenario_id', async (req, res) => {
  const result = await prisma.mockKogasResult.findFirst({ where: { scenario_id: req.params.scenario_id } });
  if (!result) return res.status(404).json({ error: 'No KOGAS result' });
  res.json({ ...result, sensor_evidence: result.sensor_evidence ? JSON.parse(result.sensor_evidence) : null });
});

// KGS
providerRoutes.get('/kgs/:scenario_id', async (req, res) => {
  const results = await prisma.mockKgsResult.findMany({ where: { scenario_id: req.params.scenario_id } });
  res.json(results);
});

// KGS analyze (POST)
providerRoutes.post('/kgs/analyze', async (req, res) => {
  const { scenario_id } = req.body;
  if (!scenario_id) return res.status(400).json({ error: 'scenario_id required' });
  const results = await prisma.mockKgsResult.findMany({ where: { scenario_id } });
  res.json(results);
});

// KETI
providerRoutes.get('/keti/:scenario_id', async (req, res) => {
  const result = await prisma.mockKetiResult.findFirst({ where: { scenario_id: req.params.scenario_id } });
  if (!result) return res.status(404).json({ error: 'No KETI result' });
  res.json(result);
});

// KETI simulate (POST)
providerRoutes.post('/keti/simulate', async (req, res) => {
  const { scenario_id } = req.body;
  if (!scenario_id) return res.status(400).json({ error: 'scenario_id required' });
  const result = await prisma.mockKetiResult.findFirst({ where: { scenario_id } });
  if (!result) return res.status(404).json({ error: 'No simulation result' });
  res.json(result);
});

// Safetia
providerRoutes.get('/safetia/:scenario_id', async (req, res) => {
  const results = await prisma.mockSafetiaHistory.findMany({ where: { scenario_id: req.params.scenario_id } });
  res.json(results);
});
