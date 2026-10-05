import { readActivity, readReminderState, writeReminderState } from '@shelf-life/docs';
import {
  emptyReminderState,
  remindersFor,
  todayIso,
  type Activity,
  type ReminderState,
} from '@shelf-life/shared';
import { useCallback, useMemo } from 'react';
import type * as Y from 'yjs';
import { useCurrentPantry } from '../../lib/pantries';
import { useMe } from '../../lib/session';
import { useDocSnapshot, useListsItems, useReceipts } from '../../lib/sync/useDocs';

const NO_ACTIVITY: Activity[] = [];
const EMPTY = emptyReminderState();

/**
 * RMD-1..RMD-3 for the pantry being viewed, for this person, from this device (works offline).
 * Used by the Reminders page and the bell's unread count.
 */
export function useReminders() {
  const me = useMe();
  const current = useCurrentPantry();
  const { doc, items, status, retry } = useReceipts(current.pantry.id);
  const ids = useMemo(() => current.lists.map((l) => l.id), [current.lists]);
  const byList = useListsItems(ids);
  const listItems = useMemo(() => Object.values(byList).flat(), [byList]);
  const activity = useDocSnapshot(doc, readActivity, NO_ACTIVITY);
  const read = useCallback((d: Y.Doc) => readReminderState(d, me.user.id), [me.user.id]);
  const state = useDocSnapshot(doc, read, EMPTY);
  const today = todayIso();
  const reminders = useMemo(
    () => remindersFor({ pantry: items, listItems, activity, state, today }),
    [items, listItems, activity, state, today],
  );
  const update = useCallback(
    (next: (s: ReminderState) => ReminderState) => {
      if (doc) writeReminderState(doc, me.user.id, next(readReminderState(doc, me.user.id)));
    },
    [doc, me.user.id],
  );
  return {
    ...reminders,
    doc,
    status,
    retry,
    today,
    update,
    pantry: current.pantry,
    lists: current.lists,
  };
}
