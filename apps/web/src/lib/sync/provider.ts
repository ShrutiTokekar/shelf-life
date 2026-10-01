import { WebsocketProvider } from 'y-websocket';
import type * as Y from 'yjs';
import { ApiRequestError, fetchSyncToken } from '../api';

/**
 * Live sync (SRS 8.7, 11.2): each local doc (already saved in IndexedDB) is connected to the sync
 * service with y-websocket. Edits made offline stay in IndexedDB and merge when the connection
 * comes back (LST-10). Tokens last 5 minutes, so a fresh one is fetched before every reconnect.
 */
export type SyncState = 'off' | 'connecting' | 'live' | 'offline' | 'denied';

type Entry = {
  name: string;
  state: SyncState;
  provider: WebsocketProvider | null;
  stop: () => void;
};

const entries = new Map<string, Entry>();
/** Kept apart from entries so a screen can subscribe before its doc has connected. */
const listeners = new Map<string, Set<() => void>>();
let enabled = false;
let presence: { userId: string; name: string } | null = null;

/** Turned on by main.tsx; component tests run without a sync service. */
export function enableSync(on = true) {
  enabled = on;
}

/** SRS 11.2 awareness state: who is here (the "Live" indicator and future presence). */
export function setPresence(user: { userId: string; name: string } | null) {
  presence = user;
  for (const e of entries.values()) e.provider?.awareness.setLocalStateField('user', user);
}

function set(entry: Entry, state: SyncState) {
  if (entry.state === state) return;
  entry.state = state;
  for (const l of listeners.get(entry.name) ?? []) l();
}

/** Where the sync service lives: the API says, or the dev proxy at /sync on this origin. */
function baseUrl(url: string | null) {
  if (url) return `${url.replace(/\/$/, '')}/doc`;
  const { protocol, host } = window.location;
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}/sync/doc`;
}

/**
 * Connect `doc` (named "list:<id>" or "pantry:<id>") to the sync service. Idempotent. Returns
 * nothing: read the state with `syncState` / `useSyncState`.
 */
export function startSync(docName: string, doc: Y.Doc) {
  if (!enabled || entries.has(docName)) return;
  let stopped = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const entry: Entry = {
    name: docName,
    state: 'connecting',
    provider: null,
    stop: () => {
      stopped = true;
      clearTimeout(retry);
      window.removeEventListener('online', onOnline);
      entry.provider?.destroy();
      entry.provider = null;
    },
  };
  entries.set(docName, entry);
  for (const l of listeners.get(docName) ?? []) l();

  const onOnline = () => {
    if (!entry.provider) void connect(0);
  };
  window.addEventListener('online', onOnline);

  async function connect(attempt: number) {
    if (stopped) return;
    try {
      const { token, url } = await fetchSyncToken(docName);
      if (stopped) return;
      if (entry.provider) {
        entry.provider.params = { token };
        return;
      }
      const provider = new WebsocketProvider(baseUrl(url), docName, doc, { params: { token } });
      entry.provider = provider;
      if (presence) provider.awareness.setLocalStateField('user', presence);
      provider.on('status', ({ status }: { status: string }) => {
        set(entry, status === 'connected' ? 'live' : navigator.onLine ? 'connecting' : 'offline');
      });
      // Before the client retries, swap in a fresh token (they expire after 5 minutes).
      provider.on('connection-close', () => {
        if (!stopped && navigator.onLine) void connect(0);
      });
      // 44xx close codes are final: the user is no longer on this list.
      provider.on('closed', () => set(entry, 'denied'));
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 404 || err.status === 401)) {
        set(entry, 'denied');
        return;
      }
      set(entry, navigator.onLine ? 'connecting' : 'offline');
      // Offline or the API is down: try again with backoff (and at once when back online).
      retry = setTimeout(() => void connect(attempt + 1), Math.min(30_000, 1000 * 2 ** attempt));
    }
  }
  void connect(0);
}

export function stopSync(docName: string) {
  entries.get(docName)?.stop();
  entries.delete(docName);
  for (const l of listeners.get(docName) ?? []) l();
}

export function syncState(docName: string): SyncState {
  return entries.get(docName)?.state ?? 'off';
}

export function subscribeSync(docName: string, listener: () => void) {
  let set = listeners.get(docName);
  if (!set) listeners.set(docName, (set = new Set()));
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

/** Test/sign-out helper: disconnect everything. */
export function stopAllSync() {
  for (const name of [...entries.keys()]) stopSync(name);
}
