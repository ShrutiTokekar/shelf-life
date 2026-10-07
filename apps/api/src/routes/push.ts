import { Hono } from 'hono';
import { pushSubscriptionInputSchema, ranOutPushInputSchema, todayIso } from '@shelf-life/shared';
import { and, eq, ne } from 'drizzle-orm';
import { schema } from '../db/client';
import type { PushService } from '../push/service';
import { docAccess } from '../services/access';
import { NotFoundError } from '../services/onboarding';
import type { AppEnv } from '../types';

/** /push/* (SRS 11.1, 8.8). */
export function pushRoutes(push: PushService) {
  return (
    new Hono<AppEnv>()
      .get('/key', (c) => c.json({ enabled: push.enabled, publicKey: push.publicKey }))
      .post('/subscriptions', async (c) => {
        const sub = pushSubscriptionInputSchema.parse(await c.req.json().catch(() => ({})));
        return c.json(await push.subscribe(c.var.user.id, sub, c.req.header('user-agent') ?? null));
      })
      .delete('/subscriptions/:id', async (c) => {
        await push.unsubscribe(c.var.user.id, c.req.param('id'));
        return c.body(null, 204);
      })
      /**
       * SRS 8.6 / RMD-4: "You're out of eggs" to the others on that item's list who want it.
       * The app calls this right after marking something out (when online; the hourly job
       * follows up on anything not acted on). Only people who can edit the pantry can send it.
       */
      .post('/ran-out', async (c) => {
        const input = ranOutPushInputSchema.parse(await c.req.json().catch(() => ({})));
        const db = c.var.db;
        const me = c.var.user;
        if ((await docAccess(db, me.id, `pantry:${input.pantryId}`)) !== 'write')
          throw new NotFoundError('Pantry not found.');
        const [list] = await db
          .select({ name: schema.list.name })
          .from(schema.list)
          .where(and(eq(schema.list.id, input.listId), eq(schema.list.pantryId, input.pantryId)))
          .limit(1);
        if (!list) throw new NotFoundError('List not found.');
        const members = await db
          .select({ userId: schema.listMember.userId })
          .from(schema.listMember)
          .where(
            and(eq(schema.listMember.listId, input.listId), ne(schema.listMember.userId, me.id)),
          );
        const settings = await push.settingsOf(members.map((m) => m.userId));
        const who = me.name?.trim().split(' ')[0] || 'Someone';
        const item = input.itemName.toLowerCase();
        const outcomes = await Promise.all(
          members
            .filter((m) => settings(m.userId).notifyRanOut)
            .map((m) =>
              push.notify(m.userId, `ran_out:${input.itemId}:${todayIso()}`, {
                title: `You’re out of ${item}`,
                body: `${who} just used the last of it. Add ${item} to the ${list.name} list?`,
                url: '/reminders',
                tag: `ran_out:${input.itemId}`,
                actions: [
                  {
                    action: 'add',
                    title: 'Add to list',
                    url: `/reminders?add=${encodeURIComponent(input.itemId)}`,
                  },
                  { action: 'dismiss', title: 'Not now', url: '' },
                ],
              }),
            ),
        );
        return c.json({ sent: outcomes.filter((o) => o === 'sent').length });
      })
  );
}
