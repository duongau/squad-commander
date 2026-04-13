import { useState, useEffect, useRef } from 'react';
import type { Agent } from '../../../shared/types';

interface Props {
  agents: Agent[];
  onClose: () => void;
}

export function QuickRunPanel({ agents, onClose }: Props) {
  const [selectedAgent, setSelectedAgent] = useState(agents[0]?.name || '');
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);

  // Subscribe to run output
  useEffect(() => {
    const unsub = window.commander.on('run:output', (...args: unknown[]) => {
      const data = args[0] as { runId: string; chunk: string };
      if (data.runId === runId) {
        setOutput((prev) => prev + data.chunk);
      }
    });

    const unsubComplete = window.commander.on('run:complete', (...args: unknown[]) => {
      const data = args[0] as { runId: string; success: boolean };
      if (data.runId === runId) {
        setRunning(false);
      }
    });

    return () => {
      unsub();
      unsubComplete();
    };
  }, [runId]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const handleRun = async () => {
    if (!selectedAgent || !prompt.trim()) return;

    setOutput('');
    setRunning(true);

    try {
      const result = await window.commander.quickRun.execute(selectedAgent, prompt);
      setRunId(result.runId);
    } catch (err) {
      setOutput(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setRunning(false);
    }
  };

  const handleCancel = async () => {
    if (runId) {
      await window.commander.quickRun.cancel(runId);
      setRunning(false);
    }
  };

  return (
    <div className="quick-run-panel">
      <div className="quick-run-header">
        <h3>▶ Quick Run</h3>
        <button className="btn-icon" onClick={onClose}>✕</button>
      </div>

      <div className="quick-run-controls">
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          disabled={running}
        >
          {agents.map((a) => (
            <option key={a.name} value={a.name}>
              {a.name} ({a.role})
            </option>
          ))}
        </select>

        <textarea
          placeholder="What should this agent do?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={running}
          rows={3}
        />

        <div className="quick-run-actions">
          {running ? (
            <button className="btn-danger" onClick={handleCancel}>
              ⏹ Cancel
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={handleRun}
              disabled={!prompt.trim()}
            >
              ▶ Run
            </button>
          )}
          {running && <span className="running-indicator">🔄 Running...</span>}
        </div>
      </div>

      {output && (
        <div className="quick-run-output">
          <label>Output</label>
          <pre ref={outputRef}>{output}</pre>
        </div>
      )}
    </div>
  );
}
