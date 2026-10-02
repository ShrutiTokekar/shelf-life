import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * A step timer (RCP-5, RCP-7). It stores when it ends, not a countdown, so it keeps time while
 * the app is in the background or the phone is locked (SRS 8.10).
 */
export type StepTimer = {
  /** `${recipeId}:${stepIndex}`: one timer per step. */
  id: string;
  recipeId: string;
  recipeTitle: string;
  step: number;
  stepTitle: string;
  durationMs: number;
  /** Running: when it ends. Paused: null. */
  endsAt: number | null;
  /** Paused: time left. */
  remainingMs: number;
  /** Finished and alerted; shown until dismissed. */
  done: boolean;
};

type TimerState = {
  timers: Record<string, StepTimer>;
  start: (t: Omit<StepTimer, 'endsAt' | 'remainingMs' | 'done' | 'id'>, now?: number) => void;
  pause: (id: string, now?: number) => void;
  resume: (id: string, now?: number) => void;
  finish: (id: string) => void;
  dismiss: (id: string) => void;
};

const safeLocalStorage = createJSONStorage(() => {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
  }
});

export const timerId = (recipeId: string, step: number) => `${recipeId}:${step}`;

export const useTimers = create<TimerState>()(
  persist(
    (set, get) => ({
      timers: {},
      start: (t, now = Date.now()) => {
        const id = timerId(t.recipeId, t.step);
        set({
          timers: {
            ...get().timers,
            [id]: { ...t, id, endsAt: now + t.durationMs, remainingMs: t.durationMs, done: false },
          },
        });
      },
      pause: (id, now = Date.now()) => {
        const t = get().timers[id];
        if (!t || t.endsAt === null) return;
        set({
          timers: {
            ...get().timers,
            [id]: { ...t, endsAt: null, remainingMs: Math.max(0, t.endsAt - now) },
          },
        });
      },
      resume: (id, now = Date.now()) => {
        const t = get().timers[id];
        if (!t || t.endsAt !== null) return;
        set({ timers: { ...get().timers, [id]: { ...t, endsAt: now + t.remainingMs } } });
      },
      finish: (id) => {
        const t = get().timers[id];
        if (!t) return;
        set({
          timers: { ...get().timers, [id]: { ...t, done: true, endsAt: null, remainingMs: 0 } },
        });
      },
      dismiss: (id) => {
        const timers = { ...get().timers };
        delete timers[id];
        set({ timers });
      },
    }),
    { name: 'shelf-life:timers', storage: safeLocalStorage },
  ),
);

/** Time left on a timer at `now`, in ms. */
export const remaining = (t: StepTimer, now: number) =>
  t.done ? 0 : t.endsAt === null ? t.remainingMs : Math.max(0, t.endsAt - now);

/** "2:00", "12:05", "1:02:00". */
export function clock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
