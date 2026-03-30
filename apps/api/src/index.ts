// ref: CLAUDE.md §7 — Express 서버 메인
import express from 'express';
import cors from 'cors';
import { scenarioRoutes } from './routes/scenarios';
import { emulatorRoutes } from './routes/emulator';
import { equipmentRoutes } from './routes/equipment';
import { sensorRoutes } from './routes/sensors';
import { eventRoutes } from './routes/events';
import { providerRoutes } from './routes/providers';
import { hazopRoutes } from './routes/hazop';
import { sopRoutes } from './routes/sop';
import { reportRoutes } from './routes/reports';
import { settingRoutes } from './routes/settings';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/scenarios', scenarioRoutes);
app.use('/api/emulator', emulatorRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/provider', providerRoutes);
app.use('/api/hazop', hazopRoutes);
app.use('/api/sop', sopRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/zones', equipmentRoutes); // zones reuse equipment router

app.listen(PORT, () => {
  console.log(`🚀 LH2 API server running on http://localhost:${PORT}`);
});

export default app;
