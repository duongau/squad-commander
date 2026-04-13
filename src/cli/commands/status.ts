import type { CommandModule } from 'yargs';
import { createCoreModules } from '../helpers';

export const statusCommand: CommandModule<object, { project?: string }> = {
  command: 'status',
  describe: 'Show current pipeline run status',
  builder: (yargs) =>
    yargs.option('project', { type: 'string', describe: 'Project path' }),
  handler: async (args) => {
    const { engine, persistence } = createCoreModules(args.project);
    const currentRun = engine.getCurrentRun();

    if (!currentRun) {
      console.log('No pipeline currently running.');

      // Show recent runs
      const pipelines = await persistence.list();
      let totalRuns = 0;
      for (const p of pipelines) {
        const runs = persistence.listRuns(p.id);
        totalRuns += runs.length;
      }
      console.log(`${pipelines.length} pipelines, ${totalRuns} total runs on record.`);
      return;
    }

    console.log(`🔄 Pipeline running: ${currentRun.pipelineId}`);
    console.log(`   Status: ${currentRun.status}`);
    console.log(`   Started: ${currentRun.startedAt}`);
    console.log(`   Steps:`);

    for (const step of currentRun.steps) {
      const statusIcons: Record<string, string> = {
        pending: '⏳',
        running: '🔄',
        completed: '✅',
        failed: '❌',
        skipped: '⏭️',
        cancelled: '🚫',
      };
      const icon = statusIcons[step.status] || '?';

      console.log(`     ${icon} ${step.stepId} — ${step.status}`);
    }
  },
};
