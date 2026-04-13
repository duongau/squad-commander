import { create } from 'zustand';
import type { ScheduleConfig } from '../../main/scheduler';

interface ScheduleState {
  schedules: ScheduleConfig[];
  loading: boolean;

  loadSchedules: () => Promise<void>;
  createSchedule: (config: {
    id: string;
    pipelineId: string;
    cron: string;
    enabled: boolean;
    variables: Record<string, string>;
  }) => Promise<void>;
  updateSchedule: (id: string, updates: Partial<ScheduleConfig>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  toggleSchedule: (id: string, enabled: boolean) => Promise<void>;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedules: [],
  loading: false,

  loadSchedules: async () => {
    set({ loading: true });
    try {
      const schedules = await (window as any).commander.schedules.list();
      set({ schedules, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createSchedule: async (config) => {
    await (window as any).commander.schedules.create(config);
    await get().loadSchedules();
  },

  updateSchedule: async (id, updates) => {
    await (window as any).commander.schedules.update(id, updates);
    await get().loadSchedules();
  },

  deleteSchedule: async (id) => {
    await (window as any).commander.schedules.delete(id);
    await get().loadSchedules();
  },

  toggleSchedule: async (id, enabled) => {
    await (window as any).commander.schedules.toggle(id, enabled);
    await get().loadSchedules();
  },
}));
