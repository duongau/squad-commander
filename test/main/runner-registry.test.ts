import { describe, it, expect } from 'vitest';
import { RunnerRegistry } from '../../src/main/runner-registry';
import { DEFAULT_COPILOT_RUNNER } from '../../src/shared/runner-types';

describe('RunnerRegistry', () => {
  it('initializes with default Copilot CLI runner', () => {
    const registry = new RunnerRegistry();
    const runners = registry.listRunners();
    expect(runners).toHaveLength(1);
    expect(runners[0].name).toBe('copilot-cli');
    expect(runners[0].isDefault).toBe(true);
  });

  it('returns the default runner', () => {
    const registry = new RunnerRegistry();
    const def = registry.getDefault();
    expect(def.name).toBe(DEFAULT_COPILOT_RUNNER.name);
    expect(def.command).toBe('gh copilot');
  });

  it('adds a custom runner', () => {
    const registry = new RunnerRegistry();
    registry.addRunner({
      name: 'custom-runner',
      command: 'my-agent',
      flags: ['--fast'],
      contextFormat: 'plain-prompt',
      outputCapture: 'stdout',
      isDefault: false,
    });

    expect(registry.listRunners()).toHaveLength(2);
    expect(registry.getRunner('custom-runner')).toBeDefined();
  });

  it('removes a custom runner', () => {
    const registry = new RunnerRegistry();
    registry.addRunner({
      name: 'temp-runner',
      command: 'temp',
      flags: [],
      contextFormat: 'plain-prompt',
      outputCapture: 'stdout',
      isDefault: false,
    });

    registry.removeRunner('temp-runner');
    expect(registry.listRunners()).toHaveLength(1);
  });

  it('prevents removing the default runner', () => {
    const registry = new RunnerRegistry();
    expect(() => registry.removeRunner('copilot-cli')).toThrow(
      'Cannot remove the default runner'
    );
  });

  it('tracks active process count', () => {
    const registry = new RunnerRegistry();
    expect(registry.activeCount).toBe(0);
  });

  it('gets runner by name', () => {
    const registry = new RunnerRegistry();
    const runner = registry.getRunner('copilot-cli');
    expect(runner).toBeDefined();
    expect(runner?.command).toBe('gh copilot');
  });

  it('returns undefined for unknown runner', () => {
    const registry = new RunnerRegistry();
    expect(registry.getRunner('unknown')).toBeUndefined();
  });
});
