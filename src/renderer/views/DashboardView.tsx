import { useEffect, useState } from 'react';
import { useSquadStore } from '../stores/squad-store';

interface AgentMetrics {
  name: string;
  role: string;
  runCount: number;
  successCount: number;
  failCount: number;
  successRate: number;
  decisionCount: number;
  lastActive: string | null;
  recentActivity: number[];
}

interface TeamStats {
  totalRuns: number;
  totalSuccess: number;
  totalFailed: number;
  successRate: number;
  totalDecisions: number;
  mostActiveAgent: string | null;
  agentCount: number;
}

interface RalphStatus {
  running: boolean;
  pid: number | null;
  uptime: string | null;
  lastPoll: string | null;
}

export function DashboardView() {
  const { projectPath } = useSquadStore();
  const [metrics, setMetrics] = useState<AgentMetrics[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [ralphStatus, setRalphStatus] = useState<RalphStatus | null>(null);
  const [liveLog, setLiveLog] = useState<Array<{ timestamp: string; agent: string; detail: string }>>([]);

  useEffect(() => {
    if (!projectPath) return;
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [projectPath]);

  const loadData = async () => {
    try {
      const [m, ts, rs, ll] = await Promise.all([
        (window as any).commander.telemetry.getAgentMetrics(),
        (window as any).commander.telemetry.getTeamStats(),
        (window as any).commander.ralph.getStatus(),
        (window as any).commander.telemetry.getLiveLog(20),
      ]);
      setMetrics(m);
      setTeamStats(ts);
      setRalphStatus(rs);
      setLiveLog(ll);
    } catch { /* not loaded yet */ }
  };

  if (!projectPath) {
    return <div className="placeholder"><h2>Open a project first</h2></div>;
  }

  return (
    <div className="dashboard-view">
      <h2>📊 Dashboard</h2>

      {/* Team stats */}
      {teamStats && (
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-value">{teamStats.totalRuns}</span>
            <span className="stat-label">Total Runs</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{teamStats.successRate}%</span>
            <span className="stat-label">Success Rate</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{teamStats.totalDecisions}</span>
            <span className="stat-label">Decisions</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{teamStats.agentCount}</span>
            <span className="stat-label">Agents</span>
          </div>
        </div>
      )}

      {/* Ralph monitor */}
      {ralphStatus && (
        <div className="ralph-panel">
          <div className="ralph-header">
            <h3>🤖 Ralph (Watch Mode)</h3>
            <span className={`ralph-status ${ralphStatus.running ? 'running' : 'stopped'}`}>
              {ralphStatus.running ? '● Running' : '○ Stopped'}
            </span>
          </div>
          {ralphStatus.running && (
            <div className="ralph-details">
              <span>PID: {ralphStatus.pid}</span>
              <span>Uptime: {ralphStatus.uptime}</span>
            </div>
          )}
          <div className="ralph-actions">
            {ralphStatus.running ? (
              <button className="btn-small" onClick={() => (window as any).commander.ralph.stop()}>
                ⏹ Stop Ralph
              </button>
            ) : (
              <button className="btn-primary" onClick={() => (window as any).commander.ralph.start({ execute: true })}>
                ▶ Start Ralph
              </button>
            )}
          </div>
        </div>
      )}

      {/* Agent cards */}
      <h3 className="section-title">Agent Activity</h3>
      <div className="agent-grid">
        {metrics.map((m) => (
          <div key={m.name} className="agent-card">
            <div className="agent-card-header">
              <strong>{m.name}</strong>
              <span className="agent-card-role">{m.role}</span>
            </div>
            <div className="agent-card-stats">
              <div className="agent-stat">
                <span className="agent-stat-value">{m.runCount}</span>
                <span className="agent-stat-label">runs</span>
              </div>
              <div className="agent-stat">
                <span className="agent-stat-value">{m.successRate}%</span>
                <span className="agent-stat-label">success</span>
              </div>
              <div className="agent-stat">
                <span className="agent-stat-value">{m.decisionCount}</span>
                <span className="agent-stat-label">decisions</span>
              </div>
            </div>
            <div className="sparkline">
              {m.recentActivity.map((v, i) => (
                <div key={i} className="spark-bar" style={{ height: `${Math.max(v * 20, 2)}px` }} />
              ))}
            </div>
            {m.lastActive && (
              <span className="agent-last-active">
                Last: {new Date(m.lastActive).toLocaleDateString()}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Live log */}
      {liveLog.length > 0 && (
        <div className="live-log">
          <h3 className="section-title">Live Log</h3>
          <div className="log-entries">
            {liveLog.map((entry, i) => (
              <div key={i} className="log-entry">
                <span className="log-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                <span className="log-agent">@{entry.agent}</span>
                <span className="log-detail">{entry.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
