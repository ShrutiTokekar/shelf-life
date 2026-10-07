import { meResponseSchema, type MeResponse } from '@shelf-life/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ApiRequestError,
  claimAppSession,
  fetchMe,
  NetworkError,
  sessionEvents,
  signOut,
} from './api';
import { isInstalledApp, watchIdle } from './sessionTimeout';
import { safeStorage } from './storage';
import { wipeDeviceData } from './wipe';

const CACHE_KEY = 'shelf-life:me';
/** SEC-9: why this tab was signed out, kept until the next sign-in so a reload still says so. */
const EXPIRED_KEY = 'shelf-life:signed-out-expired';

function rememberExpired() {
  try {
    window.sessionStorage.setItem(EXPIRED_KEY, '1');
  } catch {
    // ignore
  }
}

function wasExpired(): boolean {
  try {
    return window.sessionStorage.getItem(EXPIRED_KEY) === '1';
  } catch {
    return false;
  }
}

/** A new sign-in starts clean. */
export function forgetExpired() {
  try {
    window.sessionStorage.removeItem(EXPIRED_KEY);
  } catch {
    // ignore
  }
}

export type SessionState =
  | { status: 'loading' }
  /** `expired`: the session ran out (SEC-9), so Welcome says why. */
  | { status: 'signedOut'; reason?: 'expired' }
  | { status: 'ready'; me: MeResponse; offline: boolean }
  | { status: 'error'; message: string };

type SessionContextValue = SessionState & { refresh: () => Promise<void>; clear: () => void };

const SessionContext = createContext<SessionContextValue | null>(null);

function readCache(): MeResponse | null {
  const raw = safeStorage.get(CACHE_KEY);
  if (!raw) return null;
  try {
    return meResponseSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Loads GET /me once and shares it. The last good response is cached on this device so the
 * app opens offline (SRS 12.4); sign-in itself still needs a connection.
 */
async function resolveSession(load: typeof fetchMe): Promise<SessionState> {
  try {
    const me = await load();
    safeStorage.set(CACHE_KEY, JSON.stringify(me));
    return { status: 'ready', me, offline: false };
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 401) {
      // Signed in on this device before: the session ran out. Nothing of theirs stays here.
      const wasSignedIn = readCache() !== null;
      if (wasSignedIn) await wipeDeviceData();
      safeStorage.remove(CACHE_KEY);
      if (wasSignedIn || err.code === 'session_expired') rememberExpired();
      return wasExpired() ? { status: 'signedOut', reason: 'expired' } : { status: 'signedOut' };
    }
    const cached = err instanceof NetworkError ? readCache() : null;
    if (cached) return { status: 'ready', me: cached, offline: true };
    return { status: 'error', message: err instanceof NetworkError ? 'network' : 'server' };
  }
}

/**
 * Loads GET /me once and shares it. The last good response is cached on this device so the
 * app opens offline (SRS 12.4); sign-in itself still needs a connection.
 */
export function SessionProvider({
  children,
  load = fetchMe,
}: {
  children: ReactNode;
  load?: typeof fetchMe;
}) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    setState(await resolveSession(load));
  }, [load]);

  const clear = useCallback(() => {
    safeStorage.remove(CACHE_KEY);
    setState({ status: 'signedOut' });
  }, []);

  const ready = state.status === 'ready';
  const online = state.status === 'ready' && !state.offline;
  const userId = state.status === 'ready' ? state.me.user.id : null;

  // SEC-9: the server refused this session mid-use (timed out, or signed out everywhere).
  useEffect(() => {
    if (!ready) return;
    const onUnauthorized = () => {
      rememberExpired();
      void wipeDeviceData().then(() => setState({ status: 'signedOut', reason: 'expired' }));
    };
    sessionEvents.addEventListener('unauthorized', onUnauthorized);
    return () => sessionEvents.removeEventListener('unauthorized', onUnauthorized);
  }, [ready]);

  // SEC-9: in a browser, sign out after 5 hours without use. The installed app keeps 30 days.
  useEffect(() => {
    if (!ready) return;
    if (isInstalledApp()) return;
    return watchIdle(() => {
      void signOut()
        .catch(() => undefined)
        .then(() => wipeDeviceData())
        .then(() => {
          rememberExpired();
          setState({ status: 'signedOut', reason: 'expired' });
        });
    });
  }, [ready]);

  // SEC-9: tell the server this session is the installed app. Only counts within 10 minutes of
  // sign-in (the server ignores it later), so asking on every start is harmless.
  useEffect(() => {
    if (!online || !userId || !isInstalledApp()) return;
    void claimAppSession().catch(() => undefined);
  }, [online, userId]);

  useEffect(() => {
    let cancelled = false;
    void resolveSession(load).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const value = useMemo(() => ({ ...state, refresh, clear }), [state, refresh, clear]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

/** Only call inside routes guarded by <RequireAuth>. */
export function useMe(): MeResponse {
  const s = useSession();
  if (s.status !== 'ready') throw new Error('useMe used outside an authenticated route');
  return s.me;
}
