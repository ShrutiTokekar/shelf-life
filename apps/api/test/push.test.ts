import { inviteSchema } from '@shelf-life/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { schema } from '../src/db/client';
import { pushService, type PushSender } from '../src/push/service';
import { setup } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
afterEach(async () => {
  await t?.close();
});

const VAPID = { VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' };
const json = (r: Response) => r.json() as Promise<Record<string, unknown>>;
const sub = (n: number) => ({
  endpoint: `https://push.example.com/${n}`,
  keys: { p256dh: `p${n}`, auth: `a${n}` },
});

async function people() {
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
  return { a, b, listId: home.id, pantryId: home.pantryId };
}

const subscribe = (cookie: string, n: number) =>
  t.request('/api/v1/push/subscriptions', { method: 'POST', cookie, body: JSON.stringify(sub(n)) });

describe('Web Push API (SRS 8.8, RMD-4)', () => {
  it('without VAPID keys push is off: reminders stay in the app', async () => {
    t = await setup({ env: { VAPID_PUBLIC_KEY: undefined, VAPID_PRIVATE_KEY: undefined } });
    const a = await t.signIn();
    expect(await json(await t.request('/api/v1/push/key', { cookie: a.cookie }))).toEqual({
      enabled: false,
      publicKey: null,
    });
  });

  it('saves a device once (the same device moves with sign-in) and removes it', async () => {
    t = await setup({ env: VAPID });
    const { a, b } = await people();
    expect(await json(await t.request('/api/v1/push/key', { cookie: a.cookie }))).toEqual({
      enabled: true,
      publicKey: 'pub',
    });
    const first = (await json(await subscribe(a.cookie, 1))) as { id: string };
    await subscribe(a.cookie, 1);
    await subscribe(b.cookie, 1);
    const rows = await t.db.select().from(schema.pushSubscription);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(b.user.id);
    await t.request(`/api/v1/push/subscriptions/${first.id}`, {
      method: 'DELETE',
      cookie: b.cookie,
    });
    expect(await t.db.select().from(schema.pushSubscription)).toEqual([]);
  });

  it('RMD-4 ran out: notifies the others on that list who want it, never the one who used it', async () => {
    const sent: { endpoint: string; payload: Record<string, unknown> }[] = [];
    const send: PushSender = async (s, p) => {
      sent.push({ endpoint: s.endpoint, payload: JSON.parse(p) });
    };
    // 10:30 AM for Maya in Kolkata: not quiet hours.
    t = await setup({ env: VAPID, pushSend: send, now: () => new Date('2026-10-05T05:00:00Z') });
    const { a, b, listId, pantryId } = await people();
    await subscribe(a.cookie, 1);
    await subscribe(b.cookie, 2);
    await t.request('/api/v1/me/settings', {
      method: 'PATCH',
      cookie: b.cookie,
      body: JSON.stringify({ timeZone: 'Asia/Kolkata' }),
    });
    const body = { pantryId, listId, itemId: 'eggs', itemName: 'Eggs' };
    const post = (cookie: string) =>
      t.request('/api/v1/push/ran-out', { method: 'POST', cookie, body: JSON.stringify(body) });
    expect(await json(await post(a.cookie))).toEqual({ sent: 1 });
    expect(sent).toEqual([
      {
        endpoint: 'https://push.example.com/2',
        payload: expect.objectContaining({
          title: 'You’re out of eggs',
          body: 'Ananya just used the last of it. Add eggs to the Apartment 4B list?',
          actions: [
            expect.objectContaining({ action: 'add', title: 'Add to list' }),
            expect.objectContaining({ action: 'dismiss', title: 'Not now' }),
          ],
        }),
      },
    ]);
    // Never the same one twice.
    expect(await json(await post(a.cookie))).toEqual({ sent: 0 });
    // Turned off: nothing.
    await t.request('/api/v1/me/settings', {
      method: 'PATCH',
      cookie: b.cookie,
      body: JSON.stringify({ notifyRanOut: false }),
    });
    expect(
      await json(
        await t.request('/api/v1/push/ran-out', {
          method: 'POST',
          cookie: a.cookie,
          body: JSON.stringify({ ...body, itemId: 'milk', itemName: 'Milk' }),
        }),
      ),
    ).toEqual({ sent: 0 });
  });

  it('SEC-3 only someone who can edit the pantry can send it', async () => {
    t = await setup({ env: VAPID });
    const { listId, pantryId } = await people();
    const stranger = await t.signIn('x@example.com', 'X');
    const res = await t.request('/api/v1/push/ran-out', {
      method: 'POST',
      cookie: stranger.cookie,
      body: JSON.stringify({ pantryId, listId, itemId: 'eggs', itemName: 'Eggs' }),
    });
    expect(res.status).toBe(404);
  });
});

describe('push rules (SRS 8.8, RMD-5)', () => {
  async function serviceAt(iso: string, send: PushSender) {
    t = await setup({ env: VAPID });
    const a = await t.signIn();
    await subscribe(a.cookie, 1);
    await t.request('/api/v1/me/settings', {
      method: 'PATCH',
      cookie: a.cookie,
      body: JSON.stringify({ timeZone: 'Asia/Kolkata' }),
    });
    const svc = pushService({
      db: t.db,
      env: { ...VAPID, APP_URL: 'https://app.example.com' },
      send,
      now: () => new Date(iso),
    });
    return { svc, userId: a.user.id };
  }
  const payload = { title: 't', body: 'b', url: '/', tag: 'x' };

  it('quiet hours: nothing between 10 PM and 8 AM local', async () => {
    const send = vi.fn(async () => undefined);
    // 23:30 in Kolkata.
    const { svc, userId } = await serviceAt('2026-10-05T18:00:00Z', send);
    expect(await svc.notify(userId, 'k1', payload)).toBe('quiet');
    expect(send).not.toHaveBeenCalled();
  });

  it('at most 3 a day, no repeats, and forgets devices that are gone', async () => {
    const send = vi.fn(async () => undefined);
    // 10:30 in Kolkata.
    const { svc, userId } = await serviceAt('2026-10-05T05:00:00Z', send);
    expect(await svc.notify(userId, 'k1', payload)).toBe('sent');
    expect(await svc.notify(userId, 'k1', payload)).toBe('repeat');
    expect(await svc.notify(userId, 'k2', payload)).toBe('sent');
    expect(await svc.notify(userId, 'k3', payload)).toBe('sent');
    expect(await svc.notify(userId, 'k4', payload)).toBe('limit');
    expect(send).toHaveBeenCalledTimes(3);

    await t.db.delete(schema.pushSent);
    send.mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }));
    await svc.notify(userId, 'k5', payload);
    expect(await t.db.select().from(schema.pushSubscription)).toEqual([]);
    expect(await svc.notify(userId, 'k6', payload)).toBe('no-device');
  });
});
