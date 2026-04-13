// IPC channel name constants — single source of truth for main ↔ renderer communication

export const IPC = {
  // Squad state
  SQUAD_GET_TEAM: 'squad:getTeam',
  SQUAD_GET_AGENTS: 'squad:getAgents',
  SQUAD_GET_ROUTING: 'squad:getRouting',
  SQUAD_GET_DECISIONS: 'squad:getDecisions',
  SQUAD_UPDATE_AGENT: 'squad:updateAgent',
  SQUAD_CREATE_AGENT: 'squad:createAgent',
  SQUAD_DELETE_AGENT: 'squad:deleteAgent',
  SQUAD_REPARENT_AGENT: 'squad:reparentAgent',

  // Quick Run
  QUICK_RUN_EXECUTE: 'quickRun:execute',
  QUICK_RUN_CANCEL: 'quickRun:cancel',

  // Runners
  RUNNERS_LIST: 'runners:list',
  RUNNERS_DETECT: 'runners:detect',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',

  // Events (main → renderer)
  SQUAD_CHANGED: 'squad:changed',
  RUN_STATUS: 'run:status',
  RUN_OUTPUT: 'run:output',
  RUN_COMPLETE: 'run:complete',
  RUN_ERROR: 'run:error',
} as const;
