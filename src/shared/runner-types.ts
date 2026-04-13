// Runner registry types

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

export const DEFAULT_COPILOT_RUNNER: RunnerConfig = {
  name: 'copilot-cli',
  command: 'gh copilot',
  flags: ['--agent', 'squad'],
  contextFormat: 'squad-charter',
  outputCapture: 'stdout',
  isDefault: true,
};
