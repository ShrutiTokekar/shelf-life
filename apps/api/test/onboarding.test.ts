import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { schema } from '../src/db/client';
import { ConflictError, createList, deleteList, ForbiddenError } from '../src/services/onboarding';
import { setup } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  await t.close();
});

describe('createList', () => {
  it('WEL-4 first list creates the home list, pantry, owner membership and settings', async () => {
    const { user } = await t.signIn();
    const list = await createList(t.db, user.id, { name: 'Home', color: 'navy' });

    expect(list.isHome).toBe(true);
    const [pantry] = await t.db
      .select()
      .from(schema.pantry)
      .where(eq(schema.pantry.ownerId, user.id));
    expect(pantry?.homeListId).toBe(list.id);
    expect(list.pantryId).toBe(pantry?.id);

    const members = await t.db.select().from(schema.listMember);
    expect(members).toEqual([
      expect.objectContaining({ listId: list.id, userId: user.id, role: 'owner' }),
    ]);
    const settings = await t.db.select().from(schema.userSettings);
    expect(settings).toHaveLength(1);
  });

  it('WEL-4 later lists join the same pantry and are not home lists', async () => {
    const { user } = await t.signIn();
    const home = await createList(t.db, user.id, { name: 'Home', color: 'navy' });
    const party = await createList(t.db, user.id, { name: 'Diwali party', color: 'amber' });

    expect(party.isHome).toBe(false);
    expect(party.pantryId).toBe(home.pantryId);
    const pantries = await t.db.select().from(schema.pantry);
    expect(pantries).toHaveLength(1);
  });

  it('WEL-4 the home list is never private', async () => {
    const { user } = await t.signIn();
    const home = await createList(t.db, user.id, { name: 'Home', color: 'navy', isPrivate: true });
    expect(home.isPrivate).toBe(false);
  });

  it('WEL-4 a racing second home-list request is reported as a conflict, not a second pantry', async () => {
    const { user } = await t.signIn();
    const results = await Promise.allSettled([
      createList(t.db, user.id, { name: 'Home', color: 'navy' }),
      createList(t.db, user.id, { name: 'Home', color: 'navy' }),
    ]);
    const pantries = await t.db.select().from(schema.pantry);
    expect(pantries).toHaveLength(1);
    const homes = await t.db.select().from(schema.list).where(eq(schema.list.isHome, true));
    expect(homes).toHaveLength(1);
    for (const r of results) {
      if (r.status === 'rejected') expect(r.reason).toBeInstanceOf(ConflictError);
    }
  });
});

describe('deleteList', () => {
  it('SRS 8.9 the home list cannot be deleted while the pantry exists', async () => {
    const { user } = await t.signIn();
    const home = await createList(t.db, user.id, { name: 'Home', color: 'navy' });
    await expect(deleteList(t.db, user.id, home.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('owner can delete a non-home list', async () => {
    const { user } = await t.signIn();
    await createList(t.db, user.id, { name: 'Home', color: 'navy' });
    const party = await createList(t.db, user.id, { name: 'Party', color: 'amber' });
    await deleteList(t.db, user.id, party.id);
    const lists = await t.db.select().from(schema.list);
    expect(lists.map((l) => l.id)).not.toContain(party.id);
  });
});
