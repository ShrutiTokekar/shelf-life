import type { TextSize } from '@shelf-life/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type Display = { textSize: TextSize; highContrast: boolean; reduceMotion: boolean };

type UiSettings = Display & {
  /** This device has taken the account's settings once (a new device starts from them). */
  accountSynced: boolean;
  /** Changed here and not yet saved to the account (saved when online, PRO-4). */
  dirty: boolean;
  setTextSize: (size: TextSize) => void;
  setHighContrast: (on: boolean) => void;
  setReduceMotion: (on: boolean) => void;
  /** Take the account's settings (first use on this device). */
  adopt: (from: Display) => void;
  markSaved: () => void;
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
 * Display settings (A11Y-6, A11Y-7, PRO-4). Applied from this device instantly (and offline) and
 * saved to the account, so a new device starts with them (useSettingsSync).
 */
export const useUiSettings = create<UiSettings>()(
  persist(
    (set) => ({
      textSize: 'default',
      highContrast: false,
      reduceMotion: false,
      accountSynced: false,
      dirty: false,
      setTextSize: (textSize) => set({ textSize, dirty: true }),
      setHighContrast: (highContrast) => set({ highContrast, dirty: true }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion, dirty: true }),
      adopt: (from) => set({ ...from, accountSynced: true, dirty: false }),
      markSaved: () => set({ accountSynced: true, dirty: false }),
    }),
    {
      name: 'shelf-life:ui-settings',
      storage: safeLocalStorage,
      partialize: ({ textSize, highContrast, reduceMotion, accountSynced, dirty }) => ({
        textSize,
        highContrast,
        reduceMotion,
        accountSynced,
        dirty,
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
