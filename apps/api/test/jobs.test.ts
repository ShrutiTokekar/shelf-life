import { addItems, addListItem, recordActivity } from '@shelf-life/docs';
import { inviteSchema, type ListItem, type PantryItem } from '@shelf-life/shared';
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { schema } from '../src/db/client';
import type { PushSender } from '../src/push/service';
import { setup } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
afterEach(async () => {
  await t?.close();
});

const SECRET = 'cron-secret-cron-secret-cron-secret-42';
const VAPID = { VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', CRON_SECRET: SECRET };
const json = (r: Response) => r.json() as Promise<Record<string, unknown>>;

function item(over: Partial<PantryItem>): PantryItem {
  return {
    id: 'x',
    pantryId: 'p',
    listId: 'l',
    foodId: null,
    name: 'x',
    category: 'other',
    location: 'fridge',
    quantity: 1,
    unit: '',
    note: '',
    purchasedOn: '2026-10-01',
    expiresOn: '2026-10-20',
    expiryIsEstimate: true,
    expirySource: 'dictionary',
    status: 'active',
    outAt: null,
    addedBy: 'u',
    receiptLineId: null,
    updatedAt: '',
    ...over,
  };
}

async function saveDoc(name: string, fill: (doc: Y.Doc) => void) {
  const doc = new Y.Doc();
  fill(doc);
  await t.db
    .insert(schema.yjsDoc)
    .values({ name, state: Y.encodeStateAsUpdate(doc), hasCart: false });
}

/** Ananya (UTC) owns Apartment 4B; Maya (Kolkata) can edit it. */
async function household() {
  const a = await t.signIn('a@example.com', 'Ananya Mehta');
  const home = (await json(
    await t.request('/api/v1/lists', {
      method: 'POST',
      cookie: a.cookie,
      body: JSON.stringify({ name: 'Apartment 4B', color: 'navy' }),
    }),
  )) as { id: string; pantryId: string };
  const b = await t.signIn('b@example.com', 'Maya');
  const inv = inviteSchema.parse(
    await json(
      await t.request(`/api/v1/lists/${home.id}/invites`, {
        method: 'POST',
        cookie: a.cookie,
        body: JSON.stringify({ role: 'edit' }),
      }),
    ),
  );
  await t.request(`/api/v1/invites/${inv.token}/accept`, { method: 'POST', cookie: b.cookie });
  for (const [cookie, n] of [
    [a.cookie, 1],
    [b.cookie, 2],
  ] as const)
    await t.request('/api/v1/push/subscriptions', {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        endpoint: `https://push.example.com/${n}`,
        keys: { p256dh: `p${n}`, auth: `a${n}` },
      }),
    });
  await t.request('/api/v1/me/settings', {
    method: 'PATCH',
    cookie: b.cookie,
    body: JSON.stringify({
      timeZone: 'Asia/Kolkata',
      weeklyReminder: true,
      weeklyDay: 1, // Monday
      weeklyTime: '10:00',
    }),
  });
  const { pantryId, id: listId } = home;
  await saveDoc(`pantry:${pantryId}`, (doc) => {
    const at = { pantryId, listId };
    addItems(doc, [
      item({ ...at, id: 'milk', name: 'Milk', expiresOn: '2026-10-06' }),
      item({ ...at, id: 'eggs', name: 'Eggs', status: 'out', quantity: 0, outAt: '2026-10-04' }),
    ]);
    recordActivity(doc, [
      {
        id: 'act1',
        ...at,
        actorId: a.user.id,
        type: 'ran_out',
        subject: 'Eggs',
        itemId: 'eggs',
        beforeExpiry: null,
        createdAt: '2026-10-04T12:00:00Z',
      },
    ]);
  });
  await saveDoc(`list:${listId}`, (doc) => {
    const rice: ListItem = {
      id: 'rice',
      listId,
      name: 'Rice',
      quantity: null,
      unit: '',
      note: '',
      reason: 'manual',
      recipeId: null,
      pantryItemId: null,
      addedBy: a.user.id,
      claimedBy: null,
      checked: false,
      checkedBy: null,
      checkedAt: null,
      createdAt: '',
    };
    addListItem(doc, rice);
  });
  return { a, b };
}

const run = (auth?: string) =>
  t.app.request('/jobs/reminders', {
    method: 'POST',
    headers: auth ? { authorization: auth } : {},
  });

describe('SRS 8.8 hourly reminders job (POST /jobs/reminders)', () => {
  it('only the GitHub Actions workflow with the secret can run it; without CRON_SECRET it is off', async () => {
    t = await setup({ env: VAPID });
    expect((await run()).status).toBe(401);
    expect((await run('Bearer nope')).status).toBe(401);
    expect((await run(`Bearer ${SECRET}`)).status).toBe(200);
    await t.close();
    t = await setup({ env: { ...VAPID, CRON_SECRET: undefined } });
    expect((await run(`Bearer ${SECRET}`)).status).toBe(401);
  });

  it('RMD-4 RMD-5 PRO-5 expiry alert, ran-out follow-up and weekly reminder, in each person’s time zone, never twice', async () => {
    const sent: { endpoint: string; payload: Record<string, unknown> }[] = [];
    const send: PushSender = async (s, p) => {
      sent.push({ endpoint: s.endpoint, payload: JSON.parse(p) });
    };
    // Monday Oct 5, 05:00 UTC: 10:30 AM for Maya in Kolkata; 5 AM (quiet hours) for Ananya.
    t = await setup({ env: VAPID, pushSend: send, now: () => new Date('2026-10-05T05:00:00Z') });
    await household();

    expect(await json(await run(`Bearer ${SECRET}`))).toEqual({
      people: 2,
      sent: { expiry: 1, ranOut: 1, weekly: 1 },
      unconfirmedDeleted: 0,
    });
    expect(sent.every((s) => s.endpoint === 'https://push.example.com/2')).toBe(true);
    expect(sent.map((s) => s.payload.title)).toEqual([
      'Milk expires tomorrow',
      'Still out of eggs',
      'Time to plan this week’s shop',
    ]);
    expect(sent[2]!.payload.body).toBe('1 thing on Apartment 4B');

    // The next run (or a late duplicate) sends nothing new.
    expect(await json(await run(`Bearer ${SECRET}`))).toEqual({
      people: 2,
      sent: { expiry: 0, ranOut: 0, weekly: 0 },
      unconfirmedDeleted: 0,
    });
    expect(sent).toHaveLength(3);
  });

  it('without VAPID keys nothing is sent and reminders stay in the app', async () => {
    t = await setup({
      env: { CRON_SECRET: SECRET, VAPID_PUBLIC_KEY: undefined, VAPID_PRIVATE_KEY: undefined },
    });
    expect(await json(await run(`Bearer ${SECRET}`))).toEqual({
      people: 0,
      sent: { expiry: 0, ranOut: 0, weekly: 0 },
      unconfirmedDeleted: 0,
    });
  });
});
