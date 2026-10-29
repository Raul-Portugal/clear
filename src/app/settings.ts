import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface SettingsState {
  /** Light by default; dark or follow-the-system are opt-in. */
  theme: Theme;
  setTheme: (t: Theme) => void;
  /** Send brain dumps to the server for AI organizing. Off by default (privacy). */
  smartOrganize: boolean;
  setSmartOrganize: (v: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      smartOrganize: false,
      setSmartOrganize: (smartOrganize) => set({ smartOrganize }),
    }),
    { name: 'clear-settings' },
  ),
);
