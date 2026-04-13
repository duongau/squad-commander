import { z } from 'zod';

// ─── Step Type Schemas ───────────────────────────────────────────────────────

const StepTypeEnum = z.enum([
  'start',
  'end',
  'task',
  'condition',
  'router',
  'approval',
  'parallel',
  'loop',
  'delay',
]);

const RouteSchema = z.object({
  label: z.string().min(1),
  match: z.string().min(1),
  target: z.string().min(1),
});

const PipelineStepSchema = z
  .object({
    id: z.string().min(1),
    type: StepTypeEnum,
    // Task fields
    agent: z.string().optional(),
    engine: z.string().optional(),
    prompt: z.string().optional(),
    timeout: z.number().positive().optional(),
    successCriteria: z.string().optional(),
    // Condition fields
    eval: z.string().optional(),
    trueTarget: z.string().optional(),
    falseTarget: z.string().optional(),
    // Router fields
    routes: z.array(RouteSchema).optional(),
    defaultRoute: z.string().optional(),
    // Approval fields
    message: z.string().optional(),
    // Parallel fields
    children: z.array(z.string()).optional(),
    fanIn: z.enum(['all', 'first', 'majority']).optional(),
    // Loop fields
    body: z.array(z.string()).optional(),
    condition: z.string().optional(),
    maxIterations: z.number().int().min(1).max(100).optional(),
    // Delay fields
    delayMs: z.number().positive().optional(),
  })
  .superRefine((step, ctx) => {
    // Validate required fields per step type
    if (step.type === 'task') {
      if (!step.agent) {
        ctx.addIssue({ code: 'custom', message: 'Task step requires an agent', path: ['agent'] });
      }
      if (!step.prompt) {
        ctx.addIssue({ code: 'custom', message: 'Task step requires a prompt', path: ['prompt'] });
      }
    }

    if (step.type === 'condition') {
      if (!step.eval) {
        ctx.addIssue({ code: 'custom', message: 'Condition step requires an eval expression', path: ['eval'] });
      }
      if (!step.trueTarget) {
        ctx.addIssue({ code: 'custom', message: 'Condition step requires a trueTarget', path: ['trueTarget'] });
      }
      if (!step.falseTarget) {
        ctx.addIssue({ code: 'custom', message: 'Condition step requires a falseTarget', path: ['falseTarget'] });
      }
    }

    if (step.type === 'router') {
      if (!step.routes || step.routes.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'Router step requires at least one route', path: ['routes'] });
      }
    }

    if (step.type === 'approval') {
      if (!step.message) {
        ctx.addIssue({ code: 'custom', message: 'Approval step requires a message', path: ['message'] });
      }
    }

    if (step.type === 'parallel') {
      if (!step.children || step.children.length < 2) {
        ctx.addIssue({ code: 'custom', message: 'Parallel step requires at least 2 children', path: ['children'] });
      }
    }

    if (step.type === 'loop') {
      if (!step.body || step.body.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'Loop step requires at least one body step', path: ['body'] });
      }
      if (!step.condition) {
        ctx.addIssue({ code: 'custom', message: 'Loop step requires a condition', path: ['condition'] });
      }
      if (!step.maxIterations) {
        ctx.addIssue({ code: 'custom', message: 'Loop step requires maxIterations for safety', path: ['maxIterations'] });
      }
    }

    if (step.type === 'delay') {
      if (!step.delayMs) {
        ctx.addIssue({ code: 'custom', message: 'Delay step requires delayMs', path: ['delayMs'] });
      }
    }
  });

// ─── Pipeline Variable Schema ────────────────────────────────────────────────

const PipelineVariableSchema = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z_]\w*$/, 'Variable name must be a valid identifier'),
  type: z.enum(['string', 'number', 'boolean']),
  required: z.boolean(),
  default: z.string(),
});

// ─── Edge Schema ─────────────────────────────────────────────────────────────

const EdgeSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
});

// ─── Pipeline Metadata Schema ────────────────────────────────────────────────

const PipelineMetadataSchema = z.object({
  created: z.string(),
  modified: z.string(),
  tags: z.array(z.string()),
  template: z.boolean(),
});

