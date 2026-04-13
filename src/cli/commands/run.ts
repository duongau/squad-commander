import type { CommandModule } from 'yargs';
import { createCoreModules } from '../helpers';

interface RunArgs {
  pipeline: string;
  var?: string[];
  project?: string;
}

export const runCommand: CommandModule<object, RunArgs> = {
  command: 'run <pipeline>',
  describe: 'Run a pipeline by ID',
  builder: (yargs) =>
    yargs
      .positional('pipeline', { type: 'string', describe: 'Pipeline ID', demandOption: true })
      .option('var', { type: 'array', string: true, describe: 'Variables as key=value pairs' })
      .option('project', { type: 'string', describe: 'Project path (defaults to cwd)' }),
  handler: async (args) => {
    const { persistence, engine } = createCoreModules(args.project);

    // Parse variables
    const variables: Record<string, string> = {};
    if (args.var) {
      for (const v of args.var) {
        const [key, ...rest] = v.split('=');
        if (key) variables[key] = rest.join('=');
      }
    }

    // Load pipeline
    const pipeline = await persistence.get(args.pipeline);
    if (!pipeline) {
      console.error(`Pipeline "${args.pipeline}" not found`);
      process.exit(1);
    }

    console.log(`▶ Running pipeline: ${pipeline.name}`);
    if (Object.keys(variables).length > 0) {
      console.log(`  Variables: ${Object.entries(variables).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    }
    console.log('');

    // Wire engine events to stdout
    engine.on('step:start', (stepId: string) => {
      console.log(`  🔄 ${stepId} — started`);
    });

    engine.on('step:output', (_stepId: string, chunk: string) => {
      process.stdout.write(chunk);
    });

    engine.on('step:complete', (stepId: string, result: { status: string; durationMs: number }) => {
      const icon = result.status === 'completed' ? '✅' : '❌';
      console.log(`  ${icon} ${stepId} — ${result.status} (${Math.round(result.durationMs / 1000)}s)`);
    });

    try {
      const run = await engine.run(pipeline, variables, 'manual');
      console.log('');

      if (run.status === 'completed') {
        console.log('✅ Pipeline completed successfully');
        process.exit(0);
      } else {
        console.log(`❌ Pipeline ${run.status}`);
        process.exit(1);
      }
    } catch (err) {
      console.error(`❌ Pipeline failed: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  },
};
