import type { TextSize } from '@shelf-life/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type UiSettings = {
  textSize: TextSize;
  highContrast: boolean;
  reduceMotion: boolean;
  setTextSize: (size: TextSize) => void;
  setHighContrast: (on: boolean) => void;
  setReduceMotion: (on: boolean) => void;
};

const safeLocalStorage = createJSONStorage(() => {
  try {
    return window.localStorage;
  } catch {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
  }
});

/**
 * Display settings (A11Y-6, A11Y-7). Kept on this device for now; saved to the account
 * (PATCH /me/settings) with the Profile page in Milestone 8.
 */
export const useUiSettings = create<UiSettings>()(
  persist(
    (set) => ({
      textSize: 'default',
      highContrast: false,
      reduceMotion: false,
      setTextSize: (textSize) => set({ textSize }),
      setHighContrast: (highContrast) => set({ highContrast }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
    }),
    {
      name: 'shelf-life:ui-settings',
      storage: safeLocalStorage,
      partialize: ({ textSize, highContrast, reduceMotion }) => ({
        textSize,
        highContrast,
        reduceMotion,
      }),
    },
  ),
);

/** Reflect settings onto <html> so tokens.css can react. Unset attributes defer to OS preferences. */
export function applyUiSettings(
  root: HTMLElement,
  s: Pick<UiSettings, 'textSize' | 'highContrast' | 'reduceMotion'>,
) {
  root.dataset.textSize = s.textSize;
  if (s.highContrast) root.dataset.contrast = 'high';
  else delete root.dataset.contrast;
  if (s.reduceMotion) root.dataset.motion = 'reduce';
  else delete root.dataset.motion;
}
