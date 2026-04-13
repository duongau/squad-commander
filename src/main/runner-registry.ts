import { spawn, type ChildProcess } from 'child_process';
import type { RunnerConfig, DetectedRunner } from '../shared/runner-types';
import { DEFAULT_COPILOT_RUNNER } from '../shared/runner-types';

export interface RunProcess {
  runId: string;
  process: ChildProcess;
  agent: string;
  startedAt: Date;
}

/**
 * Runner Registry — extensible agent runner management.
 * Ships with Copilot CLI as the default runner.
 * Tracks spawned processes for cleanup on app exit.
 */
export class RunnerRegistry {
  private runners: Map<string, RunnerConfig> = new Map();
  private activeProcesses: Map<string, RunProcess> = new Map();

  constructor() {
    this.addRunner(DEFAULT_COPILOT_RUNNER);
  }

  /** Add a runner to the registry */
  addRunner(config: RunnerConfig): void {
    this.runners.set(config.name, config);
  }

  /** Remove a runner from the registry */
  removeRunner(name: string): void {
    if (name === DEFAULT_COPILOT_RUNNER.name) {
      throw new Error('Cannot remove the default runner');
    }
    this.runners.delete(name);
  }

  /** Get all registered runners */
  listRunners(): RunnerConfig[] {
    return Array.from(this.runners.values());
  }

  /** Get the default runner */
  getDefault(): RunnerConfig {
    const defaultRunner = Array.from(this.runners.values()).find((r) => r.isDefault);
    return defaultRunner || DEFAULT_COPILOT_RUNNER;
  }

  /** Get a runner by name */
  getRunner(name: string): RunnerConfig | undefined {
    return this.runners.get(name);
  }

  /** Spawn an agent runner process */
  spawn(
    runId: string,
    agent: string,
    contextFilePath: string,
    runnerName?: string,
    cwd?: string
  ): RunProcess {
    const runner = runnerName
      ? this.runners.get(runnerName) || this.getDefault()
      : this.getDefault();

    const [cmd, ...baseArgs] = runner.command.split(' ');
    const args = [...baseArgs, ...runner.flags, '-p', contextFilePath];

    const child = spawn(cmd, args, {
      cwd: cwd || process.cwd(),
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    const runProcess: RunProcess = {
      runId,
      process: child,
      agent,
      startedAt: new Date(),
    };

    this.activeProcesses.set(runId, runProcess);

    child.on('exit', () => {
      this.activeProcesses.delete(runId);
    });

    return runProcess;
  }

  /** Cancel a running process */
  cancel(runId: string): boolean {
    const runProcess = this.activeProcesses.get(runId);
    if (!runProcess) return false;

    runProcess.process.kill('SIGTERM');
    // Force kill after 5 seconds if still running
    setTimeout(() => {
      if (!runProcess.process.killed) {
        runProcess.process.kill('SIGKILL');
      }
    }, 5000);

    this.activeProcesses.delete(runId);
    return true;
  }

  /** Kill all active processes (called on app exit) */
  killAll(): void {
    for (const [runId, runProcess] of this.activeProcesses) {
      runProcess.process.kill('SIGTERM');
      this.activeProcesses.delete(runId);
    }
  }

  /** Get count of active processes */
  get activeCount(): number {
    return this.activeProcesses.size;
  }

  /** Detect available agent runners on the system */
  async detect(): Promise<DetectedRunner[]> {
    const detected: DetectedRunner[] = [];

    // Try gh copilot
    try {
      const result = await this.tryCommand('gh', ['copilot', '--version']);
      if (result) {
        detected.push({
          name: 'copilot-cli',
          command: 'gh copilot',
          version: result.trim(),
        });
      }
    } catch {
      // Not installed
    }

    // Try copilot directly
    try {
      const result = await this.tryCommand('copilot', ['--version']);
      if (result) {
        detected.push({
          name: 'copilot-direct',
          command: 'copilot',
          version: result.trim(),
        });
      }
    } catch {
      // Not installed
    }

    return detected;
  }

  private tryCommand(cmd: string, args: string[]): Promise<string | null> {
    return new Promise((resolve) => {
      const child = spawn(cmd, args, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });
      child.on('exit', (code) => {
        resolve(code === 0 ? output : null);
      });
      child.on('error', () => resolve(null));
      setTimeout(() => {
        child.kill();
        resolve(null);
      }, 5000);
    });
  }
}
