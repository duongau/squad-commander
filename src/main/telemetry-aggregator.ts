import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { watch, type FSWatcher } from 'chokidar';

export interface AgentMetrics {
  name: string;
  role: string;
  runCount: number;
  successCount: number;
  failCount: number;
  successRate: number;
  decisionCount: number;
  lastActive: string | null;
  recentActivity: number[]; // last 7 data points for sparkline
}

export interface TeamStats {
  totalRuns: number;
  totalSuccess: number;
  totalFailed: number;
  successRate: number;
  totalDecisions: number;
  mostActiveAgent: string | null;
  agentCount: number;
}

export interface LogEntry {
  timestamp: string;
  agent: string;
  action: string;
  detail: string;
}

/**
 * Telemetry Aggregator — watches .squad/log/ and orchestration-log/ for live activity.
 * Parses logs into structured metrics and emits real-time events.
 *
 * Events: telemetry:update, telemetry:log
 */
export class TelemetryAggregator extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private logEntries: LogEntry[] = [];
  private agentStats = new Map<string, { runs: number; success: number; fail: number; decisions: number; lastActive: string | null }>();

  constructor(private squadDir: string) {
    super();
  }

  /** Start watching log directories */
  start(): void {
    const logDir = path.join(this.squadDir, 'log');
    const orchDir = path.join(this.squadDir, 'orchestration-log');

    const watchPaths: string[] = [];
    if (fs.existsSync(logDir)) watchPaths.push(logDir);
    if (fs.existsSync(orchDir)) watchPaths.push(orchDir);

    if (watchPaths.length === 0) return;

    this.watcher = watch(watchPaths, {
      ignoreInitial: false,
      depth: 3,
      usePolling: process.platform === 'win32',
      interval: 1000,
    });

    this.watcher.on('add', (filePath) => this.parseLogFile(filePath));
    this.watcher.on('change', (filePath) => this.parseLogFile(filePath));

    // Also parse decisions.md for decision counts
    this.parseDecisionsFile();
  }

  /** Stop watching */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  /** Parse a log file and extract entries */
  private parseLogFile(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);

      for (const line of lines) {
        const entry = this.parseLogLine(line, filePath);
        if (entry) {
          this.logEntries.push(entry);
          this.updateAgentStats(entry);
          this.emit('telemetry:log', entry);
        }
      }

      this.emit('telemetry:update');
    } catch {
      // Skip unparseable files
    }
  }

  /** Parse a single log line */
  private parseLogLine(line: string, filePath: string): LogEntry | null {
    // Try ISO timestamp pattern: "2026-04-13T06:00:00Z — @agent did something"
    const isoMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s*[—-]\s*@?(\w+)\s+(.+)$/);
    if (isoMatch) {
      return {
        timestamp: isoMatch[1],
        agent: isoMatch[2],
        action: 'log',
        detail: isoMatch[3],
      };
    }

    // Try simple pattern: "agent: message"
    const simpleMatch = line.match(/^(\w+):\s+(.+)$/);
    if (simpleMatch) {
      return {
        timestamp: new Date().toISOString(),
        agent: simpleMatch[1],
        action: 'log',
        detail: simpleMatch[2],
      };
    }

    // Fallback: treat entire line as a log entry
    const fileName = path.basename(filePath, path.extname(filePath));
    return {
      timestamp: new Date().toISOString(),
      agent: fileName,
      action: 'log',
      detail: line.slice(0, 200),
    };
  }

  /** Parse decisions.md for per-agent decision counts */
  private parseDecisionsFile(): void {
    const decisionsPath = path.join(this.squadDir, 'decisions.md');
    if (!fs.existsSync(decisionsPath)) return;

    try {
      const content = fs.readFileSync(decisionsPath, 'utf-8');
      const agentPattern = /@(\w+)/g;
      let match;

      while ((match = agentPattern.exec(content)) !== null) {
        const agent = match[1];
        const stats = this.agentStats.get(agent) || { runs: 0, success: 0, fail: 0, decisions: 0, lastActive: null };
        stats.decisions++;
        this.agentStats.set(agent, stats);
      }
    } catch {
      // Skip
    }
  }

  /** Update per-agent stats from a log entry */
  private updateAgentStats(entry: LogEntry): void {
    const stats = this.agentStats.get(entry.agent) || { runs: 0, success: 0, fail: 0, decisions: 0, lastActive: null };
    stats.lastActive = entry.timestamp;

    if (entry.detail.includes('completed') || entry.detail.includes('success')) {
      stats.runs++;
      stats.success++;
    } else if (entry.detail.includes('failed') || entry.detail.includes('error')) {
      stats.runs++;
      stats.fail++;
    }

    this.agentStats.set(entry.agent, stats);
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /** Get metrics for all agents */
  getAgentMetrics(agents: Array<{ name: string; role: string }>): AgentMetrics[] {
    return agents.map((agent) => {
      const stats = this.agentStats.get(agent.name) || { runs: 0, success: 0, fail: 0, decisions: 0, lastActive: null };
      return {
        name: agent.name,
        role: agent.role,
        runCount: stats.runs,
        successCount: stats.success,
        failCount: stats.fail,
        successRate: stats.runs > 0 ? Math.round((stats.success / stats.runs) * 100) : 0,
        decisionCount: stats.decisions,
        lastActive: stats.lastActive,
        recentActivity: this.getRecentActivity(agent.name),
      };
    });
  }

  /** Get team-level stats */
  getTeamStats(): TeamStats {
    let totalRuns = 0, totalSuccess = 0, totalFailed = 0, totalDecisions = 0;
    let mostActive: string | null = null, maxRuns = 0;

    for (const [name, stats] of this.agentStats) {
      totalRuns += stats.runs;
      totalSuccess += stats.success;
      totalFailed += stats.fail;
      totalDecisions += stats.decisions;
      if (stats.runs > maxRuns) {
        maxRuns = stats.runs;
        mostActive = name;
      }
    }

    return {
      totalRuns,
      totalSuccess,
      totalFailed,
      successRate: totalRuns > 0 ? Math.round((totalSuccess / totalRuns) * 100) : 0,
      totalDecisions,
      mostActiveAgent: mostActive,
      agentCount: this.agentStats.size,
    };
  }

  /** Get recent log entries */
  getLiveLog(limit = 50): LogEntry[] {
    return this.logEntries.slice(-limit);
  }

  /** Get recent activity sparkline data for an agent (last 7 time buckets) */
  private getRecentActivity(agentName: string): number[] {
    const buckets = new Array(7).fill(0);
    const now = Date.now();
    const bucketSize = 24 * 60 * 60 * 1000; // 1 day

    for (const entry of this.logEntries) {
      if (entry.agent !== agentName) continue;
      const age = now - new Date(entry.timestamp).getTime();
      const bucket = Math.floor(age / bucketSize);
      if (bucket >= 0 && bucket < 7) {
        buckets[6 - bucket]++;
      }
    }

    return buckets;
  }
}
