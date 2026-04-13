import { useEffect, useState } from 'react';
import { useScheduleStore } from '../stores/schedule-store';
import { usePipelineStore } from '../stores/pipeline-store';
import { useSquadStore } from '../stores/squad-store';

const CRON_PRESETS = [
  { label: 'Every hour', cron: '0 * * * *' },
  { label: 'Daily at 6am', cron: '0 6 * * *' },
  { label: 'Daily at 9am', cron: '0 9 * * *' },
  { label: 'Weekly Monday 9am', cron: '0 9 * * 1' },
  { label: 'Every 30 minutes', cron: '*/30 * * * *' },
];

export function ScheduleView() {
  const { schedules, loading, loadSchedules, createSchedule, deleteSchedule, toggleSchedule } = useScheduleStore();
  const { pipelines, loadPipelines } = usePipelineStore();
  const { projectPath } = useSquadStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newPipelineId, setNewPipelineId] = useState('');
  const [newCron, setNewCron] = useState('0 6 * * *');
  const [newEnabled, setNewEnabled] = useState(true);

  useEffect(() => {
    if (projectPath) {
      loadSchedules();
      loadPipelines();
    }
  }, [projectPath, loadSchedules, loadPipelines]);

  if (!projectPath) {
    return <div className="placeholder"><h2>Open a project first</h2></div>;
  }

  const handleCreate = async () => {
    if (!newPipelineId) return;
    await createSchedule({
      id: `sched-${Date.now()}`,
      pipelineId: newPipelineId,
      cron: newCron,
      enabled: newEnabled,
      variables: {},
    });
    setShowCreate(false);
    setNewPipelineId('');
  };

  return (
    <div className="schedule-view">
      <div className="schedule-header">
        <h2>📅 Schedules</h2>
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? '✕ Cancel' : '+ New Schedule'}
        </button>
      </div>

      {showCreate && (
        <div className="schedule-create-form">
          <div className="form-field">
            <label>Pipeline</label>
            <select value={newPipelineId} onChange={(e) => setNewPipelineId(e.target.value)}>
              <option value="">Select a pipeline...</option>
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Frequency</label>
            <div className="cron-presets">
              {CRON_PRESETS.map((preset) => (
                <button
                  key={preset.cron}
                  className={`btn-small ${newCron === preset.cron ? 'active' : ''}`}
                  onClick={() => setNewCron(preset.cron)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <input
              className="cron-input"
              value={newCron}
              onChange={(e) => setNewCron(e.target.value)}
              placeholder="Custom cron expression"
            />
          </div>

          <div className="form-field">
            <label>
              <input
                type="checkbox"
                checked={newEnabled}
                onChange={(e) => setNewEnabled(e.target.checked)}
              />
              {' '}Enable immediately
            </label>
          </div>

          <button className="btn-primary" onClick={handleCreate} disabled={!newPipelineId}>
            Create Schedule
          </button>
        </div>
      )}

      {loading && <div className="placeholder"><p>Loading...</p></div>}

      {!loading && schedules.length === 0 && !showCreate && (
        <div className="placeholder">
          <p>No schedules yet. Create one to run pipelines automatically.</p>
        </div>
      )}

      {schedules.length > 0 && (
        <div className="schedule-list">
          {schedules.map((s) => {
            const pipeline = pipelines.find((p) => p.id === s.pipelineId);
            return (
              <div key={s.id} className={`schedule-card ${s.enabled ? '' : 'disabled'}`}>
                <div className="schedule-card-header">
                  <h4>{pipeline?.name || s.pipelineId}</h4>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={(e) => toggleSchedule(s.id, e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div className="schedule-card-body">
                  <div className="schedule-info">
                    <span className="schedule-cron">⏰ {s.cron}</span>
                    {s.lastRun && (
                      <span className="schedule-last-run">
                        Last: {new Date(s.lastRun).toLocaleString()}
                        {s.lastStatus && (
                          <span className={`status-dot ${s.lastStatus}`}>
                            {s.lastStatus === 'success' ? '✅' : s.lastStatus === 'failed' ? '❌' : '🔄'}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <button className="btn-small btn-delete" onClick={() => deleteSchedule(s.id)}>
                    🗑️ Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
