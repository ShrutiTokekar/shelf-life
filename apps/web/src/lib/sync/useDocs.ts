import type { ListItem, PantryItem, Receipt } from '@shelf-life/shared';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type * as Y from 'yjs';
import { forgetDoc, getDoc, listDocName, pantryDocName } from './docs';
import { readListItems } from './listStore';
import { readItems } from './pantryStore';
import { readReceipts } from './receiptStore';

export type DocStatus = 'loading' | 'ready' | 'error';

/** Subscribe to a Y.Doc and re-read `read(doc)` whenever it changes. */
function useDocSnapshot<T>(doc: Y.Doc | null, read: (doc: Y.Doc) => T, empty: T): T {
  const cache = useRef<{ doc: Y.Doc | null; value: T; dirty: boolean }>({
    doc: null,
    value: empty,
    dirty: true,
  });
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!doc) return () => undefined;
      const handler = () => {
        cache.current.dirty = true;
        onChange();
      };
      doc.on('update', handler);
      return () => doc.off('update', handler);
    },
    [doc],
  );
  const getSnapshot = useCallback(() => {
    const c = cache.current;
    if (!doc) return empty;
    if (c.doc !== doc || c.dirty) {
      cache.current = { doc, value: read(doc), dirty: false };
    }
    return cache.current.value;
  }, [doc, read, empty]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function useDocHandle(name: string | null) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ name: string | null; status: DocStatus }>({
    name: null,
    status: 'loading',
  });
  const handle = useMemo(() => (name ? getDoc(name) : null), [name, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    handle.ready.then(
      () => !cancelled && setState({ name: handle.name, status: 'ready' }),
      () => !cancelled && setState({ name: handle.name, status: 'error' }),
    );
    return () => {
      cancelled = true;
    };
  }, [handle]);

  const status: DocStatus = !handle
    ? 'loading'
    : state.name === handle.name
      ? state.status
      : 'loading';
  const retry = useCallback(() => {
    if (name) forgetDoc(name);
    setAttempt((a) => a + 1);
  }, [name]);
  return { doc: status === 'ready' ? handle!.doc : null, status, retry };
}

const NO_ITEMS: PantryItem[] = [];

/** Live pantry items for a pantry, loaded from this device. */
export function usePantry(pantryId: string | null) {
  const { doc, status, retry } = useDocHandle(pantryId ? pantryDocName(pantryId) : null);
  const items = useDocSnapshot(doc, readItems, NO_ITEMS);
  return { doc, items, status, retry };
}

const NO_RECEIPTS: Receipt[] = [];

/** Live receipts (and pantry items, for "Edit items") from the pantry doc on this device. */
export function useReceipts(pantryId: string | null) {
  const { doc, status, retry } = useDocHandle(pantryId ? pantryDocName(pantryId) : null);
  const receipts = useDocSnapshot(doc, readReceipts, NO_RECEIPTS);
  const items = useDocSnapshot(doc, readItems, NO_ITEMS);
  return { doc, receipts, items, status, retry };
}

/**
 * Live items for several lists at once (used for "On the list" on ran-out jars, PAN-9).
 * Returns listId → items; lists whose storage can't be opened are simply absent.
 */
export function useListsItems(listIds: readonly string[]): Readonly<Record<string, ListItem[]>> {
  const key = [...listIds].sort().join(',');
  const [byList, setByList] = useState<Record<string, ListItem[]>>({});

  useEffect(() => {
    let cancelled = false;
    const unsubscribes: Array<() => void> = [];
    for (const listId of key ? key.split(',') : []) {
      const handle = getDoc(listDocName(listId));
      handle.ready.then(
        () => {
          if (cancelled) return;
          const update = () =>
            setByList((prev) => ({ ...prev, [listId]: readListItems(handle.doc) }));
          update();
          handle.doc.on('update', update);
          unsubscribes.push(() => handle.doc.off('update', update));
        },
        () => undefined,
      );
    }
    return () => {
      cancelled = true;
      unsubscribes.forEach((off) => off());
    };
  }, [key]);

  return byList;
}
