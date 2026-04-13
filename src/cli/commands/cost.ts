import type { CommandModule } from 'yargs';
import { createCoreModules } from '../helpers';

export const costCommand: CommandModule<object, { project?: string; period?: string }> = {
  command: 'cost',
  describe: 'Show token usage and cost summary',
  builder: (yargs) =>
    yargs
      .option('project', { type: 'string', describe: 'Project path' })
      .option('period', { type: 'string', describe: 'Time period (7d, 30d)', default: '7d' }),
  handler: async (args) => {
    const { costTracker } = createCoreModules(args.project);

    const history = costTracker.getHistory();
    const daily = costTracker.getDailyUsage();
    const config = costTracker.getConfig();

    console.log('💰 Cost Summary\n');
    console.log(`  Budget mode: ${config.mode}`);
    console.log(`  Pipeline budget: ${config.pipelineBudgetTokens?.toLocaleString() || 'unlimited'} tokens`);
    console.log(`  Daily budget: ${config.globalDailyTokens?.toLocaleString() || 'unlimited'} tokens`);
    console.log(`  Today: ${daily.tokens.toLocaleString()} tokens used`);
    console.log('');

    if (history.length === 0) {
      console.log('  No cost history recorded yet.');
      return;
    }

    console.log('  Recent runs:');
    for (const h of history.slice(-10)) {
      console.log(`    ${h.pipelineName} — ${h.totalTokens.toLocaleString()} tokens ($${h.estimatedCost.toFixed(4)}) — ${new Date(h.completedAt).toLocaleDateString()}`);
    }

    const totalTokens = history.reduce((sum: number, h: { totalTokens: number }) => sum + h.totalTokens, 0);
    const totalCost = history.reduce((sum: number, h: { estimatedCost: number }) => sum + h.estimatedCost, 0);
    console.log(`\n  Total: ${totalTokens.toLocaleString()} tokens ($${totalCost.toFixed(4)}) across ${history.length} runs`);
  },
};
