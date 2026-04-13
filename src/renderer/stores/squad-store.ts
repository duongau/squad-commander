import { create } from 'zustand';
import type { Agent, Team, Routing, Decision } from '../../shared/types';

// Type for the Commander API exposed via preload
declare global {
  interface Window {
    commander: {
      squad: {
        getTeam: () => Promise<Team>;
        getAgents: () => Promise<Agent[]>;
        getRouting: () => Promise<Routing>;
        getDecisions: () => Promise<Decision[]>;
        updateAgent: (name: string, charter: string) => Promise<void>;
        createAgent: (config: { name: string; role: string; description: string }) => Promise<void>;
        deleteAgent: (name: string) => Promise<void>;
        reparentAgent: (name: string, newParent: string) => Promise<void>;
      };
      quickRun: {
        execute: (agent: string, prompt: string) => Promise<{ runId: string; agent: string; status: string }>;
        cancel: (runId: string) => Promise<boolean>;
      };
      runners: {
        list: () => Promise<unknown[]>;
        detect: () => Promise<unknown[]>;
      };
      settings: {
        get: () => Promise<unknown>;
        update: (settings: unknown) => Promise<void>;
        openProject: () => Promise<string | null>;
      };
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
    };
  }
}

interface SquadState {
  // Data
  team: Team | null;
  agents: Agent[];
  routing: Routing | null;
  decisions: Decision[];
  projectPath: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  loadProject: (projectPath?: string) => Promise<void>;
  openProject: () => Promise<void>;
  refresh: () => Promise<void>;
  updateAgent: (name: string, charter: string) => Promise<void>;
  createAgent: (config: { name: string; role: string; description: string }) => Promise<void>;
  deleteAgent: (name: string) => Promise<void>;
  setError: (error: string | null) => void;
}

export const useSquadStore = create<SquadState>((set, get) => ({
  team: null,
  agents: [],
  routing: null,
  decisions: [],
  projectPath: null,
  loading: false,
  error: null,

  loadProject: async (projectPath?: string) => {
    set({ loading: true, error: null });
    try {
      if (projectPath) {
        await window.commander.settings.update({ projectPath });
      }

      const [team, agents, routing, decisions] = await Promise.all([
        window.commander.squad.getTeam(),
        window.commander.squad.getAgents(),
        window.commander.squad.getRouting(),
        window.commander.squad.getDecisions(),
      ]);

      set({
        team,
        agents,
        routing,
        decisions,
        projectPath: projectPath || get().projectPath,
        loading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load project',
        loading: false,
      });
    }
  },

  openProject: async () => {
    const projectPath = await window.commander.settings.openProject();
    if (projectPath) {
      await get().loadProject(projectPath);
    }
  },

  refresh: async () => {
    await get().loadProject();
  },

  updateAgent: async (name: string, charter: string) => {
    await window.commander.squad.updateAgent(name, charter);
    await get().refresh();
  },

  createAgent: async (config) => {
    await window.commander.squad.createAgent(config);
    await get().refresh();
  },

  deleteAgent: async (name: string) => {
    await window.commander.squad.deleteAgent(name);
    await get().refresh();
  },

  setError: (error) => set({ error }),
}));
