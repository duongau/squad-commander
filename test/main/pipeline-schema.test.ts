import { describe, it, expect } from 'vitest';
import { validatePipeline, resolveVariables } from '../../src/shared/pipeline-schema';

describe('Pipeline Schema Validation', () => {
  const validPipeline = {
    id: 'test-pipeline',
    name: 'Test Pipeline',
    description: 'A test pipeline',
    version: 1,
    variables: [
      { name: 'target', type: 'string', required: true, default: '' },
    ],
    steps: [
      { id: 'start', type: 'start' },
      { id: 'do-work', type: 'task', agent: 'keaton', prompt: 'Analyze {{target}}' },
      { id: 'end', type: 'end' },
    ],
    edges: [
      { source: 'start', target: 'do-work' },
      { source: 'do-work', target: 'end' },
    ],
    metadata: {
      created: '2026-04-13T00:00:00Z',
      modified: '2026-04-13T00:00:00Z',
      tags: ['test'],
      template: false,
    },
  };

  it('validates a correct pipeline', () => {
    const result = validatePipeline(validPipeline);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects pipeline with invalid ID format', () => {
    const result = validatePipeline({ ...validPipeline, id: 'Invalid ID!' });
    expect(result.valid).toBe(false);
  });

  it('rejects pipeline with empty steps', () => {
    const result = validatePipeline({ ...validPipeline, steps: [] });
    expect(result.valid).toBe(false);
  });

  it('rejects task step without agent', () => {
    const pipeline = {
      ...validPipeline,
      steps: [
        { id: 'start', type: 'start' },
        { id: 'bad-task', type: 'task', prompt: 'no agent' },
        { id: 'end', type: 'end' },
      ],
    };
    const result = validatePipeline(pipeline);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('agent'))).toBe(true);
  });

  it('rejects task step without prompt', () => {
    const pipeline = {
      ...validPipeline,
      steps: [
        { id: 'start', type: 'start' },
        { id: 'bad-task', type: 'task', agent: 'keaton' },
        { id: 'end', type: 'end' },
      ],
    };
    const result = validatePipeline(pipeline);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('prompt'))).toBe(true);
  });

  it('rejects condition step without eval', () => {
    const pipeline = {
      ...validPipeline,
      steps: [
        { id: 'start', type: 'start' },
        { id: 'bad-cond', type: 'condition', trueTarget: 'end', falseTarget: 'end' },
        { id: 'end', type: 'end' },
      ],
    };
    const result = validatePipeline(pipeline);
    expect(result.valid).toBe(false);
  });

  it('rejects loop without maxIterations', () => {
    const pipeline = {
      ...validPipeline,
      steps: [
        { id: 'start', type: 'start' },
        { id: 'do-work', type: 'task', agent: 'a', prompt: 'x' },
        { id: 'bad-loop', type: 'loop', body: ['do-work'], condition: 'step.do-work.success' },
        { id: 'end', type: 'end' },
      ],
    };
    const result = validatePipeline(pipeline);
    expect(result.valid).toBe(false);
  });

  it('rejects parallel with fewer than 2 children', () => {
    const pipeline = {
      ...validPipeline,
      steps: [
        { id: 'start', type: 'start' },
        { id: 'do-work', type: 'task', agent: 'a', prompt: 'x' },
        { id: 'bad-par', type: 'parallel', children: ['do-work'] },
        { id: 'end', type: 'end' },
      ],
    };
    const result = validatePipeline(pipeline);
    expect(result.valid).toBe(false);
  });

  it('detects edge referencing non-existent step', () => {
    const pipeline = {
      ...validPipeline,
      edges: [{ source: 'start', target: 'nonexistent' }],
    };
    const result = validatePipeline(pipeline);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('nonexistent'))).toBe(true);
  });

  it('detects undefined variable reference in prompt', () => {
    const pipeline = {
      ...validPipeline,
      variables: [],
      steps: [
        { id: 'start', type: 'start' },
        { id: 'task', type: 'task', agent: 'a', prompt: 'Use {{undefined_var}}' },
        { id: 'end', type: 'end' },
      ],
      edges: [
        { source: 'start', target: 'task' },
        { source: 'task', target: 'end' },
      ],
    };
    const result = validatePipeline(pipeline);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('undefined_var'))).toBe(true);
  });

  it('detects duplicate step IDs', () => {
    const pipeline = {
      ...validPipeline,
      steps: [
        { id: 'start', type: 'start' },
        { id: 'dupe', type: 'task', agent: 'a', prompt: 'x' },
        { id: 'dupe', type: 'task', agent: 'b', prompt: 'y' },
        { id: 'end', type: 'end' },
      ],
    };
    const result = validatePipeline(pipeline);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate'))).toBe(true);
  });

  it('validates approval step requires message', () => {
    const pipeline = {
      ...validPipeline,
      steps: [
        { id: 'start', type: 'start' },
        { id: 'gate', type: 'approval' },
        { id: 'end', type: 'end' },
      ],
    };
    const result = validatePipeline(pipeline);
    expect(result.valid).toBe(false);
  });

  it('validates router step requires routes', () => {
    const pipeline = {
      ...validPipeline,
      steps: [
        { id: 'start', type: 'start' },
        { id: 'router', type: 'router' },
        { id: 'end', type: 'end' },
      ],
    };
    const result = validatePipeline(pipeline);
    expect(result.valid).toBe(false);
  });

  it('validates delay step requires delayMs', () => {
    const pipeline = {
      ...validPipeline,
      steps: [
        { id: 'start', type: 'start' },
        { id: 'wait', type: 'delay' },
        { id: 'end', type: 'end' },
      ],
    };
    const result = validatePipeline(pipeline);
    expect(result.valid).toBe(false);
  });
});

describe('resolveVariables', () => {
  it('replaces variable references', () => {
    const result = resolveVariables('Hello {{name}}, your role is {{role}}', {
      name: 'Keaton',
      role: 'Lead',
    });
    expect(result).toBe('Hello Keaton, your role is Lead');
  });

  it('leaves unknown variables unchanged', () => {
    const result = resolveVariables('Hello {{unknown}}', {});
    expect(result).toBe('Hello {{unknown}}');
  });

  it('handles empty template', () => {
    expect(resolveVariables('', {})).toBe('');
  });

  it('handles template with no variables', () => {
    expect(resolveVariables('No vars here', { x: '1' })).toBe('No vars here');
  });
});
