import {
  emptyReminderState,
  pruneReminderState,
  reminderStateSchema,
  type ReminderState,
} from '@shelf-life/shared';
import type * as Y from 'yjs';
import { itemsMap } from './pantry';

/** The pantry doc's `reminders` map: user id → that person's reminder choices (RMD-1, RMD-2). */
export function remindersMap(doc: Y.Doc): Y.Map<ReminderState> {
  return doc.getMap<ReminderState>('reminders');
}

export function readReminderState(doc: Y.Doc, userId: string): ReminderState {
  const parsed = reminderStateSchema.safeParse(remindersMap(doc).get(userId));
  return parsed.success ? parsed.data : emptyReminderState();
}

/** Saves one person's choices, dropping any about items no longer in the pantry. */
export function writeReminderState(doc: Y.Doc, userId: string, state: ReminderState) {
  const ids = [...itemsMap(doc).keys()];
  remindersMap(doc).set(userId, reminderStateSchema.parse(pruneReminderState(state, ids)));
}
