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
        <h3>About</h3>
        <p>Squad Commander v0.1.0</p>
        <p>Copilot CLI + Squad native. No ATM dependency.</p>
      </div>
    </div>
  );
}
