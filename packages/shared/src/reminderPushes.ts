import { addDays, type IsoDate } from './dates';
import type { ListItem } from './listDoc/types';
import { localTime, type PushPayload } from './notifications';
import type { Activity } from './pantry/activity';
import { remindersFor, type ReminderState } from './pantry/reminders';
import type { PantryItem } from './pantry/types';
import type { ExpiryAlert, NotificationSettings } from './schemas/user';

/**
 * What the hourly reminders job sends (SRS 8.8, RMD-4, PRO-5, Milestone 8d). Pure functions, so
 * the API job only loads data and sends. Quiet hours, 3 a day and "never twice" are applied by
 * the push service when sending.
 */

/** Ran-out follow-up: after this long without anyone acting on it. */
export const RAN_OUT_FOLLOW_UP_HOURS = 12;
/** …but not about things that ran out long ago (also stops a burst on the first run). */
export const RAN_OUT_FOLLOW_UP_MAX_HOURS = 72;
/** The weekly reminder goes out in this window after the chosen time (GitHub runs late at times). */
export const WEEKLY_WINDOW_MINUTES = 120;

const HOUR_MS = 3600_000;

/** PRO-5: days before the use-by date to alert. null = off. */
export function expiryLeadDays(alert: ExpiryAlert): number | null {
  return { off: null, same_day: 0, '1_day': 1, '2_days': 2 }[alert];
}

/** "milk", "milk and eggs", "milk, eggs and rice", "milk, eggs and 3 more". */
export function nameList(names: readonly string[]): string {
  const n = names.map((x) => x.trim().toLowerCase());
  if (n.length <= 1) return n[0] ?? '';
  if (n.length === 2) return `${n[0]} and ${n[1]}`;
  if (n.length === 3) return `${n[0]}, ${n[1]} and ${n[2]}`;
  return `${n[0]}, ${n[1]} and ${n.length - 2} more`;
}

/**
 * Expiry alert: active items whose use-by date is the person's lead time from today (their local
 * date). One push a day for all of them; the key is the day, so later runs that day send nothing.
 */
export function expiryAlert(input: {
  items: readonly PantryItem[];
  alert: ExpiryAlert;
  localDate: IsoDate;
}): { key: string; payload: PushPayload } | null {
  const lead = expiryLeadDays(input.alert);
  if (lead === null) return null;
  const on = addDays(input.localDate, lead);
  const due = input.items
    .filter((i) => i.status === 'active' && i.expiresOn === on)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (due.length === 0) return null;
  const names = nameList(due.map((i) => i.name));
  const one = due.length === 1;
  const when = lead === 0 ? 'today' : lead === 1 ? 'tomorrow' : 'in 2 days';
  const cap = names.charAt(0).toUpperCase() + names.slice(1);
  return {
    key: `expiry:${input.localDate}`,
    payload: {
      title: `${cap} ${one ? 'expires' : 'expire'} ${when}`,
      body: one ? 'Use it before you lose it.' : 'Use them before you lose them.',
      url: '/',
      tag: 'expiry',
    },
  };
}

/** The key that marks one ran-out item as followed up, so it's never sent again. */
export const ranOutFollowUpKey = (item: Pick<PantryItem, 'id' | 'outAt'>) =>
  `ran_out_later:${item.id}:${item.outAt ?? 'x'}`;

/**
 * Ran-out follow-up (SRS 8.8): things that ran out 12 to 72 hours ago that nobody has put on a
 * list and this person hasn't put off ("Later") or dismissed ("Not needed") on Reminders.
 * When it ran out comes from the `ran_out` activity; without one, the end of its out day.
 */
export function ranOutFollowUps(input: {
  pantry: readonly PantryItem[];
  listItems: readonly ListItem[];
  activity: readonly Activity[];
  state: ReminderState;
  localDate: IsoDate;
  now: Date;
}): PantryItem[] {
  const { ranOut } = remindersFor({
    pantry: input.pantry,
    listItems: input.listItems,
    activity: input.activity,
    state: input.state,
    today: input.localDate,
  });
  const ranOutAt = (item: PantryItem) => {
    const times = input.activity
      .filter((a) => a.type === 'ran_out' && a.itemId === item.id)
      .map((a) => Date.parse(a.createdAt))
      .filter((n) => !Number.isNaN(n));
    if (times.length) return Math.max(...times);
    return item.outAt ? Date.parse(`${item.outAt}T23:59:59Z`) : null;
  };
  const now = input.now.getTime();
  return ranOut
    .filter((r) => !r.listItem)
    .map((r) => r.item)
    .filter((item) => {
      const at = ranOutAt(item);
      if (at === null) return false;
      const hours = (now - at) / HOUR_MS;
      return hours >= RAN_OUT_FOLLOW_UP_HOURS && hours <= RAN_OUT_FOLLOW_UP_MAX_HOURS;
    });
}

/** RMD-4: one push for all of a person's follow-ups. */
export function ranOutFollowUpPayload(items: readonly PantryItem[]): PushPayload {
  const names = nameList(items.map((i) => i.name));
  const one = items.length === 1;
  return {
    title: `Still out of ${names}`,
    body: `${one ? 'It isn’t' : 'They aren’t'} on a list yet. Add ${one ? 'it' : 'them'} so someone picks ${one ? 'it' : 'them'} up?`,
    url: '/reminders',
    tag: 'ran_out_later',
    actions: [
      { action: 'open', title: 'Open reminders', url: '/reminders' },
      { action: 'dismiss', title: 'Not now', url: '' },
    ],
  };
}

/**
 * PRO-5 weekly shopping reminder: on the chosen day, from the chosen time for the next two
 * hours (the hourly job may run late). Returns the key for that day, or null when not due.
 */
export function weeklyReminderDue(
  settings: Pick<NotificationSettings, 'weeklyReminder' | 'weeklyDay' | 'weeklyTime' | 'timeZone'>,
  now: Date,
): string | null {
  if (!settings.weeklyReminder) return null;
  const local = localTime(now, settings.timeZone);
  if (local.weekday !== settings.weeklyDay) return null;
  const [h, m] = settings.weeklyTime.split(':').map(Number) as [number, number];
  const since = local.hour * 60 + local.minute - (h * 60 + m);
  if (since < 0 || since >= WEEKLY_WINDOW_MINUTES) return null;
  return `weekly:${local.date}`;
}

/** RMD-4 weekly reminder with a list summary: "7 things on Apartment 4B · 2 on Diwali party". */
export function weeklyPayload(lists: readonly { name: string; open: number }[]): PushPayload {
  const withItems = lists.filter((l) => l.open > 0).sort((a, b) => b.open - a.open);
  const summary = withItems
    .slice(0, 3)
    .map(
      (l, i) => `${l.open} ${i === 0 ? (l.open === 1 ? 'thing' : 'things') + ' ' : ''}on ${l.name}`,
    )
    .join(' · ');
  return {
    title: 'Time to plan this week’s shop',
    body: withItems.length ? summary : 'Your lists are empty. Add what you need for the week.',
    url: '/lists',
    tag: 'weekly',
  };
}
