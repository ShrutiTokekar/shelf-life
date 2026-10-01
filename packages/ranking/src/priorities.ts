import {
  addDays,
  daysLeft,
  diffDays,
  emptyTodayState,
  shelfFor,
  type IsoDate,
  type ListItem,
  type PantryItem,
  type Receipt,
  type TodayState,
} from '@shelf-life/shared';

export { emptyTodayState, type TodayState } from '@shelf-life/shared';

/** What a Today card is about (SRS 8.4 candidates). */
export type PriorityKind = 'expires' | 'ran_out' | 'recipe_item' | 'plan_soon' | 'review_receipt';

export type Priority = {
  /** Stable for the day, so snoozes and "done" survive re-ranking. */
  key: string;
  kind: PriorityKind;
  score: number;
  /** Earliest expiry involved, for tie-breaks (SRS 8.4). */
  expiresOn: IsoDate | null;
  /** The pantry items it's about. */
  items: PantryItem[];
  /** The list entry it's about (ran out and on the list). */
  listItem: ListItem | null;
  receipt: Receipt | null;
  /** Days until the soonest item expires (negative = overdue). */
  daysLeft: number | null;
  /** "plan_soon": the day "Remind me" hides it until (the day before the first expiry). */
  remindOn: IsoDate | null;
};

/** SRS 8.4 base scores. */
export const BASE = {
  expires: 100,
  ran_out: 80,
  recipe_item: 70,
  plan_soon: 60,
  review_receipt: 40,
} as const;
export const ONE_TAP_BONUS = 15;
export const SNOOZE_PENALTY = 50;
/** TOD-1: at most three things a day. */
export const MAX_PRIORITIES = 3;

export type PriorityInput = {
  today: IsoDate;
  pantry: readonly PantryItem[];
  /** Items on the lists that stock this pantry. */
  listItems: readonly ListItem[];
  receipts: readonly Receipt[];
  state: TodayState;
  /** 6c: open list items the top recipe needs (score 70). */
  recipeNeeds?: readonly ListItem[];
};

const byExpiryThenName = (a: Priority, b: Priority) =>
  b.score - a.score ||
  (a.expiresOn ?? '9999').localeCompare(b.expiresOn ?? '9999') ||
  a.key.localeCompare(b.key);

/** Every candidate action with its score (SRS 8.4), best first. */
export function priorityCandidates(input: PriorityInput): Priority[] {
  const { today, pantry, listItems, receipts } = input;
  const out: Priority[] = [];
  const openByJar = new Map(
    listItems.filter((l) => !l.checked && l.pantryItemId).map((l) => [l.pantryItemId!, l]),
  );
  const soon: PantryItem[] = [];

  for (const item of pantry) {
    const shelf = shelfFor(item, today);
    if (item.status !== 'active' && item.status !== 'out') continue;
    if (shelf === 'today') {
      // "Used it" is one tap.
      out.push({
        key: `expires:${item.id}`,
        kind: 'expires',
        score: BASE.expires + ONE_TAP_BONUS,
        expiresOn: item.expiresOn,
        items: [item],
        listItem: null,
        receipt: null,
        daysLeft: daysLeft(item, today),
        remindOn: null,
      });
    } else if (shelf === 'out' && item.outAt === today) {
      const entry = openByJar.get(item.id) ?? null;
      if (entry?.claimedBy) continue; // someone's getting it
      // "Add & claim" or "I'll get it" is one tap.
      out.push({
        key: `ran_out:${item.id}`,
        kind: 'ran_out',
        score: BASE.ran_out + ONE_TAP_BONUS,
        expiresOn: null,
        items: [item],
        listItem: entry,
        receipt: null,
        daysLeft: null,
        remindOn: null,
      });
    } else if (shelf === 'soon') {
      const d = daysLeft(item, today);
      if (d >= 1 && d <= 2) soon.push(item);
    }
  }

  if (soon.length > 0) {
    // One "plan for" action for everything expiring in 1–2 days.
    soon.sort((a, b) => a.expiresOn.localeCompare(b.expiresOn) || a.name.localeCompare(b.name));
    const first = soon[0]!;
    const d = daysLeft(first, today);
    out.push({
      key: `plan_soon:${today}`,
      kind: 'plan_soon',
      score: BASE.plan_soon - 10 * d,
      expiresOn: first.expiresOn,
      items: soon,
      listItem: null,
      receipt: null,
      daysLeft: d,
      remindOn:
        addDays(first.expiresOn, -1) > today ? addDays(first.expiresOn, -1) : addDays(today, 1),
    });
  }

  for (const entry of input.recipeNeeds ?? []) {
    if (entry.checked || entry.claimedBy) continue;
    out.push({
      key: `recipe_item:${entry.id}`,
      kind: 'recipe_item',
      score: BASE.recipe_item + ONE_TAP_BONUS,
      expiresOn: null,
      items: [],
      listItem: entry,
      receipt: null,
      daysLeft: null,
      remindOn: null,
    });
  }

  for (const receipt of receipts) {
    if (receipt.reviewState !== 'needs_review') continue;
    out.push({
      key: `review_receipt:${receipt.id}`,
      kind: 'review_receipt',
      score: BASE.review_receipt,
      expiresOn: null,
      items: [],
      listItem: null,
      receipt,
      daysLeft: null,
      remindOn: null,
    });
  }

  return out.sort(byExpiryThenName);
}

