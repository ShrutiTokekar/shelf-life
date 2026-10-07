import { readActivity, readItems, readListItems, readReminderState } from '@shelf-life/docs';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  expiryAlert,
  localTime,
  ranOutFollowUpKey,
  ranOutFollowUpPayload,
  ranOutFollowUps,
  weeklyPayload,
  weeklyReminderDue,
  type ListItem,
  type NotificationSettings,
  type PantryItem,
} from '@shelf-life/shared';
import { inArray } from 'drizzle-orm';
import type * as Y from 'yjs';
import type { Db } from '../db/client';
import { schema } from '../db/client';
import type { PushOutcome, PushService } from '../push/service';
import { loadDoc } from '../services/account';

export type ReminderRun = {
  /** People with at least one device. */
  people: number;
  sent: { expiry: number; ranOut: number; weekly: number };
};

/**
 * The hourly reminders job (SRS 8.8, Milestone 8d), run by POST /jobs/reminders. For each person
 * with push on a device, in their own time zone: expiry alerts (PRO-5 timing), ran-out follow-ups
 * (12 h with nobody acting on it) and the weekly shopping reminder (RMD-4). The push service
 * applies quiet hours, 3 a day and never twice, so running it again, or late, is safe.
 * Reads the saved Yjs docs (every 30 s, SRS 8.7); running low isn't pushed (stays in the app).
 */
export async function runReminders(deps: {
  db: Db;
  push: PushService;
  now?: () => Date;
}): Promise<ReminderRun> {
  const { db, push } = deps;
  const now = (deps.now ?? (() => new Date()))();
  const run: ReminderRun = { people: 0, sent: { expiry: 0, ranOut: 0, weekly: 0 } };
  if (!push.enabled) return run;

  const userIds = [
    ...new Set(
      (
        await db.select({ userId: schema.pushSubscription.userId }).from(schema.pushSubscription)
      ).map((r) => r.userId),
    ),
  ];
  run.people = userIds.length;
  if (userIds.length === 0) return run;

  const settingsRows = await db
    .select()
    .from(schema.userSettings)
    .where(inArray(schema.userSettings.userId, userIds));
  const settingsOf = (id: string): NotificationSettings => {
    const r = settingsRows.find((s) => s.userId === id);
    return r
      ? {
          notifyRanOut: r.notifyRanOut,
          expiryAlert: r.expiryAlert,
          weeklyReminder: r.weeklyReminder,
          weeklyDay: r.weeklyDay,
          weeklyTime: r.weeklyTime,
          timeZone: r.timeZone,
        }
      : DEFAULT_NOTIFICATION_SETTINGS;
  };

  const memberships = await db
    .select({
      userId: schema.listMember.userId,
      listId: schema.listMember.listId,
      role: schema.listMember.role,
    })
    .from(schema.listMember)
    .where(inArray(schema.listMember.userId, userIds));
  const listIds = [...new Set(memberships.map((m) => m.listId))];
  const myLists = listIds.length
    ? await db
        .select({ id: schema.list.id, name: schema.list.name, pantryId: schema.list.pantryId })
        .from(schema.list)
        .where(inArray(schema.list.id, listIds))
    : [];
  // SHR-6: a pantry is seen by the members of its home list only.
  const pantries = listIds.length
    ? await db
        .select({ id: schema.pantry.id, homeListId: schema.pantry.homeListId })
        .from(schema.pantry)
        .where(inArray(schema.pantry.homeListId, listIds))
    : [];
  // Every list stocking those pantries, for "is it on a list already?".
  const pantryLists = pantries.length
    ? await db
        .select({ id: schema.list.id, pantryId: schema.list.pantryId })
        .from(schema.list)
        .where(
          inArray(
            schema.list.pantryId,
            pantries.map((p) => p.id),
          ),
        )
    : [];

  const docs = new Map<string, Promise<Y.Doc | null>>();
  const doc = (name: string) => {
    if (!docs.has(name)) docs.set(name, loadDoc(db, name));
    return docs.get(name)!;
  };
  const listItemsOf = async (listId: string): Promise<ListItem[]> => {
    const d = await doc(`list:${listId}`);
    return d ? readListItems(d) : [];
  };

  const count = (o: PushOutcome, kind: keyof ReminderRun['sent']) => {
    if (o === 'sent') run.sent[kind] += 1;
  };

  for (const userId of userIds) {
    const settings = settingsOf(userId);
    const localDate = localTime(now, settings.timeZone).date;
    const mine = memberships.filter((m) => m.userId === userId);
    const myPantries = pantries.flatMap((p) => {
      const m = mine.find((x) => x.listId === p.homeListId);
      return m ? [{ id: p.id, canEdit: m.role !== 'view' }] : [];
    });

    // 1. Expiry alerts, for everything in the pantries this person sees.
    const items: PantryItem[] = [];
    for (const p of myPantries) {
      const d = await doc(`pantry:${p.id}`);
      if (d) items.push(...readItems(d));
    }
    const expiry = expiryAlert({ items, alert: settings.expiryAlert, localDate });
    if (expiry) count(await push.notify(userId, expiry.key, expiry.payload), 'expiry');

    // 2. Ran out 12 h ago and still not on a list (people who can add it, who want these).
    if (settings.notifyRanOut) {
      const followUps: PantryItem[] = [];
      for (const p of myPantries.filter((x) => x.canEdit)) {
        const d = await doc(`pantry:${p.id}`);
        if (!d) continue;
        const listItems = (
          await Promise.all(
            pantryLists.filter((l) => l.pantryId === p.id).map((l) => listItemsOf(l.id)),
          )
        ).flat();
        followUps.push(
          ...ranOutFollowUps({
            pantry: readItems(d),
            listItems,
            activity: readActivity(d),
            state: readReminderState(d, userId),
            localDate,
            now,
          }),
        );
      }
      const sent = await push.sentKeys(userId, followUps.map(ranOutFollowUpKey));
      const due = followUps.filter((i) => !sent.has(ranOutFollowUpKey(i)));
      if (due.length)
        count(
          await push.notify(userId, due.map(ranOutFollowUpKey), ranOutFollowUpPayload(due)),
          'ranOut',
        );
    }

    // 3. Weekly shopping reminder with a summary of this person's lists.
    const weeklyKey = weeklyReminderDue(settings, now);
    if (weeklyKey) {
      const lists = await Promise.all(
        myLists
          .filter((l) => mine.some((m) => m.listId === l.id))
          .map(async (l) => ({
            name: l.name,
            open: (await listItemsOf(l.id)).filter((i) => !i.checked).length,
          })),
      );
      count(await push.notify(userId, weeklyKey, weeklyPayload(lists)), 'weekly');
    }
  }
  return run;
}
