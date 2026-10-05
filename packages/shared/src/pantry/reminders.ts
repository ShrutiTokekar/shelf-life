import { z } from 'zod';
import { addDays, diffDays, type IsoDate } from '../dates';
import type { ListItem } from '../listDoc/types';
import type { Activity } from './activity';
import type { PantryItem } from './types';

/** SRS 8.6 running low: below this share of what there was. */
export const LOW_SHARE = 0.2;
/** Ran-out reminders older than this drop off the page. */
export const RAN_OUT_SHOWN_DAYS = 30;
/** RMD-1 "Snooze" on a running-low reminder. */
export const SNOOZE_DAYS = 2;

/**
 * The quantity fields to write when an item's quantity changes (SRS 8.6): the first decrease
 * remembers the starting amount; a restock (more than there was) starts over and clears "low".
 */
export function withQuantity(
  item: Pick<PantryItem, 'quantity' | 'startQuantity' | 'lowAt'>,
  quantity: number | null,
): Pick<PantryItem, 'quantity' | 'startQuantity' | 'lowAt'> {
  const before = item.quantity;
  if (quantity === null || before === null) return { quantity, startQuantity: null, lowAt: null };
  if (quantity > before) return { quantity, startQuantity: quantity, lowAt: null };
  if (quantity < before)
    return { quantity, startQuantity: item.startQuantity ?? before, lowAt: item.lowAt ?? null };
  return { quantity, startQuantity: item.startQuantity ?? null, lowAt: item.lowAt ?? null };
}

/** SRS 8.6 running low (P1): marked low, or a measured item below 20% of what there was. */
export function isRunningLow(item: PantryItem): boolean {
  if (item.status !== 'active' || item.quantity === 0) return false;
  if (item.lowAt) return true;
  const start = item.startQuantity ?? null;
  return item.quantity !== null && start !== null && start > 0 && item.quantity / start < LOW_SHARE;
}

/**
 * One person's reminder choices, in the pantry doc's `reminders` map (per user, like Today):
 * which reminders they've seen, and which they put off ("Later", "Snooze") or dismissed.
 */
export const reminderStateSchema = z.object({
  read: z.array(z.string()),
  /** Key → hidden until this date, or "never" (Not needed). */
  hidden: z.record(z.string(), z.union([z.iso.date(), z.literal('never')])),
});
export type ReminderState = z.infer<typeof reminderStateSchema>;
export const emptyReminderState = (): ReminderState => ({ read: [], hidden: {} });

export type Reminder = {
  /** Changes when the situation does (a new ran-out, a restock), so old choices don't stick. */
  key: string;
  kind: 'ran_out' | 'low';
  item: PantryItem;
  unread: boolean;
  /** Open list entry for it (RMD-3: "On the list · {claimer}"). */
  listItem: ListItem | null;
  /** Ran out: who used the last of it, and how many days ago. */
  by: string | null;
  daysAgo: number | null;
};

const keyOf = (kind: Reminder['kind'], item: PantryItem) =>
  kind === 'ran_out'
    ? `ran_out:${item.id}:${item.outAt ?? 'x'}`
    : `low:${item.id}:${item.lowAt ?? item.startQuantity ?? 'x'}`;

/**
 * RMD-1..RMD-3: the reminders for a pantry, for one person, on the device (works offline).
 * Ran out (last 30 days), then running low, newest first; things put off or dismissed are left
 * out until their day.
 */
export function remindersFor(input: {
  pantry: readonly PantryItem[];
  listItems: readonly ListItem[];
  activity: readonly Activity[];
  state: ReminderState;
  today: IsoDate;
}): { ranOut: Reminder[]; low: Reminder[]; unread: number } {
  const { today, state } = input;
  const read = new Set(state.read);
  const visible = (key: string) => {
    const h = state.hidden[key];
    return !h || (h !== 'never' && h <= today);
  };
  const entryFor = (item: PantryItem) =>
    input.listItems.find(
      (l) =>
        !l.checked &&
        (l.pantryItemId === item.id ||
          l.name.trim().toLowerCase() === item.name.trim().toLowerCase()),
    ) ?? null;
  const ranOutBy = (item: PantryItem) =>
    [...input.activity]
      .filter((a) => a.type === 'ran_out' && a.itemId === item.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.actorId ?? null;

  const ranOut: Reminder[] = [];
  const low: Reminder[] = [];
  for (const item of input.pantry) {
    if (item.status === 'out') {
      const daysAgo = item.outAt ? diffDays(item.outAt, today) : null;
      if (daysAgo === null || daysAgo > RAN_OUT_SHOWN_DAYS) continue;
      const key = keyOf('ran_out', item);
      if (!visible(key)) continue;
      ranOut.push({
        key,
        kind: 'ran_out',
        item,
        unread: !read.has(key),
        listItem: entryFor(item),
        by: ranOutBy(item),
        daysAgo,
      });
    } else if (isRunningLow(item)) {
      const key = keyOf('low', item);
      if (!visible(key)) continue;
      low.push({
        key,
        kind: 'low',
        item,
        unread: !read.has(key),
        listItem: entryFor(item),
        by: null,
        daysAgo: null,
      });
    }
  }
  ranOut.sort(
    (a, b) => (a.daysAgo ?? 0) - (b.daysAgo ?? 0) || a.item.name.localeCompare(b.item.name),
  );
  low.sort((a, b) => a.item.name.localeCompare(b.item.name));
  // Things already on the list don't need anyone's attention: they don't count as unread.
  const unread = [...ranOut, ...low].filter((r) => r.unread && !r.listItem).length;
  return { ranOut, low, unread };
}

/** RMD-2 Mark all read. */
export const markRead = (s: ReminderState, keys: readonly string[]): ReminderState => ({
  ...s,
  read: [...new Set([...s.read, ...keys])],
});

/** RMD-1 Later (tomorrow), Snooze (2 days), Not needed (for good). Also marks it read. */
export function putOff(
  s: ReminderState,
  key: string,
  how: 'later' | 'snooze' | 'never',
  today: IsoDate,
): ReminderState {
  const until = how === 'never' ? 'never' : addDays(today, how === 'later' ? 1 : SNOOZE_DAYS);
  return markRead({ ...s, hidden: { ...s.hidden, [key]: until } }, [key]);
}

/** Drop choices about items no longer in the pantry, so the state stays small. */
export function pruneReminderState(s: ReminderState, itemIds: readonly string[]): ReminderState {
  const ids = new Set(itemIds);
  const keep = (k: string) => ids.has(k.split(':')[1] ?? '');
  return {
    read: s.read.filter(keep),
    hidden: Object.fromEntries(Object.entries(s.hidden).filter(([k]) => keep(k))),
  };
}
