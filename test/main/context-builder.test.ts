import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SquadBridge } from '../../src/main/squad-bridge';
import { ContextBuilder } from '../../src/main/context-builder';

describe('ContextBuilder', () => {
  let tmpDir: string;
  let bridge: SquadBridge;
  let builder: ContextBuilder;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'context-test-'));
    const squadDir = path.join(tmpDir, '.squad');
    fs.mkdirSync(path.join(squadDir, 'agents', 'keaton'), { recursive: true });

    // Create a test charter
    fs.writeFileSync(
      path.join(squadDir, 'agents', 'keaton', 'charter.md'),
      '---\nrole: Lead\n---\n# Keaton\nThe architect.'
    );

    // Create decisions
    fs.writeFileSync(
      path.join(squadDir, 'decisions.md'),
      '## Use strict TypeScript\n@keaton decided strict mode.\n'
    );

    bridge = new SquadBridge(tmpDir);
    builder = new ContextBuilder(bridge);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates a context file with charter and prompt', async () => {
    const contextPath = await builder.build({
      agent: 'keaton',
      prompt: 'Analyze the architecture',
      outputDir: path.join(tmpDir, 'output'),
    });

    expect(fs.existsSync(contextPath)).toBe(true);

    const content = fs.readFileSync(contextPath, 'utf-8');
    expect(content).toContain('# Agent Charter');
    expect(content).toContain('Keaton');
    expect(content).toContain('# Objective');
    expect(content).toContain('Analyze the architecture');
  });

  it('includes decisions when requested', async () => {
    const contextPath = await builder.build({
      agent: 'keaton',
      prompt: 'Review code',
      includeDecisions: true,
      outputDir: path.join(tmpDir, 'output'),
    });

    const content = fs.readFileSync(contextPath, 'utf-8');
    expect(content).toContain('# Recent Team Decisions');
    expect(content).toContain('strict TypeScript');
  });

  it('excludes decisions when disabled', async () => {
    const contextPath = await builder.build({
      agent: 'keaton',
      prompt: 'Quick task',
      includeDecisions: false,
      outputDir: path.join(tmpDir, 'output'),
    });

    const content = fs.readFileSync(contextPath, 'utf-8');
    expect(content).not.toContain('# Recent Team Decisions');
  });

  it('includes prior output when provided', async () => {
    const contextPath = await builder.build({
      agent: 'keaton',
      prompt: 'Continue from here',
      priorOutput: 'Previous agent found 3 bugs.',
      outputDir: path.join(tmpDir, 'output'),
    });

    const content = fs.readFileSync(contextPath, 'utf-8');
    expect(content).toContain('# Context from Previous Step');
    expect(content).toContain('3 bugs');
  });

  it('handles missing agent gracefully', async () => {
    const contextPath = await builder.build({
      agent: 'nonexistent',
      prompt: 'Do something',
      outputDir: path.join(tmpDir, 'output'),
    });

    const content = fs.readFileSync(contextPath, 'utf-8');
    expect(content).toContain('No charter found');
    expect(content).toContain('# Objective');
  });

  it('includes output instructions', async () => {
    const contextPath = await builder.build({
      agent: 'keaton',
      prompt: 'Test',
      outputDir: path.join(tmpDir, 'output'),
    });

    const content = fs.readFileSync(contextPath, 'utf-8');
    expect(content).toContain('# Output Instructions');
  });
});
