import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { resolveProjectPath, createCoreModules } from '../../src/cli/helpers';

describe('CLI Helpers', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-test-'));
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('resolveProjectPath', () => {
    it('finds .squad/ in current directory', () => {
      fs.mkdirSync(path.join(tmpDir, '.squad'), { recursive: true });
      process.chdir(tmpDir);
      const result = resolveProjectPath();
      expect(result).toBe(tmpDir);
    });

    it('finds .squad/ in parent directory', () => {
      fs.mkdirSync(path.join(tmpDir, '.squad'), { recursive: true });
      const childDir = path.join(tmpDir, 'src', 'deep');
      fs.mkdirSync(childDir, { recursive: true });
      process.chdir(childDir);
      const result = resolveProjectPath();
      expect(result).toBe(tmpDir);
    });

    it('falls back to cwd when no .squad/ found', () => {
      process.chdir(tmpDir);
      const result = resolveProjectPath();
      expect(result).toBe(tmpDir);
    });
  });

  describe('createCoreModules', () => {
    it('creates all core modules for a valid project', () => {
      const squadDir = path.join(tmpDir, '.squad');
      fs.mkdirSync(path.join(squadDir, 'agents'), { recursive: true });
      fs.mkdirSync(path.join(squadDir, 'pipelines'), { recursive: true });

      const modules = createCoreModules(tmpDir);
      expect(modules.bridge).toBeDefined();
      expect(modules.contextBuilder).toBeDefined();
      expect(modules.runnerRegistry).toBeDefined();
      expect(modules.persistence).toBeDefined();
      expect(modules.engine).toBeDefined();
      expect(modules.costTracker).toBeDefined();
      expect(modules.project).toBe(tmpDir);
    });
  });
});

describe('CLI Command Structures', () => {
  it('run command has correct structure', async () => {
    const { runCommand } = await import('../../src/cli/commands/run');
    expect(runCommand.command).toBe('run <pipeline>');
    expect(runCommand.describe).toContain('Run');
    expect(runCommand.handler).toBeTypeOf('function');
  });

  it('list command has correct structure', async () => {
    const { listCommand } = await import('../../src/cli/commands/list');
    expect(listCommand.command).toBe('list');
    expect(listCommand.handler).toBeTypeOf('function');
  });

  it('status command has correct structure', async () => {
    const { statusCommand } = await import('../../src/cli/commands/status');
    expect(statusCommand.command).toBe('status');
    expect(statusCommand.handler).toBeTypeOf('function');
  });

  it('team command has correct structure', async () => {
    const { teamCommand } = await import('../../src/cli/commands/team');
    expect(teamCommand.command).toBe('team');
    expect(teamCommand.handler).toBeTypeOf('function');
  });

  it('cost command has correct structure', async () => {
    const { costCommand } = await import('../../src/cli/commands/cost');
    expect(costCommand.command).toBe('cost');
    expect(costCommand.handler).toBeTypeOf('function');
  });

  it('approve command has correct structure', async () => {
    const { approveCommand } = await import('../../src/cli/commands/approve');
    expect(approveCommand.command).toBe('approve <stepId>');
    expect(approveCommand.handler).toBeTypeOf('function');
  });

  it('schedule command has correct structure', async () => {
    const { scheduleCommand } = await import('../../src/cli/commands/schedule');
    expect(scheduleCommand.command).toBe('schedule');
    expect(scheduleCommand.handler).toBeTypeOf('function');
  });
});
