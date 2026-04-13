import { useState, useEffect } from 'react';
import { CanvasView } from './views/CanvasView';
import { PipelineView } from './views/PipelineView';
import { ScheduleView } from './views/ScheduleView';
import { DashboardView } from './views/DashboardView';
import { DecisionLogView } from './views/DecisionLogView';
import { CostView } from './views/CostView';
import { useSquadStore } from './stores/squad-store';

type View = 'canvas' | 'pipelines' | 'schedules' | 'dashboard' | 'decisions' | 'costs' | 'settings';

const NAV_ITEMS: Array<{ id: View; label: string; icon: string }> = [
  { id: 'canvas', label: 'Team', icon: '🏗️' },
  { id: 'pipelines', label: 'Pipelines', icon: '🔗' },
  { id: 'schedules', label: 'Schedules', icon: '📅' },
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'costs', label: 'Costs', icon: '💰' },
  { id: 'decisions', label: 'Decisions', icon: '📋' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export function App() {
  const [activeView, setActiveView] = useState<View>('canvas');
  const { agents } = useSquadStore();

  // Subscribe to file watcher events for live sync
  useEffect(() => {
    const unsub = window.commander.on('squad:changed', () => {
      useSquadStore.getState().refresh();
    });
    return unsub;
  }, []);

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-title">⚔️ Commander</h1>
        </div>
        <ul className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                onClick={() => setActiveView(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.id === 'canvas' && agents.length > 0 && (
                  <span className="nav-badge">{agents.length}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <span className="version">v0.1.0</span>
        </div>
      </nav>
      <main className="content">
        {activeView === 'canvas' && <CanvasView />}
        {activeView === 'pipelines' && <PipelineView />}
        {activeView === 'schedules' && <ScheduleView />}
        {activeView === 'dashboard' && <DashboardView />}
        {activeView === 'decisions' && <DecisionLogView />}
        {activeView === 'costs' && <CostView />}
        {activeView === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}

function SettingsView() {
  const { openProject, projectPath } = useSquadStore();
  return (
    <div className="settings-view">
      <h2>⚙️ Settings</h2>

      <div className="settings-section">
        <h3>Project</h3>
        <p>Current: {projectPath || 'None'}</p>
        <button className="btn-primary" onClick={openProject}>Open Project</button>
      </div>

      <div className="settings-section">
        <h3>Runner Registry</h3>
        <p>Manage agent execution engines. Default: Copilot CLI.</p>
        <button className="btn-small" onClick={async () => {
          const runners = await (window as any).commander.runners.list();
          alert(`Runners: ${runners.map((r: any) => r.name).join(', ')}`);
        }}>Show Runners</button>
        <button className="btn-small" onClick={async () => {
          const detected = await (window as any).commander.runners.detect();
          alert(`Detected: ${detected.map((r: any) => `${r.name} (${r.version || 'unknown'})`).join(', ') || 'None found'}`);
        }}>Auto-Detect</button>
      </div>

      <div className="settings-section">
        <h3>Guardrails — Hook Pipeline</h3>
        <p>Configure Squad's built-in safety hooks.</p>
        <label className="settings-toggle">
          <input type="checkbox" defaultChecked /> PII Scrubbing
          <span className="settings-desc">Remove personally identifiable information from agent output</span>
        </label>
        <label className="settings-toggle">
          <input type="checkbox" defaultChecked /> Reviewer Lockout
          <span className="settings-desc">Prevent the same agent from writing and approving code</span>
        </label>
        <label className="settings-toggle">
          <input type="checkbox" /> File-Write Guards
          <span className="settings-desc">Restrict which files agents can modify</span>
        </label>
      </div>

      <div className="settings-section">
        <h3>Export / Import</h3>
        <p>Package or restore your entire Squad configuration.</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-primary" onClick={async () => {
            try {
              await (window as any).commander.exportImport.export(
                `${projectPath || '.'}/.squad-export.json`
              );
              alert('Exported successfully!');
            } catch (e: any) { alert(`Export failed: ${e.message}`); }
          }}>📤 Export</button>
          <button className="btn-small">📥 Import</button>
        </div>
      </div>

      <div className="settings-section">
        <h3>🔌 MCP Servers</h3>
        <p>Connect to MCP servers for external data access in pipeline steps.</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-small" onClick={async () => {
            const servers = await (window as any).commander.mcp.list();
            alert(`MCP Servers: ${servers.map((s: any) => `${s.name} (${s.enabled ? 'on' : 'off'})`).join(', ') || 'None configured'}`);
          }}>List Servers</button>
          <button className="btn-small" onClick={async () => {
            const discovered = await (window as any).commander.mcp.discover();
            alert(`Discovered: ${discovered.map((s: any) => s.name).join(', ') || 'None found'}`);
          }}>Auto-Discover</button>
        </div>
      </div>

      <div className="settings-section">
        <h3>🔗 Webhooks</h3>
        <p>External HTTP triggers for pipeline execution.</p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="btn-primary" onClick={async () => {
            try {
              const result = await (window as any).commander.webhooks.start();
              alert(`Webhook server started at ${result.url}`);
            } catch (e: any) { alert(e.message); }
          }}>▶ Start Server</button>
          <button className="btn-small" onClick={async () => {
            await (window as any).commander.webhooks.stop();
            alert('Webhook server stopped');
          }}>⏹ Stop</button>
          <button className="btn-small" onClick={async () => {
            const endpoints = await (window as any).commander.webhooks.listEndpoints();
            alert(`Endpoints: ${endpoints.map((e: any) => `${e.path} → ${e.pipelineId}`).join('\n') || 'None'}`);
          }}>List Endpoints</button>
        </div>
      </div>

      <div className="settings-section">
        <h3>📢 Notification Channels</h3>
        <p>Send pipeline notifications to Teams, Slack, or email.</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-small" onClick={async () => {
            const channels = await (window as any).commander.channels.list();
            alert(`Channels: ${channels.map((c: any) => `${c.name} (${c.type})`).join(', ') || 'None configured'}`);
          }}>List Channels</button>
        </div>
      </div>

      <div className="settings-section">
        <h3>About</h3>
        <p>Squad Commander v0.1.0</p>
        <p>Copilot CLI + Squad native. No ATM dependency.</p>
      </div>
    </div>
  );
}
