import { EventEmitter } from 'events';

export type EnforcementMode = 'approve-to-continue' | 'notify-only' | 'auto-cancel' | 'disabled';

export interface ModelPricing {
  name: string;
  inputPer1k: number;   // $ per 1000 input tokens
  outputPer1k: number;  // $ per 1000 output tokens
}

export interface BudgetConfig {
  enabled: boolean;
  mode: EnforcementMode;
  pipelineBudgetTokens: number | null;  // per-pipeline run limit
  stepBudgetTokens: number | null;      // per-step limit
  globalDailyTokens: number | null;     // daily cap across all runs
  modelPricing: ModelPricing[];
}

export interface CostSnapshot {
  runId: string;
  pipelineId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  steps: StepCost[];
  budgetUsedPercent: number;
  budgetExceeded: boolean;
}

export interface StepCost {
  stepId: string;
  agent: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface CostHistoryEntry {
  runId: string;
  pipelineId: string;
  pipelineName: string;
  completedAt: string;
  totalTokens: number;
  estimatedCost: number;
}

const DEFAULT_PRICING: ModelPricing[] = [
  { name: 'claude-sonnet', inputPer1k: 0.003, outputPer1k: 0.015 },
  { name: 'claude-opus', inputPer1k: 0.015, outputPer1k: 0.075 },
  { name: 'claude-haiku', inputPer1k: 0.00025, outputPer1k: 0.00125 },
  { name: 'gpt-4', inputPer1k: 0.03, outputPer1k: 0.06 },
  { name: 'gpt-4o', inputPer1k: 0.005, outputPer1k: 0.015 },
  { name: 'default', inputPer1k: 0.005, outputPer1k: 0.015 },
];

// Common token usage patterns from various AI CLI tools
const TOKEN_PATTERNS: RegExp[] = [
  /tokens?:\s*(\d+)\s*input[,/]\s*(\d+)\s*output/i,
  /input.tokens?:\s*(\d+).*output.tokens?:\s*(\d+)/i,
  /(\d+)\s*prompt\s*tokens?.*?(\d+)\s*completion\s*tokens?/i,
  /usage.*?input.*?(\d+).*?output.*?(\d+)/i,
  /Token usage:\s*(\d+)\s*in\s*[/,]\s*(\d+)\s*out/i,
];

/**
 * Cost Tracker — monitors token usage across pipeline runs.
 *
 * Events:
 * - cost:update (CostSnapshot)
 * - cost:budget-exceeded (CostSnapshot)
 * - cost:step-budget-exceeded (stepId, StepCost)
 */
export class CostTracker extends EventEmitter {
  private config: BudgetConfig;
  private currentSnapshot: CostSnapshot | null = null;
  private history: CostHistoryEntry[] = [];
  private dailyTokens = 0;
  private dailyResetDate: string = new Date().toDateString();

  constructor(config?: Partial<BudgetConfig>) {
    super();
    this.config = {
      enabled: true,
      mode: 'approve-to-continue',
      pipelineBudgetTokens: 100000,
      stepBudgetTokens: null,
      globalDailyTokens: null,
      modelPricing: DEFAULT_PRICING,
      ...config,
    };
  }

  /** Start tracking a new pipeline run */
  startRun(runId: string, pipelineId: string): void {
    this.resetDailyIfNeeded();
    this.currentSnapshot = {
      runId,
      pipelineId,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      steps: [],
      budgetUsedPercent: 0,
      budgetExceeded: false,
    };
  }

  /** Parse a chunk of stdout for token usage */
  parseOutput(stepId: string, agent: string, chunk: string): void {
    if (!this.config.enabled || !this.currentSnapshot) return;

    for (const pattern of TOKEN_PATTERNS) {
      const match = chunk.match(pattern);
      if (match) {
        const inputTokens = parseInt(match[1], 10);
        const outputTokens = parseInt(match[2], 10);
        this.recordTokens(stepId, agent, inputTokens, outputTokens);
        break;
      }
    }
  }