/** A snooze still applies today if its "until" date hasn't come yet. */
const isSnoozed = (state: TodayState, key: string, today: IsoDate) =>
  (state.snoozed[key] ?? '') > today;

/**
 * TOD-1 / TOD-2 / TOD-5: today's priorities. Things done today count toward "X of N done" and
 * leave the list; snoozed ones lose 50 points (SRS 8.4) and "Remind me" ones are hidden until
 * their day. At most three slots a day, done ones included.
 */
export function todayPriorities(input: PriorityInput): {
  active: Priority[];
  doneCount: number;
  total: number;
} {
  const state = input.state.date === input.today ? input.state : emptyTodayState(input.today);
  const done = new Set(state.done);
  const doneCount = Math.min(done.size, MAX_PRIORITIES);
  const candidates = priorityCandidates(input)
    .filter((p) => !done.has(p.key))
    .filter((p) => !(p.kind === 'plan_soon' && isSnoozed(state, p.key, input.today)))
    .map((p) =>
      isSnoozed(state, p.key, input.today) ? { ...p, score: p.score - SNOOZE_PENALTY } : p,
    )
    .sort(byExpiryThenName);
  const active = candidates.slice(0, MAX_PRIORITIES - doneCount);
  return { active, doneCount, total: doneCount + active.length };
}

/** Mark a priority done for today (TOD-2). */
export function markDone(state: TodayState, key: string, today: IsoDate): TodayState {
  const base = state.date === today ? state : emptyTodayState(today);
  return base.done.includes(key) ? base : { ...base, done: [...base.done, key] };
}

/** Undo "done". */
export function unmarkDone(state: TodayState, key: string): TodayState {
  return { ...state, done: state.done.filter((k) => k !== key) };
}

/** "Snooze a day" (until tomorrow) or "Remind me {day}" (until that day). */
export function snooze(
  state: TodayState,
  key: string,
  today: IsoDate,
  until?: IsoDate,
): TodayState {
  const base = state.date === today ? state : emptyTodayState(today);
  return { ...base, snoozed: { ...base.snoozed, [key]: until ?? addDays(today, 1) } };
}

// ---- TOD-6 timeline ----

export const TIMELINE_COLUMNS = ['today', 'tomorrow', 'in2', 'in3', 'week', 'later'] as const;
export type TimelineColumn = (typeof TIMELINE_COLUMNS)[number];

export function timelineColumn(days: number): TimelineColumn {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === 2) return 'in2';
  if (days === 3) return 'in3';
  if (days <= 7) return 'week';
  return 'later';
}

/** Items on the shelf (not ran out) grouped into timeline columns, soonest first in each. */
export function timeline(
  pantry: readonly PantryItem[],
  today: IsoDate,
): Record<TimelineColumn, PantryItem[]> {
  const cols = Object.fromEntries(TIMELINE_COLUMNS.map((c) => [c, [] as PantryItem[]])) as Record<
    TimelineColumn,
    PantryItem[]
  >;
  for (const item of pantry) {
    if (item.status !== 'active' || shelfFor(item, today) === 'out') continue;
    cols[timelineColumn(diffDays(today, item.expiresOn))].push(item);
  }
  for (const c of TIMELINE_COLUMNS)
    cols[c].sort((a, b) => a.expiresOn.localeCompare(b.expiresOn) || a.name.localeCompare(b.name));
  return cols;
}
