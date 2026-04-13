import { useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import { usePipelineStore } from '../stores/pipeline-store';
import { useSquadStore } from '../stores/squad-store';
import { StepPalette } from '../components/pipeline/StepPalette';
import type { Pipeline, PipelineStep, StepType } from '../../shared/types';

const STEP_COLORS: Record<string, string> = {
  start: '#2ed573',
  end: '#ff4757',
  task: '#4a9eff',
  condition: '#ffa502',
  router: '#ff6348',
  approval: '#2ed573',
  parallel: '#a55eea',
  loop: '#ff4757',
  delay: '#747d8c',
};

const STEP_ICONS: Record<string, string> = {
  start: '▶',
  end: '⏹',
  task: '🔧',
  condition: '🔀',
  router: '🧭',
  approval: '🖐️',
  parallel: '⚡',
  loop: '🔄',
  delay: '⏱️',
};

function pipelineToFlow(pipeline: Pipeline): { nodes: Node[]; edges: Edge[] } {
  const Y_GAP = 100;
  const nodes: Node[] = pipeline.steps.map((step, i) => ({
    id: step.id,
    position: { x: 300, y: i * Y_GAP },
    data: {
      label: `${STEP_ICONS[step.type] || '?'} ${step.id}`,
      type: step.type,
      agent: step.agent,
    },
    style: {
      background: '#1a1a2e',
      border: `2px solid ${STEP_COLORS[step.type] || '#555'}`,
      borderRadius: '8px',
      padding: '8px 16px',
      color: '#e6e6e6',
      fontSize: '13px',
      minWidth: '160px',
      textAlign: 'center' as const,
    },
  }));

  const edges: Edge[] = pipeline.edges.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    style: { stroke: '#555' },
    animated: false,
  }));

  return { nodes, edges };
}

