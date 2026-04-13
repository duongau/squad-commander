import path from 'path';
import fs from 'fs';
import { SquadBridge } from '../main/squad-bridge';
import { ContextBuilder } from '../main/context-builder';
import { RunnerRegistry } from '../main/runner-registry';
import { PipelinePersistence } from '../main/pipeline-persistence';
import { PipelineEngine } from '../main/pipeline-engine';
import { CostTracker } from '../main/cost-tracker';

/** Resolve the project path — walks up from cwd looking for .squad/ */
export function resolveProjectPath(): string {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.squad'))) return dir;
    dir = path.dirname(dir);
  }
  // Fall back to cwd
  return process.cwd();
}

/** Create all core modules for CLI usage (no Electron) */
export function createCoreModules(projectPath?: string) {
  const project = projectPath || resolveProjectPath();
  const squadDir = path.join(project, '.squad');

  if (!fs.existsSync(squadDir)) {
    console.error(`Error: No .squad/ directory found at ${project}`);
    console.error('Run this command from a Squad project directory, or use --project <path>');
    process.exit(1);
  }

  const bridge = new SquadBridge(project);
  const contextBuilder = new ContextBuilder(bridge);
  const runnerRegistry = new RunnerRegistry();
  const persistence = new PipelinePersistence(squadDir);
  const engine = new PipelineEngine(contextBuilder, runnerRegistry, persistence, project);
  const costTracker = new CostTracker();

  return { bridge, contextBuilder, runnerRegistry, persistence, engine, costTracker, project, squadDir };
}
