import { useState, useEffect } from 'react';
import { CanvasView } from './views/CanvasView';
import { PipelineView } from './views/PipelineView';
import { ScheduleView } from './views/ScheduleView';
import { useSquadStore } from './stores/squad-store';

type View = 'canvas' | 'pipelines' | 'schedules' | 'dashboard' | 'decisions' | 'settings';

const NAV_ITEMS: Array<{ id: View; label: string; icon: string }> = [
  { id: 'canvas', label: 'Team', icon: '🏗️' },
  { id: 'pipelines', label: 'Pipelines', icon: '🔗' },
  { id: 'schedules', label: 'Schedules', icon: '📅' },
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
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
        {activeView === 'dashboard' && <Placeholder title="Dashboard" phase={4} />}
        {activeView === 'decisions' && <Placeholder title="Decisions" phase={4} />}
        {activeView === 'settings' && <SettingsPlaceholder />}
      </main>
    </div>
  );
}

function Placeholder({ title, phase }: { title: string; phase: number }) {
  return (
    <div className="placeholder">
      <h2>{title}</h2>
      <p className="hint">Coming in Phase {phase}</p>
    </div>
  );
}

function SettingsPlaceholder() {
  const { openProject, projectPath } = useSquadStore();
  return (
    <div className="settings-view">
      <h2>⚙️ Settings</h2>
      <div className="settings-section">
        <h3>Project</h3>
        <p>Current: {projectPath || 'None'}</p>
        <button className="btn-primary" onClick={openProject}>
          Open Project
        </button>
      </div>
    </div>
  );
}
