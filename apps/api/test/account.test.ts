import { addItems, putReceipt } from '@shelf-life/docs';
import { inviteSchema, meResponseSchema, type PantryItem, type Receipt } from '@shelf-life/shared';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { schema } from '../src/db/client';
import { setup } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
afterEach(async () => {
  await t?.close();
});

const json = (r: Response) => r.json() as Promise<Record<string, unknown>>;

async function homeFor(email: string, name: string, listName = 'Home') {
  const { cookie, user } = await t.signIn(email, name);
  const list = (await json(
    await t.request('/api/v1/lists', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ name: listName, color: 'navy' }),
    }),
  )) as { id: string; pantryId: string };
  return { cookie, user, listId: list.id, pantryId: list.pantryId };
}

async function saveDoc(name: string, fill: (doc: Y.Doc) => void) {
  const doc = new Y.Doc();
  fill(doc);
  await t.db
    .insert(schema.yjsDoc)
    .values({ name, state: Y.encodeStateAsUpdate(doc), hasCart: false });
}

describe('PRO-1 PATCH /me/profile', () => {
  it('changes the display name; empty names are refused', async () => {
    t = await setup({ ai: null });
    const { cookie } = await homeFor('a@example.com', 'Ananya');
    const res = await t.request('/api/v1/me/profile', {
      method: 'PATCH',
      cookie,
      body: JSON.stringify({ displayName: '  Ananya M  ' }),
    });
    expect(res.status).toBe(204);
    const me = meResponseSchema.parse(await json(await t.request('/api/v1/me', { cookie })));
    expect(me.user.displayName).toBe('Ananya M');
    const bad = await t.request('/api/v1/me/profile', {
      method: 'PATCH',
      cookie,
      body: JSON.stringify({ displayName: ' ' }),
    });
    expect(bad.status).toBe(400);
  });
});

describe('PRO-6 GET /me/export', () => {
  it('downloads my lists, pantry, receipts (text only) and members by name, never emails', async () => {
    t = await setup({ ai: null });
    const a = await homeFor('a@example.com', 'Ananya');
    const b = await t.signIn('b@example.com', 'Bina');
    const inv = inviteSchema.parse(
      await json(
        await t.request(`/api/v1/lists/${a.listId}/invites`, {
          method: 'POST',
          cookie: a.cookie,
          body: JSON.stringify({ role: 'edit' }),
        }),
      ),
    );
    await t.request(`/api/v1/invites/${inv.token}/accept`, { method: 'POST', cookie: b.cookie });
    await saveDoc(`pantry:${a.pantryId}`, (doc) => {
      addItems(doc, [
        {
          id: 'i1',
          pantryId: a.pantryId,
          listId: a.listId,
          foodId: 'spinach',
          name: 'Spinach',
          category: 'produce',
          location: 'fridge',
          quantity: 1,
          unit: 'bag',
          note: '',
          purchasedOn: '2026-10-01',
          expiresOn: '2026-10-05',
          expiryIsEstimate: true,
          expirySource: 'dictionary',
          status: 'active',
          outAt: null,
          addedBy: a.user.id,
          receiptLineId: null,
          updatedAt: '',
        } satisfies PantryItem,
      ]);
      putReceipt(doc, {
        id: 'r1',
        pantryId: a.pantryId,
        listId: a.listId,
        storeName: 'Patel Brothers',
        purchasedOn: '2026-10-01',
        total: 1.99,
        scannedBy: a.user.id,
        lineCount: 1,
        itemsAdded: 1,
        reviewState: 'clean',
        lines: [
          {
            id: 'r1:0',
            index: 0,
            rawText: 'SPINACH 1.99',
            price: 1.99,
            kind: 'item',
            skipReason: null,
            matchName: 'Spinach',
            matchSource: 'parser',
            confidence: 0.95,
            confirmed: true,
            edited: false,
            pantryItemId: 'i1',
          },
        ],
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      } satisfies Receipt);
    });

    const res = await t.request('/api/v1/me/export', { cookie: a.cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toMatch(/attachment; filename="shelf-life-/);
    const body = await res.text();
    const data = JSON.parse(body) as {
      lists: { name: string; members: { name: string; role: string }[] }[];
      pantries: { items: { name: string }[]; receipts: { storeName: string }[] }[];
    };
    expect(data.lists[0]!.members).toEqual([
      { name: 'Ananya', role: 'owner' },
      { name: 'Bina', role: 'edit' },
    ]);
    expect(data.pantries[0]!.items.map((i) => i.name)).toEqual(['Spinach']);
    expect(data.pantries[0]!.receipts[0]!.storeName).toBe('Patel Brothers');
    expect(body).not.toContain('b@example.com');
    expect((await t.request('/api/v1/me/export')).status).toBe(401);
  });
});

describe('PRO-6 DELETE /me', () => {
  it('deletes the account, its pantry and lists (with their saved docs); others keep theirs', async () => {
    t = await setup({ ai: null });
    const a = await homeFor('a@example.com', 'Ananya');
    const b = await homeFor('b@example.com', 'Bina', 'Bina home');
    // B joins A's home list; A joins B's.
    for (const [owner, joiner] of [
      [a, b],
      [b, a],
    ] as const) {
      const inv = inviteSchema.parse(
        await json(
          await t.request(`/api/v1/lists/${owner.listId}/invites`, {
            method: 'POST',
            cookie: owner.cookie,
            body: JSON.stringify({ role: 'edit' }),
          }),
        ),
      );
      await t.request(`/api/v1/invites/${inv.token}/accept`, {
        method: 'POST',
        cookie: joiner.cookie,
      });
    }
    await saveDoc(`pantry:${a.pantryId}`, () => undefined);
    await saveDoc(`list:${a.listId}`, () => undefined);
    await saveDoc(`list:${b.listId}`, () => undefined);

    const res = await t.request('/api/v1/me', { method: 'DELETE', cookie: a.cookie });
    expect(res.status).toBe(204);

    expect(await t.db.select().from(schema.user).where(eq(schema.user.id, a.user.id))).toEqual([]);
    expect(await t.db.select().from(schema.pantry).where(eq(schema.pantry.id, a.pantryId))).toEqual(
      [],
    );
    const docs = (await t.db.select().from(schema.yjsDoc)).map((d) => d.name);
    expect(docs).toEqual([`list:${b.listId}`]);
    // A's session is gone; B still has their own home list, without A.
    expect((await t.request('/api/v1/me', { cookie: a.cookie })).status).toBe(401);
    const bMe = meResponseSchema.parse(
      await json(await t.request('/api/v1/me', { cookie: b.cookie })),
    );
    expect(bMe.lists.map((l) => l.name)).toEqual(['Bina home']);
    expect(bMe.lists[0]!.members.map((m) => m.displayName)).toEqual(['Bina']);
  });

  it('SEC-2 a cross-site request can’t delete the account', async () => {
    t = await setup({ ai: null });
    const a = await homeFor('a@example.com', 'Ananya');
    const res = await t.request('/api/v1/me', {
      method: 'DELETE',
      cookie: a.cookie,
      headers: { origin: 'https://evil.example' },
    });
    expect(res.status).toBe(403);
  });
});
