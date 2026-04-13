// Core domain types shared between main and renderer processes

export interface Agent {
  name: string;
  role: string;
  description: string;
  status: 'active' | 'inactive';
  charterPath: string;
  charterContent?: string;
}

export interface Team {
  name: string;
  description: string;
  projectContext: string;
  members: string[];
}

export interface RoutingRule {
  pattern: string;
  agents: string[];
  description: string;
}

export interface Routing {
  rules: RoutingRule[];
  defaultAgent: string;
  fallback: string;
}

export interface Decision {
  date: string;
  agent: string;
  summary: string;
  context: string;
  raw: string;
}

export interface RunnerConfig {
  name: string;
  command: string;
  flags: string[];
  contextFormat: 'squad-charter' | 'plain-prompt';
  outputCapture: 'stdout' | 'file';
  tokenPattern?: string;
  isDefault: boolean;
}

export interface DetectedRunner {
  name: string;
  command: string;
  version?: string;
}

export interface RunHandle {
  runId: string;
  agent: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
}

export interface RunOutput {
  runId: string;
  chunk: string;
  timestamp: string;
}

export interface AppSettings {
  projectPath: string | null;
  recentProjects: string[];
  theme: 'light' | 'dark';
  defaultRunner: string;
  windowState?: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
}

// Pipeline types (Phase 2, defined early for extensibility)
export type StepType =
  | 'start'
  | 'end'
  | 'task'
  | 'condition'
  | 'router'
  | 'approval'
  | 'parallel'
  | 'loop'
  | 'delay';

export interface PipelineVariable {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  default: string;
}

export interface PipelineStep {
  id: string;
  type: StepType;
  agent?: string;
  engine?: string;
  prompt?: string;
  timeout?: number;
  successCriteria?: string;
  message?: string;
  eval?: string;
  trueTarget?: string;
  falseTarget?: string;
  routes?: Array<{ label: string; match: string; target: string }>;
  defaultRoute?: string;
  children?: string[];
  fanIn?: 'all' | 'first' | 'majority';
  body?: string[];
  condition?: string;
  maxIterations?: number;
  delayMs?: number;
}

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  version: number;
  variables: PipelineVariable[];
  steps: PipelineStep[];
  edges: Array<{ source: string; target: string }>;
  metadata: {
    created: string;
    modified: string;
    tags: string[];
    template: boolean;
  };
}
