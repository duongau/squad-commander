import type { CommandModule } from 'yargs';
import { createCoreModules } from '../helpers';

export const listCommand: CommandModule<object, { project?: string }> = {
  command: 'list',
  describe: 'List available pipelines',
  builder: (yargs) =>
    yargs.option('project', { type: 'string', describe: 'Project path' }),
  handler: async (args) => {
    const { persistence } = createCoreModules(args.project);
    const pipelines = await persistence.list();

    if (pipelines.length === 0) {
      console.log('No pipelines found in .squad/pipelines/');
      return;
    }

    console.log('📋 Available Pipelines:\n');
    for (const p of pipelines) {
      const vars = p.variables.length > 0
        ? ` (vars: ${p.variables.map((v: { name: string }) => v.name).join(', ')})`
        : '';
      console.log(`  ${p.id}`);
      console.log(`    ${p.name} — ${p.steps.length} steps${vars}`);
      if (p.description) console.log(`    ${p.description}`);
      console.log('');
    }
  },
};
