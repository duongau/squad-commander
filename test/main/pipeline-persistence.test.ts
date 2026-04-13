import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { PipelinePersistence } from '../../src/main/pipeline-persistence';
import type { Pipeline } from '../../src/shared/types';

describe('PipelinePersistence', () => {
  let tmpDir: string;
  let persistence: PipelinePersistence;

  const testPipeline: Pipeline = {
    id: 'test-pipe',
    name: 'Test Pipeline',
    description: 'For testing',
    version: 1,
    variables: [],
    steps: [
      { id: 'start', type: 'start' },
      { id: 'work', type: 'task', agent: 'keaton', prompt: 'Do work' },
      { id: 'end', type: 'end' },
    ],
    edges: [
      { source: 'start', target: 'work' },
      { source: 'work', target: 'end' },
    ],
    metadata: {
      created: '2026-04-13T00:00:00Z',
      modified: '2026-04-13T00:00:00Z',
      tags: ['test'],
      template: false,
    },
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipe-test-'));
    const squadDir = path.join(tmpDir, '.squad');
    fs.mkdirSync(squadDir, { recursive: true });
    persistence = new PipelinePersistence(squadDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists empty pipelines when none exist', async () => {
    const pipelines = await persistence.list();
    expect(pipelines).toEqual([]);
  });

  it('saves and retrieves a pipeline', async () => {
    const result = await persistence.save(testPipeline);
    expect(result.valid).toBe(true);

    const retrieved = await persistence.get('test-pipe');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.name).toBe('Test Pipeline');
    expect(retrieved!.steps).toHaveLength(3);
  });

  it('lists saved pipelines', async () => {
    await persistence.save(testPipeline);
    await persistence.save({ ...testPipeline, id: 'second-pipe', name: 'Second' });

    const pipelines = await persistence.list();
    expect(pipelines).toHaveLength(2);
  });

  it('deletes a pipeline', async () => {
    await persistence.save(testPipeline);
    const deleted = await persistence.delete('test-pipe');
    expect(deleted).toBe(true);

    const retrieved = await persistence.get('test-pipe');
    expect(retrieved).toBeNull();
  });

  it('returns false when deleting non-existent pipeline', async () => {
    const deleted = await persistence.delete('nonexistent');
    expect(deleted).toBe(false);
  });

  it('rejects invalid pipeline on save', async () => {
    const invalid = { ...testPipeline, id: 'INVALID ID!' };
    const result = await persistence.save(invalid);
    expect(result.valid).toBe(false);
  });

  it('creates run directories', () => {
    const runDir = persistence.createRunDir('test-pipe', 'run-123');
    expect(fs.existsSync(runDir)).toBe(true);
  });

  it('saves and reads run metadata', () => {
    const runDir = persistence.createRunDir('test-pipe', 'run-456');
    const meta = { status: 'running', startedAt: new Date().toISOString() };
    persistence.saveRunMeta(runDir, meta);

    const loaded = persistence.getRunMeta(runDir);
    expect(loaded).not.toBeNull();
    expect((loaded as Record<string, unknown>).status).toBe('running');
  });

  it('lists runs for a pipeline', async () => {
    persistence.createRunDir('test-pipe', 'run-a');
    persistence.createRunDir('test-pipe', 'run-b');

    const runs = persistence.listRuns('test-pipe');
    expect(runs).toHaveLength(2);
  });
});
