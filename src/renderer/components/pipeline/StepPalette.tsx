import type { StepType } from '../../../shared/types';

interface StepTemplate {
  type: StepType;
  icon: string;
  label: string;
  description: string;
  color: string;
}

const STEP_TEMPLATES: StepTemplate[] = [
  { type: 'task', icon: '🔧', label: 'Task', description: 'Agent executes a prompt', color: '#4a9eff' },
  { type: 'condition', icon: '🔀', label: 'Condition', description: 'Branch on true/false', color: '#ffa502' },
  { type: 'router', icon: '🧭', label: 'Router', description: 'Multi-way dispatch', color: '#ff6348' },
  { type: 'approval', icon: '🖐️', label: 'Approval', description: 'Pause for human review', color: '#2ed573' },
  { type: 'parallel', icon: '⚡', label: 'Parallel', description: 'Fan-out / fan-in', color: '#a55eea' },
  { type: 'loop', icon: '🔄', label: 'Loop', description: 'Repeat until condition', color: '#ff4757' },
  { type: 'delay', icon: '⏱️', label: 'Delay', description: 'Wait before continuing', color: '#747d8c' },
];

interface Props {
  onAddStep: (type: StepType) => void;
}

export function StepPalette({ onAddStep }: Props) {
  return (
    <div className="step-palette">
      <h4 className="palette-title">Steps</h4>
      {STEP_TEMPLATES.map((tmpl) => (
        <button
          key={tmpl.type}
          className="palette-item"
          onClick={() => onAddStep(tmpl.type)}
          title={tmpl.description}
        >
          <span className="palette-icon">{tmpl.icon}</span>
          <div className="palette-info">
            <span className="palette-label">{tmpl.label}</span>
            <span className="palette-desc">{tmpl.description}</span>
          </div>
          <div className="palette-color" style={{ background: tmpl.color }} />
        </button>
      ))}
    </div>
  );
}
