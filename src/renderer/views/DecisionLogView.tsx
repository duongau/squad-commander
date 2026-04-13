import { useEffect, useState } from 'react';
import { useSquadStore } from '../stores/squad-store';
import type { Decision } from '../../shared/types';

export function DecisionLogView() {
  const { decisions, projectPath } = useSquadStore();
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!projectPath) {
    return <div className="placeholder"><h2>Open a project first</h2></div>;
  }

  // Get unique agent names for filter dropdown
  const agents = [...new Set(decisions.map((d) => d.agent).filter(Boolean))];

  // Filter decisions
  const filtered = decisions.filter((d) => {
    if (search && !d.summary.toLowerCase().includes(search.toLowerCase()) &&
        !d.context.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (agentFilter && d.agent !== agentFilter) return false;
    return true;
  });

  return (
    <div className="decisions-view">
      <h2>📋 Decision Log</h2>

      <div className="decisions-filters">
        <input
          className="decisions-search"
          type="text"
          placeholder="Search decisions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="decisions-agent-filter"
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
        >
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a} value={a}>@{a}</option>
          ))}
        </select>
        <span className="decisions-count">{filtered.length} decisions</span>
      </div>

      {filtered.length === 0 && (
        <div className="placeholder">
          <p>{decisions.length === 0 ? 'No decisions recorded yet.' : 'No matching decisions.'}</p>
        </div>
      )}

      <div className="decisions-timeline">
        {filtered.map((d, i) => (
          <div
            key={i}
            className={`decision-card ${expandedIdx === i ? 'expanded' : ''}`}
            onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
          >
            <div className="decision-header">
              {d.date && <span className="decision-date">{d.date}</span>}
              {d.agent && <span className="decision-agent">@{d.agent}</span>}
              <span className="decision-summary">{d.summary}</span>
            </div>
            {expandedIdx === i && d.context && (
              <div className="decision-context">
                <pre>{d.context}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
