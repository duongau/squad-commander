import { contextBridge, ipcRenderer } from 'electron';

// Expose a typed API to the renderer via contextBridge
// No nodeIntegration — all Node.js access goes through here
contextBridge.exposeInMainWorld('commander', {
  // Squad state
  squad: {
    getTeam: () => ipcRenderer.invoke('squad:getTeam'),
    getAgents: () => ipcRenderer.invoke('squad:getAgents'),
    getRouting: () => ipcRenderer.invoke('squad:getRouting'),
    getDecisions: () => ipcRenderer.invoke('squad:getDecisions'),
    updateAgent: (name: string, charter: string) =>
      ipcRenderer.invoke('squad:updateAgent', name, charter),
    createAgent: (config: unknown) =>
      ipcRenderer.invoke('squad:createAgent', config),
    deleteAgent: (name: string) =>
      ipcRenderer.invoke('squad:deleteAgent', name),
    reparentAgent: (name: string, newParent: string) =>
      ipcRenderer.invoke('squad:reparentAgent', name, newParent),
  },

  // Quick Run
  quickRun: {
    execute: (agent: string, prompt: string) =>
      ipcRenderer.invoke('quickRun:execute', agent, prompt),
    cancel: (runId: string) => ipcRenderer.invoke('quickRun:cancel', runId),
  },

  // Runners
  runners: {
    list: () => ipcRenderer.invoke('runners:list'),
    detect: () => ipcRenderer.invoke('runners:detect'),
  },

  // Settings
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (settings: unknown) =>
      ipcRenderer.invoke('settings:update', settings),
    openProject: () => ipcRenderer.invoke('dialog:openProject'),
  },

  // Pipelines
  pipelines: {
    list: () => ipcRenderer.invoke('pipelines:list'),
    get: (id: string) => ipcRenderer.invoke('pipelines:get', id),
    save: (pipeline: unknown) => ipcRenderer.invoke('pipelines:save', pipeline),
    delete: (id: string) => ipcRenderer.invoke('pipelines:delete', id),
    validate: (pipeline: unknown) => ipcRenderer.invoke('pipelines:validate', pipeline),
    run: (id: string, variables?: Record<string, string>) =>
      ipcRenderer.invoke('pipelines:run', id, variables),
    pause: () => ipcRenderer.invoke('pipelines:pause'),
    resume: () => ipcRenderer.invoke('pipelines:resume'),
    cancel: () => ipcRenderer.invoke('pipelines:cancel'),
    approveGate: (stepId: string) => ipcRenderer.invoke('pipelines:approveGate', stepId),
    rejectGate: (stepId: string) => ipcRenderer.invoke('pipelines:rejectGate', stepId),
    getRunHistory: (pipelineId: string) =>
      ipcRenderer.invoke('pipelines:getRunHistory', pipelineId),
    getTemplates: () => ipcRenderer.invoke('pipelines:getTemplates'),
  },

  // Schedules
  schedules: {
    list: () => ipcRenderer.invoke('schedules:list'),
    create: (config: unknown) => ipcRenderer.invoke('schedules:create', config),
    update: (id: string, updates: unknown) => ipcRenderer.invoke('schedules:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('schedules:delete', id),
    toggle: (id: string, enabled: boolean) => ipcRenderer.invoke('schedules:toggle', id, enabled),
  },

  // Telemetry & Dashboard
  telemetry: {
    getAgentMetrics: () => ipcRenderer.invoke('telemetry:getAgentMetrics'),
    getTeamStats: () => ipcRenderer.invoke('telemetry:getTeamStats'),
    getLiveLog: (limit?: number) => ipcRenderer.invoke('telemetry:getLiveLog', limit),
  },

  // Ralph
  ralph: {
    getStatus: () => ipcRenderer.invoke('ralph:getStatus'),
    start: (options?: unknown) => ipcRenderer.invoke('ralph:start', options),
    stop: () => ipcRenderer.invoke('ralph:stop'),
  },

  // Export/Import
  exportImport: {
    export: (outputPath: string) => ipcRenderer.invoke('export:export', outputPath),
    import: (inputPath: string, mode?: string) => ipcRenderer.invoke('export:import', inputPath, mode),
  },

  // Cost Tracking
  costs: {
    getCurrentRun: () => ipcRenderer.invoke('costs:getCurrentRun'),
    getHistory: () => ipcRenderer.invoke('costs:getHistory'),
    getConfig: () => ipcRenderer.invoke('costs:getConfig'),
    updateConfig: (updates: unknown) => ipcRenderer.invoke('costs:updateConfig', updates),
    setBudget: (tokens: number) => ipcRenderer.invoke('costs:setBudget', tokens),
    getDailyUsage: () => ipcRenderer.invoke('costs:getDailyUsage'),
  },

  // MCP Connector
  mcp: {
    list: () => ipcRenderer.invoke('mcp:list'),
    add: (config: unknown) => ipcRenderer.invoke('mcp:add', config),
    remove: (name: string) => ipcRenderer.invoke('mcp:remove', name),
    toggle: (name: string, enabled: boolean) => ipcRenderer.invoke('mcp:toggle', name, enabled),
    discover: () => ipcRenderer.invoke('mcp:discover'),
  },

  // Webhooks
  webhooks: {
    start: () => ipcRenderer.invoke('webhooks:start'),
    stop: () => ipcRenderer.invoke('webhooks:stop'),
    isRunning: () => ipcRenderer.invoke('webhooks:isRunning'),
    createEndpoint: (pipelineId: string, variables?: Record<string, string>) =>
      ipcRenderer.invoke('webhooks:createEndpoint', pipelineId, variables),
    deleteEndpoint: (id: string) => ipcRenderer.invoke('webhooks:deleteEndpoint', id),
    listEndpoints: () => ipcRenderer.invoke('webhooks:listEndpoints'),
  },

  // Notification Channels
  channels: {
    list: () => ipcRenderer.invoke('channels:list'),
    add: (config: unknown) => ipcRenderer.invoke('channels:add', config),
    remove: (id: string) => ipcRenderer.invoke('channels:remove', id),
    toggle: (id: string, enabled: boolean) => ipcRenderer.invoke('channels:toggle', id, enabled),
    getRouting: () => ipcRenderer.invoke('channels:getRouting'),
    setRouting: (routing: unknown) => ipcRenderer.invoke('channels:setRouting', routing),
    test: (channelId: string) => ipcRenderer.invoke('channels:test', channelId),
  },

  // Events — renderer subscribes to main process events
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = [
      'squad:changed',
      'run:status',
      'run:output',
      'run:complete',
      'run:error',
      'schedule:event',
      'cost:update',
      'cost:budget-exceeded',
    ];
    if (validChannels.includes(channel)) {
      const listener = (_event: unknown, ...args: unknown[]) =>
        callback(...args);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    }
    return () => {};
  },
});
