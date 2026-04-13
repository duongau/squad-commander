import { useState } from 'react';

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
              </button>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <span className="version">v0.1.0</span>
        </div>
      </nav>
      <main className="content">
        {activeView === 'canvas' && <CanvasPlaceholder />}
        {activeView === 'pipelines' && <Placeholder title="Pipelines" phase={2} />}
        {activeView === 'schedules' && <Placeholder title="Schedules" phase={3} />}
        {activeView === 'dashboard' && <Placeholder title="Dashboard" phase={4} />}
        {activeView === 'decisions' && <Placeholder title="Decisions" phase={4} />}
        {activeView === 'settings' && <Placeholder title="Settings" phase={1} />}
      </main>
    </div>
  );
}

function CanvasPlaceholder() {
  return (
    <div className="placeholder">
      <h2>🏗️ Team Canvas</h2>
      <p>Org chart will render here. Open a Squad project to get started.</p>
      <p className="hint">Phase 1 — building now</p>
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
