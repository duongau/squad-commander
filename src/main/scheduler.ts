import fs from 'fs';
import path from 'path';
import cron, { type ScheduledTask } from 'node-cron';
import { EventEmitter } from 'events';
import { PipelineEngine } from './pipeline-engine';
import { PipelinePersistence } from './pipeline-persistence';

export interface ScheduleConfig {
  id: string;
  pipelineId: string;
  cron: string;
  enabled: boolean;
  variables: Record<string, string>;
  lastRun: string | null;
  lastStatus: 'success' | 'failed' | 'running' | null;
  createdAt: string;
}

interface SchedulesFile {
  schedules: ScheduleConfig[];
}

/**
 * Scheduler — manages cron-based pipeline execution.
 * Persists schedules in .squad/schedules.json.
 * Continues running when app is minimized to tray.
 *
 * Events: schedule:started, schedule:completed, schedule:failed
 */
export class Scheduler extends EventEmitter {
  private schedules: Map<string, ScheduleConfig> = new Map();
  private tasks: Map<string, ScheduledTask> = new Map();
  private filePath: string;

  constructor(
    squadDir: string,
    private engine: PipelineEngine,
    private persistence: PipelinePersistence
  ) {
    super();
    this.filePath = path.join(squadDir, 'schedules.json');
    this.loadFromDisk();
  }

  /** Load schedules from disk and start enabled ones */
  private loadFromDisk(): void {
    if (!fs.existsSync(this.filePath)) return;

    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      const data: SchedulesFile = JSON.parse(content);

      for (const config of data.schedules) {
        this.schedules.set(config.id, config);
        if (config.enabled) {
          this.startCronTask(config);
        }
      }
    } catch {
      // Invalid file, start fresh
    }
  }

  /** Save schedules to disk */
  private saveToDisk(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data: SchedulesFile = {
      schedules: Array.from(this.schedules.values()),
    };
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /** Start a cron task for a schedule */
  private startCronTask(config: ScheduleConfig): void {
    // Stop existing task if any
    this.stopCronTask(config.id);

    if (!cron.validate(config.cron)) {
      console.error(`Invalid cron expression for schedule "${config.id}": ${config.cron}`);
      return;
    }

    const task = cron.schedule(config.cron, async () => {
      await this.executeSchedule(config.id);
    });

    this.tasks.set(config.id, task);
  }

  /** Stop a cron task */
  private stopCronTask(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.stop();
      this.tasks.delete(id);
    }
  }

  /** Execute a scheduled pipeline run */
  private async executeSchedule(scheduleId: string): Promise<void> {
    const config = this.schedules.get(scheduleId);
    if (!config) return;

    config.lastRun = new Date().toISOString();
    config.lastStatus = 'running';
    this.saveToDisk();
    this.emit('schedule:started', scheduleId);

    try {
      const pipeline = await this.persistence.get(config.pipelineId);
      if (!pipeline) {
        throw new Error(`Pipeline "${config.pipelineId}" not found`);
      }

      const run = await this.engine.run(pipeline, config.variables, 'schedule');
      config.lastStatus = run.status === 'completed' ? 'success' : 'failed';
      this.emit('schedule:completed', scheduleId, run);
    } catch (err) {
      config.lastStatus = 'failed';
      this.emit('schedule:failed', scheduleId, err);
    }

    this.saveToDisk();
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /** List all schedules */
  list(): ScheduleConfig[] {
    return Array.from(this.schedules.values());
  }

  /** Get a schedule by ID */
  get(id: string): ScheduleConfig | undefined {
    return this.schedules.get(id);
  }

  /** Create a new schedule */
  create(config: Omit<ScheduleConfig, 'lastRun' | 'lastStatus' | 'createdAt'>): ScheduleConfig {
    if (!cron.validate(config.cron)) {
      throw new Error(`Invalid cron expression: ${config.cron}`);
    }

    const schedule: ScheduleConfig = {
      ...config,
      lastRun: null,
      lastStatus: null,
      createdAt: new Date().toISOString(),
    };

    this.schedules.set(schedule.id, schedule);
    if (schedule.enabled) {
      this.startCronTask(schedule);
    }

    this.saveToDisk();
    return schedule;
  }

  /** Update an existing schedule */
  update(id: string, updates: Partial<ScheduleConfig>): ScheduleConfig | null {
    const existing = this.schedules.get(id);
    if (!existing) return null;

    if (updates.cron && !cron.validate(updates.cron)) {
      throw new Error(`Invalid cron expression: ${updates.cron}`);
    }

    const updated = { ...existing, ...updates, id }; // id is immutable
    this.schedules.set(id, updated);

    // Restart cron if cron expression or enabled state changed
    if (updates.cron !== undefined || updates.enabled !== undefined) {
      this.stopCronTask(id);
      if (updated.enabled) {
        this.startCronTask(updated);
      }
    }

    this.saveToDisk();
    return updated;
  }

  /** Delete a schedule */
  delete(id: string): boolean {
    this.stopCronTask(id);
    const deleted = this.schedules.delete(id);
    if (deleted) this.saveToDisk();
    return deleted;
  }

  /** Toggle a schedule on/off */
  toggle(id: string, enabled: boolean): ScheduleConfig | null {
    return this.update(id, { enabled });
  }

  /** Get the next run time for a schedule (approximate) */
  getNextRun(id: string): string | null {
    const config = this.schedules.get(id);
    if (!config || !config.enabled) return null;
    // node-cron doesn't expose next run time directly
    // Return the cron expression for display
    return config.cron;
  }

  /** Get count of active (enabled) schedules */
  get activeCount(): number {
    return Array.from(this.schedules.values()).filter((s) => s.enabled).length;
  }

  /** Stop all cron tasks (called on app exit) */
  stopAll(): void {
    for (const [id] of this.tasks) {
      this.stopCronTask(id);
    }
  }
}