  /** Record token usage for a step */
  private recordTokens(stepId: string, agent: string, inputTokens: number, outputTokens: number): void {
    if (!this.currentSnapshot) return;

    const totalTokens = inputTokens + outputTokens;
    const cost = this.calculateCost(inputTokens, outputTokens);

    // Update or create step cost
    let stepCost = this.currentSnapshot.steps.find((s) => s.stepId === stepId);
    if (!stepCost) {
      stepCost = { stepId, agent, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 };
      this.currentSnapshot.steps.push(stepCost);
    }

    stepCost.inputTokens += inputTokens;
    stepCost.outputTokens += outputTokens;
    stepCost.totalTokens += totalTokens;
    stepCost.estimatedCost += cost;

    // Update run totals
    this.currentSnapshot.totalInputTokens += inputTokens;
    this.currentSnapshot.totalOutputTokens += outputTokens;
    this.currentSnapshot.totalTokens += totalTokens;
    this.currentSnapshot.estimatedCost += cost;

    // Update daily totals
    this.dailyTokens += totalTokens;

    // Calculate budget usage
    if (this.config.pipelineBudgetTokens) {
      this.currentSnapshot.budgetUsedPercent = Math.round(
        (this.currentSnapshot.totalTokens / this.config.pipelineBudgetTokens) * 100
      );
    }

    this.emit('cost:update', this.currentSnapshot);

    // Check per-step budget
    if (this.config.stepBudgetTokens && stepCost.totalTokens > this.config.stepBudgetTokens) {
      this.emit('cost:step-budget-exceeded', stepId, stepCost);
    }

    // Check pipeline budget
    if (this.config.pipelineBudgetTokens &&
        this.currentSnapshot.totalTokens > this.config.pipelineBudgetTokens) {
      this.currentSnapshot.budgetExceeded = true;
      this.emit('cost:budget-exceeded', this.currentSnapshot);
    }

    // Check global daily budget
    if (this.config.globalDailyTokens && this.dailyTokens > this.config.globalDailyTokens) {
      this.currentSnapshot.budgetExceeded = true;
      this.emit('cost:budget-exceeded', this.currentSnapshot);
    }
  }

  /** Calculate cost based on model pricing */
  private calculateCost(inputTokens: number, outputTokens: number): number {
    const pricing = this.config.modelPricing.find((p) => p.name === 'default') || DEFAULT_PRICING[DEFAULT_PRICING.length - 1];
    return (inputTokens / 1000) * pricing.inputPer1k + (outputTokens / 1000) * pricing.outputPer1k;
  }

  /** Complete the current run and add to history */
  completeRun(pipelineName: string): void {
    if (!this.currentSnapshot) return;

    this.history.push({
      runId: this.currentSnapshot.runId,
      pipelineId: this.currentSnapshot.pipelineId,
      pipelineName,
      completedAt: new Date().toISOString(),
      totalTokens: this.currentSnapshot.totalTokens,
      estimatedCost: this.currentSnapshot.estimatedCost,
    });

    this.currentSnapshot = null;
  }

  /** Reset daily counter if date changed */
  private resetDailyIfNeeded(): void {
    const today = new Date().toDateString();
    if (today !== this.dailyResetDate) {
      this.dailyTokens = 0;
      this.dailyResetDate = today;
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  getCurrentSnapshot(): CostSnapshot | null {
    return this.currentSnapshot;
  }

  getHistory(): CostHistoryEntry[] {
    return [...this.history];
  }

  getConfig(): BudgetConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<BudgetConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  setBudget(tokens: number): void {
    this.config.pipelineBudgetTokens = tokens;
  }

  getDailyUsage(): { tokens: number; limit: number | null } {
    return { tokens: this.dailyTokens, limit: this.config.globalDailyTokens };
  }

  /** Check if current mode requires pausing on budget exceeded */
  shouldPause(): boolean {
    return this.config.mode === 'approve-to-continue';
  }

  /** Check if current mode auto-cancels on budget exceeded */
  shouldAutoCancel(): boolean {
    return this.config.mode === 'auto-cancel';
  }

  /** Check if cost tracking is active */
  isEnabled(): boolean {
    return this.config.enabled && this.config.mode !== 'disabled';
  }
}
