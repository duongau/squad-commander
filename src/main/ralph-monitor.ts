import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface RalphStatus {
  running: boolean;
  pid: number | null;
  uptime: string | null;
  lastPoll: string | null;
}

/**
 * Ralph Monitor — detects and monitors Squad's watch mode (Ralph).
 * Can start/stop Ralph from the UI.
 *
 * Events: ralph:status
 */
export class RalphMonitor extends EventEmitter {
  private ralphProcess: ChildProcess | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private startedAt: Date | null = null;

  constructor(private projectPath: string) {
    super();
  }

  /** Check if Ralph is currently running */
  getStatus(): RalphStatus {
    if (this.ralphProcess && !this.ralphProcess.killed) {
      const uptime = this.startedAt
        ? this.formatUptime(Date.now() - this.startedAt.getTime())
        : null;

      return {
        running: true,
        pid: this.ralphProcess.pid || null,
        uptime,
        lastPoll: new Date().toISOString(),
      };
    }

    return {
      running: false,
      pid: null,
      uptime: null,
      lastPoll: null,
    };
  }

  /** Start Ralph watch mode */
  start(options: { interval?: number; execute?: boolean } = {}): void {
    if (this.ralphProcess) {
      throw new Error('Ralph is already running');
    }

    const args = ['watch'];
    if (options.execute) args.push('--execute');
    if (options.interval) args.push('--interval', String(options.interval));

    this.ralphProcess = spawn('npx', ['@bradygaster/squad-cli', ...args], {
      cwd: this.projectPath,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.startedAt = new Date();

    this.ralphProcess.on('exit', () => {
      this.ralphProcess = null;
      this.startedAt = null;
      this.emit('ralph:status', this.getStatus());
    });

    this.emit('ralph:status', this.getStatus());

    // Poll status periodically
    this.pollTimer = setInterval(() => {
      this.emit('ralph:status', this.getStatus());
    }, 30000);
  }

  /** Stop Ralph */
  stop(): void {
    if (this.ralphProcess) {
      this.ralphProcess.kill('SIGTERM');
      this.ralphProcess = null;
      this.startedAt = null;
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.emit('ralph:status', this.getStatus());
  }

  /** Cleanup on app exit */
  destroy(): void {
    this.stop();
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}
