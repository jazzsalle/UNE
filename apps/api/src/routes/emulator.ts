// ref: CLAUDE.md §6, §7.1 — 에뮬레이터 API + SSE
import { Router, Request, Response } from 'express';
import { EmulatorEngine } from '../services/emulatorEngine';

export const emulatorRoutes = Router();
const engine = new EmulatorEngine();

// POST /api/emulator/start
emulatorRoutes.post('/start', (req, res) => {
  const { scenario_id, speed } = req.body;
  if (!scenario_id) return res.status(400).json({ error: 'scenario_id required' });
  try {
    engine.start(scenario_id, speed || 10);
    res.json({ status: 'started', scenario_id, speed: speed || 10 });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/emulator/stop
emulatorRoutes.post('/stop', (_req, res) => {
  engine.stop();
  res.json({ status: 'stopped' });
});

// POST /api/emulator/pause
emulatorRoutes.post('/pause', (_req, res) => {
  engine.pause();
  res.json({ status: 'paused' });
});

// POST /api/emulator/resume
emulatorRoutes.post('/resume', (_req, res) => {
  engine.resume();
  res.json({ status: 'resumed' });
});

// GET /api/emulator/status
emulatorRoutes.get('/status', (_req, res) => {
  res.json(engine.getStatus());
});

// GET /api/emulator/stream — SSE
emulatorRoutes.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const listener = (event: any) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  engine.addListener(listener);
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

  req.on('close', () => {
    engine.removeListener(listener);
  });
});
