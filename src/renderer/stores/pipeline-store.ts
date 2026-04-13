import { create } from 'zustand';
import type { Pipeline } from '../../shared/types';

interface PipelineState {
  pipelines: Pipeline[];
  activePipeline: Pipeline | null;
  templates: Pipeline[];
  runStatus: Record<string, unknown> | null;
  runOutput: string;
  loading: boolean;

  // Actions
  loadPipelines: () => Promise<void>;
  loadTemplates: () => Promise<void>;
  selectPipeline: (pipeline: Pipeline | null) => void;
  savePipeline: (pipeline: Pipeline) => Promise<{ valid: boolean; errors: Array<{ path: string; message: string }> }>;
  deletePipeline: (id: string) => Promise<void>;
  createFromTemplate: (template: Pipeline, newId: string, newName: string) => void;
  runPipeline: (id: string, variables?: Record<string, string>) => Promise<void>;
  pauseRun: () => Promise<void>;
  resumeRun: () => Promise<void>;
  cancelRun: () => Promise<void>;
  approveGate: (stepId: string) => Promise<void>;
  rejectGate: (stepId: string) => Promise<void>;
  appendOutput: (chunk: string) => void;
  setRunStatus: (status: Record<string, unknown> | null) => void;
  clearOutput: () => void;
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  pipelines: [],
  activePipeline: null,
  templates: [],
  runStatus: null,
  runOutput: '',
  loading: false,

  loadPipelines: async () => {
    set({ loading: true });
    try {
      const pipelines = await (window as any).commander.pipelines.list();
      set({ pipelines, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  loadTemplates: async () => {
    try {
      const templates = await (window as any).commander.pipelines.getTemplates();
      set({ templates });
    } catch {
      // Templates not available
    }
  },

  selectPipeline: (pipeline) => set({ activePipeline: pipeline }),

  savePipeline: async (pipeline) => {
    const result = await (window as any).commander.pipelines.save(pipeline);
    if (result.valid) {
      await get().loadPipelines();
    }
    return result;
  },

  deletePipeline: async (id) => {
    await (window as any).commander.pipelines.delete(id);
    if (get().activePipeline?.id === id) {
      set({ activePipeline: null });
    }
    await get().loadPipelines();
  },

  createFromTemplate: (template, newId, newName) => {
    const newPipeline: Pipeline = {
      ...template,
      id: newId,
      name: newName,
      metadata: {
        ...template.metadata,
        template: false,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
      },
    };
    set({ activePipeline: newPipeline });
  },

  runPipeline: async (id, variables) => {
    set({ runOutput: '', runStatus: { type: 'started', pipelineId: id } });
    await (window as any).commander.pipelines.run(id, variables);
  },

  pauseRun: async () => {
    await (window as any).commander.pipelines.pause();
  },

  resumeRun: async () => {
    await (window as any).commander.pipelines.resume();
  },

  cancelRun: async () => {
    await (window as any).commander.pipelines.cancel();
  },

  approveGate: async (stepId) => {
    await (window as any).commander.pipelines.approveGate(stepId);
  },

  rejectGate: async (stepId) => {
    await (window as any).commander.pipelines.rejectGate(stepId);
  },

  appendOutput: (chunk) => set((s) => ({ runOutput: s.runOutput + chunk })),
  setRunStatus: (status) => set({ runStatus: status }),
  clearOutput: () => set({ runOutput: '' }),
}));
