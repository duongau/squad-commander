import { useEffect } from 'react';
import { useCostStore } from '../stores/cost-store';
import { useSquadStore } from '../stores/squad-store';

export function CostView() {
  const { currentSnapshot, history, config, dailyUsage, loadConfig, loadHistory, loadDailyUsage, updateConfig, setBudget, setSnapshot } = useCostStore();
  const { projectPath } = useSquadStore();

  useEffect(() => {
    if (projectPath) {
      loadConfig();
      loadHistory();
      loadDailyUsage();
    }
  }, [projectPath, loadConfig, loadHistory, loadDailyUsage]);

  // Subscribe to cost events
  useEffect(() => {
    const unsubUpdate = window.commander.on('cost:update', (...args: unknown[]) => {
      setSnapshot(args[0] as any);
    });
    const unsubExceeded = window.commander.on('cost:budget-exceeded', (...args: unknown[]) => {
      setSnapshot(args[0] as any);
    });
    return () => { unsubUpdate(); unsubExceeded(); };
  }, [setSnapshot]);

  if (!projectPath) {
    return <div className="placeholder"><h2>Open a project first</h2></div>;
  }

  return (
    <div className="cost-view">
      <h2>💰 Cost Monitor</h2>

      {/* Budget Configuration */}
      {config && (
        <div className="cost-config-panel">
          <h3>Budget Configuration</h3>
          <div className="cost-config-grid">
            <div className="cost-config-field">
              <label>Enforcement Mode</label>
              <select
                value={config.mode}
                onChange={(e) => updateConfig({ mode: e.target.value as any })}
              >
                <option value="approve-to-continue">Approve to continue (pause + ask)</option>
                <option value="notify-only">Notify only (warn but don't pause)</option>
                <option value="auto-cancel">Auto-cancel (hard kill)</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <div className="cost-config-field">
              <label>Pipeline Budget (tokens)</label>
              <input
                type="number"
                value={config.pipelineBudgetTokens || ''}
                placeholder="e.g., 100000"
                onChange={(e) => setBudget(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="cost-config-field">
              <label>Per-Step Budget (tokens)</label>
              <input
                type="number"
                value={config.stepBudgetTokens || ''}
                placeholder="No limit"
                onChange={(e) => updateConfig({ stepBudgetTokens: parseInt(e.target.value) || null })}
              />
            </div>
            <div className="cost-config-field">
              <label>Daily Global Cap (tokens)</label>
              <input
                type="number"
                value={config.globalDailyTokens || ''}
                placeholder="No limit"
                onChange={(e) => updateConfig({ globalDailyTokens: parseInt(e.target.value) || null })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Live Run Cost */}
      {currentSnapshot && (
        <div className="cost-live-panel">
          <h3>Current Run</h3>
          <div className="cost-gauge-row">
            <div className="cost-gauge">
              <div
                className={`cost-gauge-fill ${currentSnapshot.budgetExceeded ? 'exceeded' : ''}`}
                style={{ width: `${Math.min(currentSnapshot.budgetUsedPercent, 100)}%` }}
              />
              <span className="cost-gauge-label">
                {currentSnapshot.budgetUsedPercent}% budget used
              </span>
            </div>
            <div className="cost-totals">
              <span>{currentSnapshot.totalTokens.toLocaleString()} tokens</span>
              <span>${currentSnapshot.estimatedCost.toFixed(4)}</span>
            </div>
          </div>
          {currentSnapshot.steps.length > 0 && (
            <div className="cost-steps">
              <h4>Per-Step Breakdown</h4>
              {currentSnapshot.steps.map((s) => (
                <div key={s.stepId} className="cost-step-row">
                  <span className="cost-step-name">{s.stepId}</span>
                  <span className="cost-step-agent">@{s.agent}</span>
                  <span className="cost-step-tokens">{s.totalTokens.toLocaleString()}</span>
                  <span className="cost-step-cost">${s.estimatedCost.toFixed(4)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Daily Usage */}
      {dailyUsage && (
        <div className="cost-daily-panel">
          <h3>Daily Usage</h3>
          <span>{dailyUsage.tokens.toLocaleString()} tokens today</span>
          {dailyUsage.limit && (
            <span className="cost-daily-limit"> / {dailyUsage.limit.toLocaleString()} limit</span>
          )}
        </div>
      )}

      {/* History */}
      <div className="cost-history-panel">
        <h3>Cost History</h3>
        {history.length === 0 ? (
          <p className="cost-no-history">No runs recorded yet.</p>
        ) : (
          <div className="cost-history-list">
            {history.map((h, i) => (
              <div key={i} className="cost-history-row">
                <span className="cost-history-name">{h.pipelineName}</span>
                <span className="cost-history-date">{new Date(h.completedAt).toLocaleDateString()}</span>
                <span className="cost-history-tokens">{h.totalTokens.toLocaleString()} tokens</span>
                <span className="cost-history-cost">${h.estimatedCost.toFixed(4)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
