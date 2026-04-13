import { create } from 'zustand';

interface CostSnapshot {
  runId: string;
  pipelineId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  steps: Array<{ stepId: string; agent: string; totalTokens: number; estimatedCost: number }>;
  budgetUsedPercent: number;
  budgetExceeded: boolean;
}

interface BudgetConfig {
  enabled: boolean;
  mode: string;
  pipelineBudgetTokens: number | null;
  stepBudgetTokens: number | null;
  globalDailyTokens: number | null;
}

interface CostState {
  currentSnapshot: CostSnapshot | null;
  history: Array<{ runId: string; pipelineName: string; completedAt: string; totalTokens: number; estimatedCost: number }>;
  config: BudgetConfig | null;
  dailyUsage: { tokens: number; limit: number | null } | null;

  loadConfig: () => Promise<void>;
  loadHistory: () => Promise<void>;
  loadDailyUsage: () => Promise<void>;
  updateConfig: (updates: Partial<BudgetConfig>) => Promise<void>;
  setBudget: (tokens: number) => Promise<void>;
  setSnapshot: (snapshot: CostSnapshot | null) => void;
}

export const useCostStore = create<CostState>((set, get) => ({
  currentSnapshot: null,
  history: [],
  config: null,
  dailyUsage: null,

  loadConfig: async () => {
    const config = await (window as any).commander.costs.getConfig();
    set({ config });
  },

  loadHistory: async () => {
    const history = await (window as any).commander.costs.getHistory();
    set({ history });
  },

  loadDailyUsage: async () => {
    const dailyUsage = await (window as any).commander.costs.getDailyUsage();
    set({ dailyUsage });
  },

  updateConfig: async (updates) => {
    await (window as any).commander.costs.updateConfig(updates);
    await get().loadConfig();
  },

  setBudget: async (tokens) => {
    await (window as any).commander.costs.setBudget(tokens);
    await get().loadConfig();
  },

  setSnapshot: (snapshot) => set({ currentSnapshot: snapshot }),
}));
