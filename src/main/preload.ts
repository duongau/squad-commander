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
  },

  // Events — renderer subscribes to main process events
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = [
      'squad:changed',
      'run:status',
      'run:output',
      'run:complete',
      'run:error',
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
