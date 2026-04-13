// Runner registry types

export interface RunnerConfig {
  name: string;
  command: string;
  flags: string[];
  contextFormat: 'squad-charter' | 'plain-prompt';
  outputCapture: 'stdout' | 'file';
  tokenPattern?: string;
  isDefault: boolean;
  model?: string; // Allow per-runner model selection for cost optimization
}

export type ContextSize = 'minimal' | 'standard' | 'full';

export interface DetectedRunner {
  name: string;
  command: string;
  version?: string;
}

/**
 * Default runner: gh copilot WITHOUT --agent squad.
 *
 * Commander IS the orchestrator — we handle routing, context building,
 * and decision management. Loading Squad's coordinator on top of ours
 * wastes ~250k tokens per call. Our context file already contains
 * the agent's charter, prompt, and relevant decisions.
 */
export const DEFAULT_COPILOT_RUNNER: RunnerConfig = {
  name: 'copilot-cli',
  command: 'gh copilot',
  flags: [],  // No --agent squad — Commander handles orchestration
  contextFormat: 'squad-charter',
  outputCapture: 'stdout',
  isDefault: true,
};

/**
 * Full Squad runner — use when you want Squad's coordinator
 * to handle routing (more expensive, ~350k tokens per call).
 */
export const SQUAD_AGENT_RUNNER: RunnerConfig = {
  name: 'copilot-squad',
  command: 'gh copilot',
  flags: ['--agent', 'squad'],
  contextFormat: 'squad-charter',
  outputCapture: 'stdout',
  isDefault: false,
};