export function PipelineView() {
  const {
    pipelines, activePipeline, templates, runOutput, runStatus, loading,
    loadPipelines, loadTemplates, selectPipeline, savePipeline, deletePipeline,
    runPipeline, pauseRun, cancelRun, approveGate, clearOutput, createFromTemplate,
    appendOutput, setRunStatus,
  } = usePipelineStore();
  const { agents, projectPath } = useSquadStore();
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (projectPath) {
      loadPipelines();
      loadTemplates();
    }
  }, [projectPath, loadPipelines, loadTemplates]);

  // Subscribe to pipeline events
  useEffect(() => {
    const unsubOutput = window.commander.on('run:output', (...args: unknown[]) => {
      const data = args[0] as { chunk: string };
      appendOutput(data.chunk);
    });
    const unsubStatus = window.commander.on('run:status', (...args: unknown[]) => {
      setRunStatus(args[0] as Record<string, unknown>);
    });
    const unsubComplete = window.commander.on('run:complete', (...args: unknown[]) => {
      setRunStatus({ type: 'complete', ...(args[0] as Record<string, unknown>) });
    });
    return () => { unsubOutput(); unsubStatus(); unsubComplete(); };
  }, [appendOutput, setRunStatus]);

  if (!projectPath) {
    return <div className="placeholder"><h2>Open a project first</h2></div>;
  }

  // Pipeline list view
  if (!activePipeline) {
    return (
      <div className="pipeline-list-view">
        <div className="pipeline-list-header">
          <h2>🔗 Pipelines</h2>
          <button className="btn-primary" onClick={() => {
            const id = `pipeline-${Date.now()}`;
            selectPipeline({
              id,
              name: 'New Pipeline',
              description: '',
              version: 1,
              variables: [],
              steps: [
                { id: 'start', type: 'start' },
                { id: 'end', type: 'end' },
              ],
              edges: [{ source: 'start', target: 'end' }],
              metadata: {
                created: new Date().toISOString(),
                modified: new Date().toISOString(),
                tags: [],
                template: false,
              },
            });
            setEditMode(true);
          }}>
            + New Pipeline
          </button>
        </div>

        {pipelines.length === 0 && templates.length === 0 && (
          <div className="placeholder">
            <p>No pipelines yet. Create one or start from a template.</p>
          </div>
        )}

        {pipelines.length > 0 && (
          <div className="pipeline-section">
            <h3>Your Pipelines</h3>
            <div className="pipeline-grid">
              {pipelines.map((p) => (
                <div key={p.id} className="pipeline-card" onClick={() => selectPipeline(p)}>
                  <h4>{p.name}</h4>
                  <p>{p.description || 'No description'}</p>
                  <div className="pipeline-card-meta">
                    <span>{p.steps.length} steps</span>
                    <span>{p.variables.length} vars</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {templates.length > 0 && (
          <div className="pipeline-section">
            <h3>Templates</h3>
            <div className="pipeline-grid">
              {templates.map((t) => (
                <div key={t.id} className="pipeline-card template" onClick={() => {
                  const newId = `${t.id}-${Date.now()}`;
                  createFromTemplate(t, newId, `${t.name} (copy)`);
                  setEditMode(true);
                }}>
                  <h4>{t.name}</h4>
                  <p>{t.description}</p>
                  <div className="pipeline-card-meta">
                    <span>{t.steps.length} steps</span>
                    <span className="template-badge">Template</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Pipeline detail/editor view
  const { nodes, edges } = pipelineToFlow(activePipeline);

  const handleAddStep = (type: StepType) => {
    const newStep: PipelineStep = {
      id: `${type}-${Date.now()}`,
      type,
      ...(type === 'task' ? { agent: agents[0]?.name || '', prompt: '' } : {}),
      ...(type === 'condition' ? { eval: '', trueTarget: '', falseTarget: '' } : {}),
      ...(type === 'router' ? { routes: [], defaultRoute: '' } : {}),
      ...(type === 'approval' ? { message: 'Review and approve' } : {}),
      ...(type === 'parallel' ? { children: [], fanIn: 'all' as const } : {}),
      ...(type === 'loop' ? { body: [], condition: '', maxIterations: 3 } : {}),
      ...(type === 'delay' ? { delayMs: 5000 } : {}),
    };

    // Insert before 'end'
    const endIdx = activePipeline.steps.findIndex((s) => s.type === 'end');
    const newSteps = [...activePipeline.steps];
    if (endIdx >= 0) {
      newSteps.splice(endIdx, 0, newStep);
    } else {
      newSteps.push(newStep);
    }

    // Update edges
    const newEdges = [...activePipeline.edges];
    const prevStep = newSteps[newSteps.indexOf(newStep) - 1];
    const nextStep = newSteps[newSteps.indexOf(newStep) + 1];
    if (prevStep && nextStep) {
      // Remove old edge
      const oldEdgeIdx = newEdges.findIndex(
        (e) => e.source === prevStep.id && e.target === nextStep.id
      );
      if (oldEdgeIdx >= 0) newEdges.splice(oldEdgeIdx, 1);
      // Add new edges
      newEdges.push({ source: prevStep.id, target: newStep.id });
      newEdges.push({ source: newStep.id, target: nextStep.id });
    }

    selectPipeline({ ...activePipeline, steps: newSteps, edges: newEdges });
  };

  const isRunning = runStatus && (runStatus as any).type !== 'complete';

  return (
    <div className="pipeline-detail-view">
      <div className="pipeline-detail-header">
        <button className="btn-small" onClick={() => { selectPipeline(null); clearOutput(); }}>
          ← Back
        </button>
        <input
          className="pipeline-name-input"
          value={activePipeline.name}
          onChange={(e) => selectPipeline({ ...activePipeline, name: e.target.value })}
          disabled={!editMode}
        />
        <div className="pipeline-actions">
          {!editMode && (
            <button className="btn-small" onClick={() => setEditMode(true)}>✏️ Edit</button>
          )}
          {editMode && (
            <button className="btn-primary" onClick={async () => {
              await savePipeline(activePipeline);
              setEditMode(false);
            }}>💾 Save</button>
          )}
          {!isRunning && (
            <button className="btn-primary" onClick={() => runPipeline(activePipeline.id)}>
              ▶ Run
            </button>
          )}
          {isRunning && (
            <>
              <button className="btn-small" onClick={pauseRun}>⏸ Pause</button>
              <button className="btn-danger" onClick={cancelRun}>⏹ Cancel</button>
            </>
          )}
        </div>
      </div>

      <div className="pipeline-workspace">
        {editMode && <StepPalette onAddStep={handleAddStep} />}

        <div className="pipeline-canvas-area">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.3 }}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        {runOutput && (
          <div className="pipeline-output-panel">
            <h4>Output</h4>
            <pre>{runOutput}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
