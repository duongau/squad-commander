import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { resolveVariables } from '../shared/pipeline-schema';
import { ContextBuilder } from './context-builder';
import { RunnerRegistry } from './runner-registry';
import { PipelinePersistence } from './pipeline-persistence';
import type { Pipeline, PipelineStep } from '../shared/types';

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled';

export interface StepResult {
  stepId: string;
  status: StepStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number;
  outputFile: string | null;
  stdout: string;
  error: string | null;
  exitCode: number | null;
}

export interface PipelineRun {
  runId: string;
  pipelineId: string;
  pipelineVersion: number;
  startedAt: string;
  completedAt: string | null;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  triggeredBy: 'manual' | 'schedule';
  variables: Record<string, string>;
  steps: StepResult[];
}

/**
 * Pipeline Engine — executes pipeline steps following edges and branching logic.
 *
 * Events emitted:
 * - step:start (stepId)
 * - step:output (stepId, chunk)
 * - step:complete (stepId, StepResult)
 * - run:complete (PipelineRun)
 * - run:error (error)
 * - gate:waiting (stepId, message)
 */
export class PipelineEngine extends EventEmitter {
  private currentRun: PipelineRun | null = null;
  private paused = false;
  private cancelled = false;
  private gateResolvers = new Map<string, (approved: boolean) => void>();

  constructor(
    private contextBuilder: ContextBuilder,
    private runnerRegistry: RunnerRegistry,
    private persistence: PipelinePersistence,
    private projectPath: string
  ) {
    super();
  }

  /** Execute a pipeline with the given variables */
  async run(
    pipeline: Pipeline,
    variables: Record<string, string> = {},
    triggeredBy: 'manual' | 'schedule' = 'manual'
  ): Promise<PipelineRun> {
    const runId = randomUUID();
    const runDir = this.persistence.createRunDir(pipeline.id, runId);

    // Resolve default variable values
    const resolvedVars: Record<string, string> = {};
    for (const v of pipeline.variables) {
      resolvedVars[v.name] = variables[v.name] ?? v.default;
    }

    this.currentRun = {
      runId,
      pipelineId: pipeline.id,
      pipelineVersion: pipeline.version,
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: 'running',
      triggeredBy,
      variables: resolvedVars,
      steps: pipeline.steps.map((s) => ({
        stepId: s.id,
        status: 'pending' as StepStatus,
        startedAt: null,
        completedAt: null,
        durationMs: 0,
        outputFile: null,
        stdout: '',
        error: null,
        exitCode: null,
      })),
    };

    this.paused = false;
    this.cancelled = false;

    // Save initial run metadata
    this.persistence.saveRunMeta(runDir, this.currentRun);

    try {
      // Find start step and begin execution
      const startStep = pipeline.steps.find((s) => s.type === 'start');
      const firstStepId = startStep
        ? this.getNextStepId(pipeline, startStep.id)
        : pipeline.steps.find((s) => s.type === 'task')?.id;

      if (firstStepId) {
        await this.executeStep(pipeline, firstStepId, resolvedVars, runDir);
      }

      this.currentRun.status = this.cancelled ? 'cancelled' : 'completed';
    } catch (err) {
      this.currentRun.status = 'failed';
      this.emit('run:error', err);
    }

    this.currentRun.completedAt = new Date().toISOString();
    this.persistence.saveRunMeta(runDir, this.currentRun);
    this.emit('run:complete', this.currentRun);

    const result = this.currentRun;
    this.currentRun = null;
    return result;
  }

