import { describe, it, expect, beforeEach } from 'vitest';
import { CostTracker } from '../../src/main/cost-tracker';

describe('CostTracker', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker({
      enabled: true,
      mode: 'approve-to-continue',
      pipelineBudgetTokens: 10000,
      stepBudgetTokens: 5000,
      globalDailyTokens: 50000,
    });
  });

  it('initializes with no current snapshot', () => {
    expect(tracker.getCurrentSnapshot()).toBeNull();
  });

  it('starts a run and creates snapshot', () => {
    tracker.startRun('run-1', 'pipe-1');
    const snapshot = tracker.getCurrentSnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot!.runId).toBe('run-1');
    expect(snapshot!.totalTokens).toBe(0);
    expect(snapshot!.estimatedCost).toBe(0);
  });

  describe('token parsing', () => {
    beforeEach(() => {
      tracker.startRun('run-1', 'pipe-1');
    });

    it('parses "tokens: X input, Y output" pattern', () => {
      tracker.parseOutput('step-1', 'keaton', 'tokens: 1000 input, 500 output');
      const snapshot = tracker.getCurrentSnapshot()!;
      expect(snapshot.totalInputTokens).toBe(1000);
      expect(snapshot.totalOutputTokens).toBe(500);
      expect(snapshot.totalTokens).toBe(1500);
    });

    it('parses "input.tokens: X ... output.tokens: Y" pattern', () => {
      tracker.parseOutput('step-1', 'keaton', 'input.tokens: 2000 output.tokens: 800');
      const snapshot = tracker.getCurrentSnapshot()!;
      expect(snapshot.totalTokens).toBe(2800);
    });

    it('parses "N prompt tokens ... M completion tokens" pattern', () => {
      tracker.parseOutput('step-1', 'keaton', '3000 prompt tokens, 1200 completion tokens');
      const snapshot = tracker.getCurrentSnapshot()!;
      expect(snapshot.totalTokens).toBe(4200);
    });

    it('parses "Token usage: X in / Y out" pattern', () => {
      tracker.parseOutput('step-1', 'keaton', 'Token usage: 500 in / 250 out');
      const snapshot = tracker.getCurrentSnapshot()!;
      expect(snapshot.totalTokens).toBe(750);
    });

    it('ignores non-matching output', () => {
      tracker.parseOutput('step-1', 'keaton', 'Just some regular output text');
      const snapshot = tracker.getCurrentSnapshot()!;
      expect(snapshot.totalTokens).toBe(0);
    });

    it('accumulates tokens across multiple chunks', () => {
      tracker.parseOutput('step-1', 'keaton', 'tokens: 1000 input, 500 output');
      tracker.parseOutput('step-1', 'keaton', 'tokens: 2000 input, 1000 output');
      const snapshot = tracker.getCurrentSnapshot()!;
      expect(snapshot.totalTokens).toBe(4500);
      expect(snapshot.steps).toHaveLength(1);
      expect(snapshot.steps[0].totalTokens).toBe(4500);
    });

    it('tracks separate steps', () => {
      tracker.parseOutput('step-1', 'keaton', 'tokens: 1000 input, 500 output');
      tracker.parseOutput('step-2', 'fenster', 'tokens: 2000 input, 800 output');
      const snapshot = tracker.getCurrentSnapshot()!;
      expect(snapshot.steps).toHaveLength(2);
      expect(snapshot.totalTokens).toBe(4300);
    });
  });

  describe('budget enforcement', () => {
    it('detects pipeline budget exceeded', () => {
      let exceeded = false;
      tracker.on('cost:budget-exceeded', () => { exceeded = true; });

      tracker.startRun('run-1', 'pipe-1');
      tracker.parseOutput('step-1', 'keaton', 'tokens: 8000 input, 3000 output'); // 11000 > 10000
      expect(exceeded).toBe(true);
      expect(tracker.getCurrentSnapshot()!.budgetExceeded).toBe(true);
    });

    it('calculates budget used percent', () => {
      tracker.startRun('run-1', 'pipe-1');
      tracker.parseOutput('step-1', 'keaton', 'tokens: 4000 input, 1000 output'); // 5000 / 10000 = 50%
      expect(tracker.getCurrentSnapshot()!.budgetUsedPercent).toBe(50);
    });

    it('detects per-step budget exceeded', () => {
      let stepExceeded = false;
      tracker.on('cost:step-budget-exceeded', () => { stepExceeded = true; });

      tracker.startRun('run-1', 'pipe-1');
      tracker.parseOutput('step-1', 'keaton', 'tokens: 4000 input, 2000 output'); // 6000 > 5000
      expect(stepExceeded).toBe(true);
    });

    it('does not trigger when under budget', () => {
      let exceeded = false;
      tracker.on('cost:budget-exceeded', () => { exceeded = true; });

      tracker.startRun('run-1', 'pipe-1');
      tracker.parseOutput('step-1', 'keaton', 'tokens: 2000 input, 1000 output'); // 3000 < 10000
      expect(exceeded).toBe(false);
    });
  });

  describe('enforcement modes', () => {
    it('approve-to-continue mode requires pause', () => {
      const t = new CostTracker({ mode: 'approve-to-continue' });
      expect(t.shouldPause()).toBe(true);
      expect(t.shouldAutoCancel()).toBe(false);
    });

    it('auto-cancel mode auto-cancels', () => {
      const t = new CostTracker({ mode: 'auto-cancel' });
      expect(t.shouldAutoCancel()).toBe(true);
      expect(t.shouldPause()).toBe(false);
    });

    it('notify-only mode does neither', () => {
      const t = new CostTracker({ mode: 'notify-only' });
      expect(t.shouldPause()).toBe(false);
      expect(t.shouldAutoCancel()).toBe(false);
    });

    it('disabled mode is not enabled', () => {
      const t = new CostTracker({ mode: 'disabled' });
      expect(t.isEnabled()).toBe(false);
    });
  });

  describe('cost estimation', () => {
    it('calculates cost based on default pricing', () => {
      tracker.startRun('run-1', 'pipe-1');
      tracker.parseOutput('step-1', 'keaton', 'tokens: 1000 input, 1000 output');
      const snapshot = tracker.getCurrentSnapshot()!;
      // default pricing: 0.005/1k input + 0.015/1k output = 0.005 + 0.015 = 0.02
      expect(snapshot.estimatedCost).toBeCloseTo(0.02, 3);
    });
  });

  describe('history', () => {
    it('records completed runs in history', () => {
      tracker.startRun('run-1', 'pipe-1');
      tracker.parseOutput('step-1', 'keaton', 'tokens: 1000 input, 500 output');
      tracker.completeRun('My Pipeline');

      const history = tracker.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].pipelineName).toBe('My Pipeline');
      expect(history[0].totalTokens).toBe(1500);
    });

    it('clears current snapshot after completion', () => {
      tracker.startRun('run-1', 'pipe-1');
      tracker.completeRun('Test');
      expect(tracker.getCurrentSnapshot()).toBeNull();
    });
  });

  describe('config management', () => {
    it('updates config', () => {
      tracker.updateConfig({ pipelineBudgetTokens: 50000 });
      expect(tracker.getConfig().pipelineBudgetTokens).toBe(50000);
    });

    it('sets budget', () => {
      tracker.setBudget(200000);
      expect(tracker.getConfig().pipelineBudgetTokens).toBe(200000);
    });

    it('tracks daily usage', () => {
      tracker.startRun('run-1', 'pipe-1');
      tracker.parseOutput('step-1', 'keaton', 'tokens: 1000 input, 500 output');
      const daily = tracker.getDailyUsage();
      expect(daily.tokens).toBe(1500);
      expect(daily.limit).toBe(50000);
    });
  });
});