// ─── Full Pipeline Schema ────────────────────────────────────────────────────

export const PipelineSchema = z
  .object({
    id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Pipeline ID must be kebab-case'),
    name: z.string().min(1),
    description: z.string(),
    version: z.number().int().positive(),
    variables: z.array(PipelineVariableSchema),
    steps: z.array(PipelineStepSchema).min(1),
    edges: z.array(EdgeSchema),
    metadata: PipelineMetadataSchema,
  })
  .superRefine((pipeline, ctx) => {
    const stepIds = new Set(pipeline.steps.map((s) => s.id));

    // Validate that all edge references exist
    for (const edge of pipeline.edges) {
      if (!stepIds.has(edge.source)) {
        ctx.addIssue({
          code: 'custom',
          message: `Edge source "${edge.source}" references non-existent step`,
          path: ['edges'],
        });
      }
      if (!stepIds.has(edge.target)) {
        ctx.addIssue({
          code: 'custom',
          message: `Edge target "${edge.target}" references non-existent step`,
          path: ['edges'],
        });
      }
    }

    // Validate condition/router targets exist
    for (const step of pipeline.steps) {
      if (step.type === 'condition') {
        if (step.trueTarget && !stepIds.has(step.trueTarget)) {
          ctx.addIssue({
            code: 'custom',
            message: `Condition trueTarget "${step.trueTarget}" not found`,
            path: ['steps'],
          });
        }
        if (step.falseTarget && !stepIds.has(step.falseTarget)) {
          ctx.addIssue({
            code: 'custom',
            message: `Condition falseTarget "${step.falseTarget}" not found`,
            path: ['steps'],
          });
        }
      }

      if (step.type === 'router' && step.routes) {
        for (const route of step.routes) {
          if (!stepIds.has(route.target)) {
            ctx.addIssue({
              code: 'custom',
              message: `Router route target "${route.target}" not found`,
              path: ['steps'],
            });
          }
        }
      }

      if (step.type === 'parallel' && step.children) {
        for (const child of step.children) {
          if (!stepIds.has(child)) {
            ctx.addIssue({
              code: 'custom',
              message: `Parallel child "${child}" not found`,
              path: ['steps'],
            });
          }
        }
      }

      if (step.type === 'loop' && step.body) {
        for (const bodyStep of step.body) {
          if (!stepIds.has(bodyStep)) {
            ctx.addIssue({
              code: 'custom',
              message: `Loop body step "${bodyStep}" not found`,
              path: ['steps'],
            });
          }
        }
      }
    }

    // Validate variable references in prompts
    const varNames = new Set(pipeline.variables.map((v) => v.name));
    const varRefPattern = /\{\{(\w+)\}\}/g;
    for (const step of pipeline.steps) {
      if (step.prompt) {
        let match;
        while ((match = varRefPattern.exec(step.prompt)) !== null) {
          if (!varNames.has(match[1])) {
            ctx.addIssue({
              code: 'custom',
              message: `Variable "{{${match[1]}}}" in step "${step.id}" is not defined`,
              path: ['steps'],
            });
          }
        }
      }
    }

    // Check for duplicate step IDs
    const seen = new Set<string>();
    for (const step of pipeline.steps) {
      if (seen.has(step.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate step ID: "${step.id}"`,
          path: ['steps'],
        });
      }
      seen.add(step.id);
    }
  });

// ─── Type Exports ────────────────────────────────────────────────────────────

export type PipelineZ = z.infer<typeof PipelineSchema>;
export type PipelineStepZ = z.infer<typeof PipelineStepSchema>;
export type PipelineVariableZ = z.infer<typeof PipelineVariableSchema>;

// ─── Validation Helper ───────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
}

export function validatePipeline(data: unknown): ValidationResult {
  const result = PipelineSchema.safeParse(data);
  if (result.success) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

// ─── Variable Resolution ─────────────────────────────────────────────────────

/** Resolve {{variable}} references in a string */
export function resolveVariables(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name) => {
    return variables[name] ?? match;
  });
}
