#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { runCommand } from './commands/run';
import { listCommand } from './commands/list';
import { statusCommand } from './commands/status';
import { teamCommand } from './commands/team';
import { costCommand } from './commands/cost';
import { approveCommand } from './commands/approve';
import { scheduleCommand } from './commands/schedule';

yargs(hideBin(process.argv))
  .scriptName('commander')
  .usage('$0 <command> [options]')
  .command(runCommand)
  .command(listCommand)
  .command(statusCommand)
  .command(teamCommand)
  .command(costCommand)
  .command(approveCommand)
  .command(scheduleCommand)
  .demandCommand(1, 'You must specify a command')
  .help()
  .alias('h', 'help')
  .version('0.1.0')
  .alias('v', 'version')
  .strict()
  .parse();
