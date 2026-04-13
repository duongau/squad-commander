import type { CommandModule } from 'yargs';
import { createCoreModules } from '../helpers';
import fs from 'fs';
import path from 'path';

export const scheduleCommand: CommandModule<object, { project?: string }> = {
  command: 'schedule',
  describe: 'List scheduled pipelines',
  builder: (yargs) =>
    yargs.option('project', { type: 'string', describe: 'Project path' }),
  handler: async (args) => {
    const { squadDir } = createCoreModules(args.project);

    const schedulesPath = path.join(squadDir, 'schedules.json');
    if (!fs.existsSync(schedulesPath)) {
      console.log('No schedules configured.');
      return;
    }

    const data = JSON.parse(fs.readFileSync(schedulesPath, 'utf-8'));
    const schedules = data.schedules || [];

    if (schedules.length === 0) {
      console.log('No schedules configured.');
      return;
    }

    console.log('📅 Scheduled Pipelines:\n');
    for (const s of schedules) {
      const status = s.enabled ? '●' : '○';
      const lastRun = s.lastRun ? new Date(s.lastRun).toLocaleString() : 'never';
      const lastStatus = s.lastStatus ? ` (${s.lastStatus})` : '';

      console.log(`  ${status} ${s.pipelineId}`);
      console.log(`    Cron: ${s.cron} | Enabled: ${s.enabled}`);
      console.log(`    Last run: ${lastRun}${lastStatus}`);
      console.log('');
    }
  },
};