  /** Execute a single step and follow edges to the next */
  private async executeStep(
    pipeline: Pipeline,
    stepId: string,
    variables: Record<string, string>,
    runDir: string,
    priorOutput?: string
  ): Promise<void> {
    if (this.cancelled) return;

    const step = pipeline.steps.find((s) => s.id === stepId);
    if (!step) return;

    const stepResult = this.currentRun!.steps.find((s) => s.stepId === stepId);
    if (!stepResult) return;

    // Wait if paused
    while (this.paused && !this.cancelled) {
      await this.sleep(500);
    }
    if (this.cancelled) return;

    stepResult.status = 'running';
    stepResult.startedAt = new Date().toISOString();
    this.emit('step:start', stepId);

    try {
      switch (step.type) {
        case 'start':
        case 'end':
          stepResult.status = 'completed';
          break;

        case 'task':
          await this.executeTaskStep(step, stepResult, variables, runDir, priorOutput);
          break;

        case 'condition':
          await this.executeConditionStep(step, pipeline, variables, runDir, priorOutput);
          stepResult.status = 'completed';
          return; // Condition handles its own next step

        case 'router':
          await this.executeRouterStep(step, pipeline, variables, runDir, priorOutput);
          stepResult.status = 'completed';
          return; // Router handles its own next step

        case 'approval':
          await this.executeApprovalStep(step, stepResult);
          break;

        case 'parallel':
          await this.executeParallelStep(step, pipeline, variables, runDir, priorOutput);
          stepResult.status = 'completed';
          break;

        case 'loop':
          await this.executeLoopStep(step, pipeline, variables, runDir);
          stepResult.status = 'completed';
          break;

        case 'delay':
          await this.sleep(step.delayMs || 1000);
          stepResult.status = 'completed';
          break;
      }
    } catch (err) {
      stepResult.status = 'failed';
      stepResult.error = err instanceof Error ? err.message : String(err);
    }

    stepResult.completedAt = new Date().toISOString();
    stepResult.durationMs = stepResult.startedAt
      ? Date.now() - new Date(stepResult.startedAt).getTime()
      : 0;

    this.emit('step:complete', stepId, stepResult);
    if (this.currentRun) {
      this.persistence.saveRunMeta(runDir, this.currentRun);
    }

    // Follow edge to next step
    if (stepResult.status === 'completed' && step.type !== 'end') {
      const nextId = this.getNextStepId(pipeline, stepId);
      if (nextId) {
        const outputContent = stepResult.outputFile
          ? fs.readFileSync(path.join(runDir, stepResult.outputFile), 'utf-8')
          : stepResult.stdout;
        await this.executeStep(pipeline, nextId, variables, runDir, outputContent);
      }
    }
  }

