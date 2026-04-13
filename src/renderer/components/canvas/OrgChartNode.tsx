import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';

interface OrgChartData {
  label: string;
  role: string;
  description: string;
  status: string;
  color: string;
  [key: string]: unknown;
}

export function OrgChartNode({ data }: NodeProps) {
  const d = data as OrgChartData;
  return (
    <div
      className="org-node"
      style={{ borderColor: d.color }}
    >
      <Handle type="target" position={Position.Top} />
      <div className="org-node-header" style={{ background: d.color }}>
        <span className="org-node-name">{d.label}</span>
      </div>
      <div className="org-node-body">
        <span className="org-node-role">{d.role}</span>
        <span className={`org-node-status ${d.status}`}>
          {d.status === 'active' ? '●' : '○'}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
