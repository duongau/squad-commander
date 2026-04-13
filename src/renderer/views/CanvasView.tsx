import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useSquadStore } from '../stores/squad-store';
import { useEffect, useState } from 'react';
import { OrgChartNode } from '../components/canvas/OrgChartNode';
import { AgentInspector } from '../components/canvas/AgentInspector';
import { QuickRunPanel } from '../components/canvas/QuickRunPanel';
import type { Agent } from '../../shared/types';

const nodeTypes = { agent: OrgChartNode };

const ROLE_COLORS: Record<string, string> = {
  Lead: '#ffd700',
  Scribe: '#808080',
  default: '#4a9eff',
};

function agentsToFlow(agents: Agent[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Find the lead agent (or first agent) as root
  const lead = agents.find((a) => a.role === 'Lead') || agents[0];
  if (!lead) return { nodes, edges };

  // Position agents in a tree layout
  const Y_GAP = 100;
  const X_GAP = 180;
  const nonLeads = agents.filter((a) => a.name !== lead.name);
  const cols = Math.ceil(Math.sqrt(nonLeads.length));

  // Root node
  nodes.push({
    id: lead.name,
    type: 'agent',
    position: { x: (cols * X_GAP) / 2, y: 0 },
    data: {
      label: lead.name,
      role: lead.role,
      description: lead.description,
      status: lead.status,
      color: ROLE_COLORS[lead.role] || ROLE_COLORS.default,
    },
  });

  // Child nodes in a grid
  nonLeads.forEach((agent, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);

    nodes.push({
      id: agent.name,
      type: 'agent',
      position: { x: col * X_GAP, y: (row + 1) * Y_GAP + 60 },
      data: {
        label: agent.name,
        role: agent.role,
        description: agent.description,
        status: agent.status,
        color: ROLE_COLORS[agent.role] || ROLE_COLORS.default,
      },
    });

    edges.push({
      id: `${lead.name}-${agent.name}`,
      source: lead.name,
      target: agent.name,
      style: { stroke: '#555' },
    });
  });

  return { nodes, edges };
}

export function CanvasView() {
  const { agents, team, loading, projectPath, openProject } = useSquadStore();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showQuickRun, setShowQuickRun] = useState(false);

  const { nodes: initialNodes, edges: initialEdges } = agentsToFlow(agents);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update flow when agents change
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = agentsToFlow(agents);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [agents, setNodes, setEdges]);

  if (!projectPath) {
    return (
      <div className="placeholder">
        <h2>⚔️ Squad Commander</h2>
        <p>Open a Squad project to get started.</p>
        <button className="btn-primary" onClick={openProject}>
          Open Project
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="placeholder">
        <p>Loading team...</p>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="placeholder">
        <h2>No agents found</h2>
        <p>This project doesn't have any agents in .squad/agents/</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div className="canvas-toolbar">
        <span className="team-name">{team?.name || 'Squad'}</span>
        <span className="agent-count">{agents.length} agents</span>
        <button
          className="btn-small"
          onClick={() => setShowQuickRun(!showQuickRun)}
        >
          {showQuickRun ? '✕ Close' : '▶ Quick Run'}
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={(_event, node) => {
          const agent = agents.find((a) => a.name === node.id);
          if (agent) setSelectedAgent(agent);
        }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background />
        <Controls />
      </ReactFlow>

      {selectedAgent && (
        <AgentInspector
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )}

      {showQuickRun && (
        <QuickRunPanel
          agents={agents}
          onClose={() => setShowQuickRun(false)}
        />
      )}
    </div>
  );
}
