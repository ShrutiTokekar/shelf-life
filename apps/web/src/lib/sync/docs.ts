import { IndexeddbPersistence } from 'y-indexeddb';
import * as Y from 'yjs';
import { startSync, stopAllSync, stopSync } from './provider';

/**
 * Local-first documents (SRS 8.7): one Y.Doc per pantry and per list, saved on this device with
 * y-indexeddb, then connected to the sync service (provider.ts) once the saved copy has loaded.
 */
export type DocHandle = {
  name: string;
  doc: Y.Doc;
  /** Stop the storage timeout (used when a handle is discarded). */
  dispose: () => void;
  /** Resolves once the saved copy has been loaded from IndexedDB; rejects if storage is unavailable. */
  ready: Promise<void>;
};

const STORAGE_TIMEOUT_MS = 5000;
const handles = new Map<string, DocHandle>();

export const pantryDocName = (pantryId: string) => `shelf-life:pantry:${pantryId}`;
export const listDocName = (listId: string) => `shelf-life:list:${listId}`;
/** "shelf-life:list:<id>" → "list:<id>", the name the API and sync service use. */
export const syncName = (localName: string) => localName.replace(/^shelf-life:/, '');

function open(name: string): DocHandle {
  const doc = new Y.Doc();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let persistence: IndexeddbPersistence | null = null;
  const ready = new Promise<void>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    timer = setTimeout(() => reject(new Error('IndexedDB did not respond')), STORAGE_TIMEOUT_MS);
    try {
      persistence = new IndexeddbPersistence(name, doc);
      void persistence.whenSynced.then(() => {
        clearTimeout(timer);
        resolve();
      });
    } catch (err) {
      clearTimeout(timer);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
  // Avoid unhandled-rejection noise; callers observe `ready` themselves.
  ready.catch(() => undefined);
  const dispose = () => {
    clearTimeout(timer);
    void persistence?.destroy();
    doc.destroy();
  };
  return { name, doc, ready, dispose };
}

/** Docs are shared for the whole session so every screen sees the same live data. */
export function getDoc(name: string): DocHandle {
  let handle = handles.get(name);
  if (!handle) {
    const opened = open(name);
    handle = opened;
    handles.set(name, opened);
    void opened.ready.then(
      () => startSync(syncName(name), opened.doc),
      () => undefined,
    );
  }
  return handle;
}

/** Drop a failed handle so "Try again" re-opens storage. */
export function forgetDoc(name: string) {
  stopSync(syncName(name));
  handles.get(name)?.dispose();
  handles.delete(name);
}

/** Test helper: close everything. */
export function resetDocsForTests() {
  stopAllSync();
  for (const h of handles.values()) h.dispose();
  handles.clear();
}

/** Sign-out: disconnect and close every doc (their local copies stay in IndexedDB). */
export function closeAllDocs() {
  resetDocsForTests();
}
