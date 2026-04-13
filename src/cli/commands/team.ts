import type { CommandModule } from 'yargs';
import { createCoreModules } from '../helpers';

export const teamCommand: CommandModule<object, { project?: string }> = {
  command: 'team',
  describe: 'Show Squad team roster',
  builder: (yargs) =>
    yargs.option('project', { type: 'string', describe: 'Project path' }),
  handler: async (args) => {
    const { bridge } = createCoreModules(args.project);

    const team = await bridge.getTeam();
    const agents = await bridge.getAgents();

    console.log(`⚔️ ${team.name || 'Squad Team'}`);
    if (team.description) console.log(`   ${team.description}`);
    console.log(`   ${agents.length} agents\n`);

    for (const agent of agents) {
      const status = agent.status === 'active' ? '●' : '○';
      console.log(`  ${status} ${agent.name} — ${agent.role}`);
      if (agent.description) console.log(`    ${agent.description}`);
    }
  },
};
