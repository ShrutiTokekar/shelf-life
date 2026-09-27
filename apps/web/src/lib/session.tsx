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
import { ApiRequestError, fetchMe, NetworkError } from './api';
import { safeStorage } from './storage';

const CACHE_KEY = 'shelf-life:me';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
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
      safeStorage.remove(CACHE_KEY);
      return { status: 'signedOut' };
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
