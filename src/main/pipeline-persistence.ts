import fs from 'fs';
import path from 'path';
import { PipelineSchema, type ValidationResult, validatePipeline } from '../shared/pipeline-schema';
import type { Pipeline } from '../shared/types';

/**
 * Pipeline Persistence — reads/writes pipeline JSON files in .squad/pipelines/.
 */
export class PipelinePersistence {
  private pipelinesDir: string;
  private runsDir: string;

  constructor(squadDir: string) {
    this.pipelinesDir = path.join(squadDir, 'pipelines');
    this.runsDir = path.join(squadDir, 'pipelines', 'runs');
  }

  /** Ensure pipelines directory exists */
  private ensureDir(): void {
    if (!fs.existsSync(this.pipelinesDir)) {
      fs.mkdirSync(this.pipelinesDir, { recursive: true });
    }
  }

  /** List all pipelines */
  async list(): Promise<Pipeline[]> {
    this.ensureDir();
    const files = fs.readdirSync(this.pipelinesDir).filter(
      (f) => f.endsWith('.json') && !f.includes('.runs.')
    );

    const pipelines: Pipeline[] = [];
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.pipelinesDir, file), 'utf-8');
        const data = JSON.parse(content);
        const result = PipelineSchema.safeParse(data);
        if (result.success) {
          pipelines.push(result.data as Pipeline);
        }
      } catch {
        // Skip invalid files
      }
    }
    return pipelines;
  }

  /** Get a pipeline by ID */
  async get(id: string): Promise<Pipeline | null> {
    const filePath = path.join(this.pipelinesDir, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;

    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const result = PipelineSchema.safeParse(data);
    return result.success ? (result.data as Pipeline) : null;
  }

  /** Save a pipeline */
  async save(pipeline: Pipeline): Promise<ValidationResult> {
    const validation = validatePipeline(pipeline);
    if (!validation.valid) return validation;

    this.ensureDir();

    // Update modified timestamp
    pipeline.metadata.modified = new Date().toISOString();

    const filePath = path.join(this.pipelinesDir, `${pipeline.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(pipeline, null, 2), 'utf-8');
    return { valid: true, errors: [] };
  }

  /** Delete a pipeline */
  async delete(id: string): Promise<boolean> {
    const filePath = path.join(this.pipelinesDir, `${id}.json`);
    if (!fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    return true;
  }

  /** Create a run directory for a pipeline execution */
  createRunDir(pipelineId: string, runId: string): string {
    const runDir = path.join(this.runsDir, pipelineId, runId);
    fs.mkdirSync(runDir, { recursive: true });
    return runDir;
  }

  /** Save run metadata */
  saveRunMeta(runDir: string, meta: unknown): void {
    fs.writeFileSync(
      path.join(runDir, 'run.json'),
      JSON.stringify(meta, null, 2),
      'utf-8'
    );
  }

  /** Read run metadata */
  getRunMeta(runDir: string): Record<string, unknown> | null {
    const metaPath = path.join(runDir, 'run.json');
    if (!fs.existsSync(metaPath)) return null;
    return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  }

  /** List run directories for a pipeline */
  listRuns(pipelineId: string): string[] {
    const pipelineRunsDir = path.join(this.runsDir, pipelineId);
    if (!fs.existsSync(pipelineRunsDir)) return [];
    return fs.readdirSync(pipelineRunsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .reverse(); // Most recent first
  }

  /** Load built-in templates from the templates/ directory */
  async getTemplates(templatesDir: string): Promise<Pipeline[]> {
    if (!fs.existsSync(templatesDir)) return [];

    const files = fs.readdirSync(templatesDir).filter((f) => f.endsWith('.json'));
    const templates: Pipeline[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(templatesDir, file), 'utf-8');
        const data = JSON.parse(content);
        const result = PipelineSchema.safeParse(data);
        if (result.success) {
          templates.push(result.data as Pipeline);
        }
      } catch {
        // Skip invalid templates
      }
    }
    return templates;
  }
}
