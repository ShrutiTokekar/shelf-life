import { emptyTodayState, todayStateSchema, type TodayState } from '@shelf-life/shared';
import type * as Y from 'yjs';

/** The pantry doc's `today` map: user id → that person's Today progress (SRS 8.4). */
export function todayMap(doc: Y.Doc): Y.Map<TodayState> {
  return doc.getMap<TodayState>('today');
}

export function readTodayState(doc: Y.Doc, userId: string, today: string): TodayState {
  const parsed = todayStateSchema.safeParse(todayMap(doc).get(userId));
  return parsed.success && parsed.data.date === today ? parsed.data : emptyTodayState(today);
}

export function writeTodayState(doc: Y.Doc, userId: string, state: TodayState) {
  todayMap(doc).set(userId, todayStateSchema.parse(state));
}
