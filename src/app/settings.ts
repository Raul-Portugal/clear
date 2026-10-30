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
  /** Language for voice transcripts (BCP 47); empty = the device language. */
  voiceLang: string;
  setVoiceLang: (v: string) => void;
}

/** Offered in the menu; the device language stays the default. */
export const VOICE_LANGS: { value: string; label: string }[] = [
  { value: '', label: 'Device language' },
  { value: 'pt-PT', label: 'Português (Portugal)' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Español' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'it-IT', label: 'Italiano' },
];

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      smartOrganize: false,
      setSmartOrganize: (smartOrganize) => set({ smartOrganize }),
      voiceLang: '',
      setVoiceLang: (voiceLang) => set({ voiceLang }),
    }),
    { name: 'clear-settings' },
  ),
);
