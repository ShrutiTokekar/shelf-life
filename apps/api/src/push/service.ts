import {
  DEFAULT_NOTIFICATION_SETTINGS,
  inQuietHours,
  MAX_PUSHES_PER_DAY,
  newId,
  type PushPayload,
  type PushSubscriptionInput,
} from '@shelf-life/shared';
import { and, count, eq, gte, inArray, lt } from 'drizzle-orm';
import webpush from 'web-push';
import type { Db } from '../db/client';
import { schema } from '../db/client';
import type { Env } from '../env';

/** What sending one push does; swapped in tests. Throws with `statusCode` like web-push. */
export type PushSender = (
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
) => Promise<unknown>;

export type PushOutcome = 'sent' | 'off' | 'quiet' | 'repeat' | 'limit' | 'no-device';

const DAY_MS = 24 * 3600_000;

/**
 * Web Push (SRS 8.8, RMD-4, RMD-5). Each push goes to a person (all their devices) under a key
 * that's never sent twice. It respects quiet hours (10 PM to 8 AM in their time zone) and at most
 * 3 a day. Devices the push service says are gone (404/410) are forgotten. With no VAPID keys,
 * push is off and reminders stay in the app.
 */
export function pushService(deps: {
  db: Db;
  env: Pick<Env, 'VAPID_PUBLIC_KEY' | 'VAPID_PRIVATE_KEY' | 'VAPID_SUBJECT' | 'APP_URL'>;
  send?: PushSender;
  now?: () => Date;
}) {
  const { db, env } = deps;
  const now = deps.now ?? (() => new Date());
  const enabled = !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
  const send: PushSender =
    deps.send ??
    ((sub, payload) =>
      webpush.sendNotification(sub, payload, {
        vapidDetails: {
          subject: env.VAPID_SUBJECT ?? env.APP_URL,
          publicKey: env.VAPID_PUBLIC_KEY!,
          privateKey: env.VAPID_PRIVATE_KEY!,
        },
        TTL: 12 * 3600,
      }));

  async function settingsOf(userIds: string[]) {
    const rows = userIds.length
      ? await db
          .select({
            userId: schema.userSettings.userId,
            timeZone: schema.userSettings.timeZone,
            notifyRanOut: schema.userSettings.notifyRanOut,
          })
          .from(schema.userSettings)
          .where(inArray(schema.userSettings.userId, userIds))
      : [];
    const byId = new Map(rows.map((r) => [r.userId, r]));
    return (id: string) =>
      byId.get(id) ?? {
        userId: id,
        timeZone: DEFAULT_NOTIFICATION_SETTINGS.timeZone,
        notifyRanOut: DEFAULT_NOTIFICATION_SETTINGS.notifyRanOut,
      };
  }

  /** Send one notification to one person, if the rules allow. */
  async function notify(userId: string, key: string, payload: PushPayload): Promise<PushOutcome> {
    if (!enabled) return 'off';
    const t = now();
    const { timeZone } = (await settingsOf([userId]))(userId);
    if (inQuietHours(t, timeZone)) return 'quiet';
    const subs = await db
      .select()
      .from(schema.pushSubscription)
      .where(eq(schema.pushSubscription.userId, userId));
    if (subs.length === 0) return 'no-device';
    const [{ n }] = (await db
      .select({ n: count() })
      .from(schema.pushSent)
      .where(
        and(
          eq(schema.pushSent.userId, userId),
          gte(schema.pushSent.sentAt, new Date(t.getTime() - DAY_MS)),
        ),
      )) as [{ n: number }];
    if (n >= MAX_PUSHES_PER_DAY) return 'limit';
    const claimed = await db
      .insert(schema.pushSent)
      .values({ userId, key, sentAt: t })
      .onConflictDoNothing()
      .returning();
    if (claimed.length === 0) return 'repeat';
    // Keep the log small: a week is plenty for "no repeats" and the daily cap.
    await db
      .delete(schema.pushSent)
      .where(lt(schema.pushSent.sentAt, new Date(t.getTime() - 7 * DAY_MS)));
    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410)
            await db.delete(schema.pushSubscription).where(eq(schema.pushSubscription.id, s.id));
        }
      }),
    );
    return 'sent';
  }

  return {
    enabled,
    publicKey: enabled ? env.VAPID_PUBLIC_KEY! : null,
    settingsOf,
    notify,

    /** POST /push/subscriptions: this device, for this person (a device moves with sign-in). */
    async subscribe(userId: string, sub: PushSubscriptionInput, userAgent: string | null) {
      const id = newId();
      const [row] = await db
        .insert(schema.pushSubscription)
        .values({
          id,
          userId,
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
          userAgent: userAgent?.slice(0, 200) ?? null,
        })
        .onConflictDoUpdate({
          target: schema.pushSubscription.endpoint,
          set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        })
        .returning({ id: schema.pushSubscription.id });
      return { id: row!.id };
    },

    async unsubscribe(userId: string, id: string) {
      await db
        .delete(schema.pushSubscription)
        .where(and(eq(schema.pushSubscription.id, id), eq(schema.pushSubscription.userId, userId)));
    },
  };
}

export type PushService = ReturnType<typeof pushService>;
