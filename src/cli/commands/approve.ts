import type { CommandModule } from 'yargs';
import { createCoreModules } from '../helpers';

export const approveCommand: CommandModule<object, { stepId: string; project?: string }> = {
  command: 'approve <stepId>',
  describe: 'Approve a pending approval gate',
  builder: (yargs) =>
    yargs
      .positional('stepId', { type: 'string', describe: 'Step ID of the gate to approve', demandOption: true })
      .option('project', { type: 'string', describe: 'Project path' }),
  handler: async (args) => {
    const { engine } = createCoreModules(args.project);

    const currentRun = engine.getCurrentRun();
    if (!currentRun) {
      console.log('No pipeline currently running.');
      process.exit(1);
    }

    engine.approveGate(args.stepId);
    console.log(`✅ Approved gate: ${args.stepId}`);
  },
};
