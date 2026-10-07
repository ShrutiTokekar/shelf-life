import { z } from 'zod';

/** RMD-5 quiet hours: 10 PM to 8 AM local. */
export const QUIET_FROM_HOUR = 22;
export const QUIET_UNTIL_HOUR = 8;
/** SRS 8.8: at most 3 pushes per person per day. */
export const MAX_PUSHES_PER_DAY = 3;

/** The local date ("YYYY-MM-DD"), weekday (0 = Sunday) and hour/minute in a time zone. */
export function localTime(at: Date, timeZone: string) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    }).formatToParts(at);
  } catch {
    return localTime(at, 'UTC');
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: weekdays.indexOf(get('weekday')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  };
}

/** RMD-5: is it quiet hours (10 PM to 8 AM) for this person right now? */
export function inQuietHours(at: Date, timeZone: string): boolean {
  const { hour } = localTime(at, timeZone);
  return hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR;
}

/** A browser's Web Push subscription (PushSubscription.toJSON()). */
export const pushSubscriptionInputSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionInputSchema>;

/** POST /push/ran-out: tell the others on that item's list (SRS 8.6, RMD-4). */
export const ranOutPushInputSchema = z.object({
  pantryId: z.uuid(),
  listId: z.uuid(),
  itemId: z.string().min(1).max(80),
  itemName: z.string().trim().min(1).max(60),
});
export type RanOutPushInput = z.infer<typeof ranOutPushInputSchema>;

/** What the service worker shows (RMD-4). `actions` become notification buttons. */
export type PushPayload = {
  title: string;
  body: string;
  /** Where tapping the notification goes. */
  url: string;
  tag: string;
  actions?: { action: string; title: string; url: string }[];
};