  /** Execute a Task step — spawn agent runner */
  private async executeTaskStep(
    step: PipelineStep,
    result: StepResult,
    variables: Record<string, string>,
    runDir: string,
    priorOutput?: string
  ): Promise<void> {
    const resolvedPrompt = resolveVariables(step.prompt || '', variables);

    const contextPath = await this.contextBuilder.build({
      agent: step.agent || 'unknown',
      prompt: resolvedPrompt,
      priorOutput,
      includeDecisions: true,
      outputDir: runDir,
    });

    // Save context file reference
    const contextFileName = path.basename(contextPath);

    return new Promise<void>((resolve, reject) => {
      const runProcess = this.runnerRegistry.spawn(
        `${this.currentRun!.runId}-${step.id}`,
        step.agent || 'unknown',
        contextPath,
        step.engine,
        this.projectPath
      );

      let stdout = '';

      runProcess.process.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        this.emit('step:output', step.id, chunk);
      });

      runProcess.process.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        this.emit('step:output', step.id, chunk);
      });

      runProcess.process.on('exit', (code) => {
        result.exitCode = code;
        result.stdout = stdout;

        // Save stdout to log file
        const logFile = `stdout-${step.id}.log`;
        fs.writeFileSync(path.join(runDir, logFile), stdout, 'utf-8');

        // Save output file for context handoff
        const outputFile = `output-${step.id}.md`;
        fs.writeFileSync(path.join(runDir, outputFile), stdout, 'utf-8');
        result.outputFile = outputFile;

        if (code === 0) {
          result.status = 'completed';
          resolve();
        } else {
          result.status = 'failed';
          result.error = `Process exited with code ${code}`;
          reject(new Error(result.error));
        }
      });

      runProcess.process.on('error', (err) => {
        result.status = 'failed';
        result.error = err.message;
        reject(err);
      });

      // Handle timeout
      if (step.timeout) {
        setTimeout(() => {
          if (result.status === 'running') {
            this.runnerRegistry.cancel(`${this.currentRun!.runId}-${step.id}`);
            result.status = 'failed';
            result.error = `Step timed out after ${step.timeout}s`;
            reject(new Error(result.error));
          }
        }, step.timeout * 1000);
      }
    });
  }

  /** Execute a Condition step — evaluate and branch */
  private async executeConditionStep(
    step: PipelineStep,
    pipeline: Pipeline,
    variables: Record<string, string>,
    runDir: string,
    priorOutput?: string
  ): Promise<void> {
    const evalResult = this.evaluateCondition(step.eval || '', priorOutput);
    const nextId = evalResult ? step.trueTarget : step.falseTarget;

    if (nextId) {
      await this.executeStep(pipeline, nextId, variables, runDir, priorOutput);
    }
  }

  /** Execute a Router step — evaluate and pick from N routes */
  private async executeRouterStep(
    step: PipelineStep,
    pipeline: Pipeline,
    variables: Record<string, string>,
    runDir: string,
    priorOutput?: string
  ): Promise<void> {
    let targetId = step.defaultRoute;

    if (step.routes) {
      for (const route of step.routes) {
        if (this.evaluateCondition(route.match, priorOutput)) {
          targetId = route.target;
          break;
        }
      }
    }

    if (targetId) {
      await this.executeStep(pipeline, targetId, variables, runDir, priorOutput);
    }
  }

  /** Execute an Approval step — pause and wait for human */
  private async executeApprovalStep(
    step: PipelineStep,
    result: StepResult
  ): Promise<void> {
    this.emit('gate:waiting', step.id, step.message || 'Approval required');

    const approved = await new Promise<boolean>((resolve) => {
      this.gateResolvers.set(step.id, resolve);
    });

    this.gateResolvers.delete(step.id);

    if (!approved) {
      result.status = 'failed';
      result.error = 'Approval rejected';
      throw new Error('Approval rejected');
    }

    result.status = 'completed';
  }

  /** Execute a Parallel step — fan-out, then fan-in */
  private async executeParallelStep(
    step: PipelineStep,
    pipeline: Pipeline,
    variables: Record<string, string>,
    runDir: string,
    priorOutput?: string
  ): Promise<void> {
    if (!step.children) return;

    const promises = step.children.map((childId) =>
      this.executeStep(pipeline, childId, variables, runDir, priorOutput)
        .then(() => true)
        .catch(() => false)
    );

    const results = await Promise.all(promises);
    const fanIn = step.fanIn || 'all';

    if (fanIn === 'all' && results.some((r) => !r)) {
      throw new Error('Parallel step: not all children completed successfully');
    }
    if (fanIn === 'majority' && results.filter((r) => r).length <= results.length / 2) {
      throw new Error('Parallel step: majority of children failed');
    }
    // 'first' always succeeds if at least one child succeeded
  }

  /** Execute a Loop step — repeat until condition or max iterations */
  private async executeLoopStep(
    step: PipelineStep,
    pipeline: Pipeline,
    variables: Record<string, string>,
    runDir: string
  ): Promise<void> {
    const maxIter = step.maxIterations || 5;
    let iteration = 0;

    while (iteration < maxIter && !this.cancelled) {
      iteration++;

      // Execute body steps sequentially
      for (const bodyStepId of step.body || []) {
        await this.executeStep(pipeline, bodyStepId, variables, runDir);
      }

      // Check loop condition
      if (step.condition) {
        const lastBodyStepId = step.body?.[step.body.length - 1];
        const lastResult = this.currentRun?.steps.find((s) => s.stepId === lastBodyStepId);
        if (this.evaluateCondition(step.condition, lastResult?.stdout)) {
          break; // Condition met, exit loop
        }
      }
    }
  }

  /** Evaluate a simple condition expression */
  private evaluateCondition(expression: string, output?: string): boolean {
    // Handle step.{id}.success pattern
    const successMatch = expression.match(/^step\.(\w+)\.success$/);
    if (successMatch) {
      const stepResult = this.currentRun?.steps.find((s) => s.stepId === successMatch[1]);
      return stepResult?.status === 'completed';
    }

    // Handle step.{id}.success === true/false
    const boolMatch = expression.match(/^step\.(\w+)\.success\s*===\s*(true|false)$/);
    if (boolMatch) {
      const stepResult = this.currentRun?.steps.find((s) => s.stepId === boolMatch[1]);
      const isSuccess = stepResult?.status === 'completed';
      return boolMatch[2] === 'true' ? isSuccess : !isSuccess;
    }

    // Handle output.contains("text")
    const containsMatch = expression.match(/output\.contains\("([^"]+)"\)/);
    if (containsMatch) {
      return (output || '').includes(containsMatch[1]);
    }

    // Handle simple "contains" for router routes
    if (output && expression.includes('contains')) {
      const textMatch = expression.match(/contains\("([^"]+)"\)/);
      if (textMatch) {
        return output.includes(textMatch[1]);
      }
    }

    // Default: truthy check
    return Boolean(expression);
  }

  /** Get the next step ID by following edges */
  private getNextStepId(pipeline: Pipeline, currentStepId: string): string | undefined {
    const edge = pipeline.edges.find((e) => e.source === currentStepId);
    return edge?.target;
  }

  /** Approve a pending gate */
  approveGate(stepId: string): void {
    const resolver = this.gateResolvers.get(stepId);
    if (resolver) resolver(true);
  }

  /** Reject a pending gate */
  rejectGate(stepId: string): void {
    const resolver = this.gateResolvers.get(stepId);
    if (resolver) resolver(false);
  }

  /** Pause the current run */
  pause(): void {
    this.paused = true;
    if (this.currentRun) this.currentRun.status = 'paused';
  }

  /** Resume the current run */
  resume(): void {
    this.paused = false;
    if (this.currentRun) this.currentRun.status = 'running';
  }

  /** Cancel the current run */
  cancel(): void {
    this.cancelled = true;
    if (this.currentRun) this.currentRun.status = 'cancelled';
  }

  /** Get the current run state */
  getCurrentRun(): PipelineRun | null {
    return this.currentRun;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
