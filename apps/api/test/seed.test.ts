import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { meResponseSchema } from '@shelf-life/shared';
import { schema } from '../src/db/client';
import { SeedError, seedDemoData } from '../src/db/seedData';
import { createList } from '../src/services/onboarding';
import { setup } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  await t.close();
});

describe('dev seed', () => {
  it('adds Family groceries and Diwali party plus two demo members, and is safe to rerun', async () => {
    const { user, cookie } = await t.signIn('ananya@example.com', 'Ananya Mehta');
    await createList(t.db, user.id, { name: 'Apartment 4B', color: 'navy' });

    await seedDemoData(t.db, 'ananya@example.com');
    await seedDemoData(t.db, 'ananya@example.com');

    const me = meResponseSchema.parse(await (await t.request('/api/v1/me', { cookie })).json());
    expect(me.lists.map((l) => [l.name, l.color])).toEqual([
      ['Apartment 4B', 'navy'],
      ['Family groceries', 'olive'],
      ['Diwali party', 'amber'],
    ]);
    const home = me.lists[0]!;
    expect(home.members.map((m) => [m.displayName, m.role])).toEqual([
      ['Ananya Mehta', 'owner'],
      ['Arjun Patel', 'edit'],
      ['Meera Shah', 'edit'],
    ]);
    const pantries = await t.db.select().from(schema.pantry);
    expect(pantries).toHaveLength(1);
  });

  it('explains when the user hasn’t signed in or finished setup', async () => {
    await expect(seedDemoData(t.db, 'nobody@example.com')).rejects.toBeInstanceOf(SeedError);
    await t.signIn('new@example.com', 'New');
    await expect(seedDemoData(t.db, 'new@example.com')).rejects.toThrow(/home list/);
  });
});

describe('GET /me members', () => {
  it('lists members by name only, never email', async () => {
    const { user, cookie } = await t.signIn('ananya@example.com', 'Ananya Mehta');
    await createList(t.db, user.id, { name: 'Home', color: 'navy' });
    const body = await (await t.request('/api/v1/me', { cookie })).text();
    const me = meResponseSchema.parse(JSON.parse(body));
    expect(me.lists[0]!.members).toEqual([
      { userId: user.id, displayName: 'Ananya Mehta', avatarInitial: 'A', role: 'owner' },
    ]);
    expect(JSON.parse(body).lists[0].members[0]).not.toHaveProperty('email');
  });
});

describe('dev seed concurrency', () => {
  it('two users seeding at the same time share the demo members without errors', async () => {
    const a = await t.signIn('a@example.com', 'A');
    const b = await t.signIn('b@example.com', 'B');
    await createList(t.db, a.user.id, { name: 'Home', color: 'navy' });
    await createList(t.db, b.user.id, { name: 'Home', color: 'navy' });
    await Promise.all([seedDemoData(t.db, 'a@example.com'), seedDemoData(t.db, 'b@example.com')]);
    const demo = (await t.db.select().from(schema.user)).filter((u) => u.email.endsWith('.test'));
    expect(demo).toHaveLength(2);
  });
});
