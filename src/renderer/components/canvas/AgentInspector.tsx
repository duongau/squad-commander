import type { Agent } from '../../../shared/types';

interface Props {
  agent: Agent;
  onClose: () => void;
}

export function AgentInspector({ agent, onClose }: Props) {
  return (
    <div className="inspector-panel">
      <div className="inspector-header">
        <h3>{agent.name}</h3>
        <button className="btn-icon" onClick={onClose}>✕</button>
      </div>
      <div className="inspector-body">
        <div className="inspector-field">
          <label>Role</label>
          <span>{agent.role}</span>
        </div>
        <div className="inspector-field">
          <label>Status</label>
          <span className={`status-badge ${agent.status}`}>{agent.status}</span>
        </div>
        <div className="inspector-field">
          <label>Description</label>
          <p>{agent.description || 'No description'}</p>
        </div>
        <div className="inspector-field">
          <label>Charter</label>
          <pre className="charter-preview">
            {agent.charterContent?.slice(0, 500) || 'No charter loaded'}
            {(agent.charterContent?.length || 0) > 500 && '...'}
          </pre>
        </div>
      </div>
    </div>
  );
}
