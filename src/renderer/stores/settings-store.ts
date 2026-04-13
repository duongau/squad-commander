import { create } from 'zustand';

interface SettingsState {
  theme: 'light' | 'dark';
  defaultRunner: string;
  toggleTheme: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'dark',
  defaultRunner: 'copilot-cli',
  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
}));
