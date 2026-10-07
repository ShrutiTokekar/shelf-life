import { safeStorage } from './storage';

/** SEC-9: a browser signs out after 5 hours without use (the server enforces it too). */
export const BROWSER_IDLE_MS = 5 * 3600_000;
const LAST_ACTIVE_KEY = 'shelf-life:last-active';

/** Opened from the Home Screen (installed PWA), where a session lasts 30 days. */
export function isInstalledApp(): boolean {
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

export function lastActive(): number | null {
  const raw = Number(safeStorage.get(LAST_ACTIVE_KEY));
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

export function markActive(at = Date.now()) {
  safeStorage.set(LAST_ACTIVE_KEY, String(at));
}

export function forgetActivity() {
  safeStorage.remove(LAST_ACTIVE_KEY);
}

/**
 * Calls `onIdle` once the person hasn't touched the app (in any tab) for 5 hours. Checks every
 * minute and when the tab comes back (a laptop waking up). Returns a cleanup function.
 */
export function watchIdle(onIdle: () => void, now = () => Date.now()): () => void {
  if (lastActive() === null) markActive(now());
  let lastWrite = 0;
  const active = () => {
    const t = now();
    if (t - lastWrite > 30_000) {
      lastWrite = t;
      markActive(t);
    }
  };
  const check = () => {
    const last = lastActive();
    if (last !== null && now() - last > BROWSER_IDLE_MS) onIdle();
  };
  const visible = () => {
    if (document.visibilityState === 'visible') check();
  };
  const events = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const;
  // Check first: coming back after 5 hours must not count as activity.
  check();
  events.forEach((e) => window.addEventListener(e, active, { passive: true }));
  document.addEventListener('visibilitychange', visible);
  const timer = window.setInterval(check, 60_000);
  return () => {
    events.forEach((e) => window.removeEventListener(e, active));
    document.removeEventListener('visibilitychange', visible);
    window.clearInterval(timer);
  };
}
