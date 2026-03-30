// ref: CLAUDE.md §6 — 시나리오 에뮬레이터 엔진
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../lib/prisma';

interface PhaseInfo {
  phase: string;
  start_sec: number;
  end_sec: number;
}

interface TimeseriesRecord {
  sensor_id: string;
  elapsed_sec: number;
  value: number;
  quality: string;
  label: string;
}

type EventListener = (event: any) => void;

export class EmulatorEngine {
  private running = false;
  private scenarioId: string | null = null;
  private speed = 10;
  private elapsedSec = 0;
  private currentPhase = 'NORMAL';
  private phases: PhaseInfo[] = [];
  private timeseriesData: TimeseriesRecord[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners: EventListener[] = [];
  private totalDuration = 900;
  private lastSentSec = -1;
  private eventCreated = false;

  private readonly SEED_DIR = process.env.SEED_DIR || path.join(__dirname, '../../../../seed');

  start(scenarioId: string, speed: number) {
    if (this.running) this.stop();

    const scenarioFile = path.join(this.SEED_DIR, `seed_sensor_timeseries_${scenarioId}.json`);
    if (!fs.existsSync(scenarioFile)) throw new Error(`Timeseries file not found: ${scenarioFile}`);

    this.scenarioId = scenarioId;
    this.speed = speed;
    this.elapsedSec = 0;
    this.currentPhase = 'NORMAL';
    this.running = true;
    this.eventCreated = false;
    this.lastSentSec = -1;

    // Load timeseries
    this.timeseriesData = JSON.parse(fs.readFileSync(scenarioFile, 'utf-8'));

    // Load phases from scenario
    this.loadScenarioMeta(scenarioId);

    // Tick every 100ms real time
    const tickIntervalMs = 100;
    const secPerTick = speed * (tickIntervalMs / 1000);

    this.timer = setInterval(() => {
      if (!this.running) return;

      this.elapsedSec += secPerTick;

      if (this.elapsedSec >= this.totalDuration) {
        this.emit({ type: 'SCENARIO_END', timestamp: new Date().toISOString(), phase: 'END', elapsed_sec: this.totalDuration, data: {} });
        this.stop();
        return;
      }

      // Determine phase
      const newPhase = this.getPhase(this.elapsedSec);
      if (newPhase !== this.currentPhase) {
        this.currentPhase = newPhase;
        this.emit({
          type: 'PHASE_CHANGE',
          timestamp: new Date().toISOString(),
          phase: newPhase,
          elapsed_sec: Math.floor(this.elapsedSec),
          data: { phase: newPhase },
        });

        // Create event on FAULT phase
        if (newPhase === 'FAULT' && !this.eventCreated) {
          this.createEvent();
        }
      }

      // Send sensor data every 1 simulated second
      const currentSec = Math.floor(this.elapsedSec);
      if (currentSec > this.lastSentSec) {
        this.lastSentSec = currentSec;
        this.sendSensorUpdate(currentSec);
      }
    }, tickIntervalMs);
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.scenarioId = null;
    this.elapsedSec = 0;
    this.currentPhase = 'NORMAL';
  }

  getStatus() {
    return {
      running: this.running,
      scenario_id: this.scenarioId,
      elapsed_sec: Math.floor(this.elapsedSec),
      phase: this.currentPhase,
      speed: this.speed,
      total_duration: this.totalDuration,
    };
  }

  addListener(listener: EventListener) {
    this.listeners.push(listener);
  }

  removeListener(listener: EventListener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  private emit(event: any) {
    for (const listener of this.listeners) {
      try { listener(event); } catch {}
    }
  }

  private async loadScenarioMeta(scenarioId: string) {
    try {
      const scenario = await prisma.scenarioMaster.findUnique({ where: { scenario_id: scenarioId } });
      if (scenario) {
        this.phases = JSON.parse(scenario.phases);
        this.totalDuration = scenario.default_duration_sec;
      }
    } catch {
      // Fallback phases
      this.phases = [
        { phase: 'NORMAL', start_sec: 0, end_sec: 179 },
        { phase: 'SYMPTOM', start_sec: 180, end_sec: 359 },
        { phase: 'FAULT', start_sec: 360, end_sec: 599 },
        { phase: 'SECONDARY_IMPACT', start_sec: 600, end_sec: 779 },
        { phase: 'RESPONSE', start_sec: 780, end_sec: 900 },
      ];
      this.totalDuration = 900;
    }
  }

  private getPhase(elapsedSec: number): string {
    for (const p of this.phases) {
      if (elapsedSec >= p.start_sec && elapsedSec <= p.end_sec) return p.phase;
    }
    return this.phases[this.phases.length - 1]?.phase || 'NORMAL';
  }

  private sendSensorUpdate(currentSec: number) {
    // Find nearest timeseries records
    const records = this.timeseriesData.filter(r => r.elapsed_sec === currentSec);
    if (records.length === 0) return;

    this.emit({
      type: 'SENSOR_UPDATE',
      timestamp: new Date().toISOString(),
      phase: this.currentPhase,
      elapsed_sec: currentSec,
      data: records,
    });

    // Check for alarms
    const alarms = records.filter(r => r.label === 'WARNING' || r.label === 'ANOMALY');
    if (alarms.length > 0) {
      this.emit({
        type: 'ALARM',
        timestamp: new Date().toISOString(),
        phase: this.currentPhase,
        elapsed_sec: currentSec,
        data: alarms.map(a => ({ sensor_id: a.sensor_id, value: a.value, label: a.label })),
      });
    }
  }

  private async createEvent() {
    if (!this.scenarioId) return;
    this.eventCreated = true;

    try {
      const scenario = await prisma.scenarioMaster.findUnique({ where: { scenario_id: this.scenarioId } });
      if (!scenario) return;

      const event = await prisma.eventLog.create({
        data: {
          scenario_id: this.scenarioId,
          trigger_equipment_id: scenario.trigger_equipment_id,
          severity: 'CRITICAL',
          status: 'OPEN',
          summary: scenario.scenario_name,
        },
      });

      this.emit({
        type: 'EVENT_CREATE',
        timestamp: new Date().toISOString(),
        phase: this.currentPhase,
        elapsed_sec: Math.floor(this.elapsedSec),
        data: event,
      });
    } catch (err) {
      console.error('Failed to create event:', err);
    }
  }
}
