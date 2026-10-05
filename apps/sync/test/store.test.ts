import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { schema, type Db } from '@shelf-life/api/sync';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dbStore } from '../src/store';

let client: PGlite;
let db: Db;
beforeEach(async () => {
  client = new PGlite();
  const pg = drizzle(client, { schema });
  await migrate(pg, {
    migrationsFolder: fileURLToPath(new URL('../../api/drizzle', import.meta.url)),
  });
  db = pg as unknown as Db;
});
afterEach(async () => {
  await client.close();
});

const LIST = '0192f0c0-0000-7000-8000-00000000000a';
const PANTRY = '0192f0c0-0000-7000-8000-00000000000b';

async function seed() {
  const now = new Date();
  for (const id of ['owner', 'viewer', 'friend'])
    await db.insert(schema.user).values({
      id,
      name: id,
      email: `${id}@example.com`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
  await db.insert(schema.pantry).values({ id: PANTRY, ownerId: 'owner' });
  await db.insert(schema.list).values({
    id: LIST,
    pantryId: PANTRY,
    name: 'Home',
    color: 'navy',
    ownerId: 'owner',
    isHome: true,
  });
  await db.update(schema.pantry).set({ homeListId: LIST }).where(eq(schema.pantry.id, PANTRY));
  await db.insert(schema.listMember).values([
    { listId: LIST, userId: 'owner', role: 'owner' },
    { listId: LIST, userId: 'viewer', role: 'view' },
  ]);
}

describe('dbStore (SRS 8.7 yjs_docs)', () => {
  it('saves, overwrites and loads doc state; tracks waiting carts', async () => {
    await seed();
    const store = dbStore(db);
    expect(await store.load(`list:${LIST}`)).toBeNull();
    await store.save(`list:${LIST}`, new Uint8Array([1, 2, 3]), true);
    await store.save(`list:${LIST}`, new Uint8Array([4, 5]), true);
    await store.save(`pantry:${PANTRY}`, new Uint8Array([9]), false);
    expect([...(await store.load(`list:${LIST}`))!]).toEqual([4, 5]);
    expect(await store.pendingCarts()).toEqual([`list:${LIST}`]);
  });

  it('checks access against list membership and finds a list’s pantry', async () => {
    await seed();
    const store = dbStore(db);
    expect(await store.access('owner', `pantry:${PANTRY}`)).toBe('write');
    expect(await store.access('viewer', `list:${LIST}`)).toBe('read');
    expect(await store.access('friend', `list:${LIST}`)).toBeNull();
    expect(await store.pantryOf(LIST)).toBe(PANTRY);
    expect(await store.pantryOf('0192f0c0-0000-7000-8000-0000000000ff')).toBeNull();
  });

  it('PRO-6 never writes back a doc whose list or pantry was deleted', async () => {
    await seed();
    const store = dbStore(db);
    await store.save(`list:${LIST}`, new Uint8Array([1]), false);
    await db.delete(schema.yjsDoc);
    await db.delete(schema.pantry).where(eq(schema.pantry.id, PANTRY));
    // Someone still had them open: the next save must not bring them back.
    await store.save(`list:${LIST}`, new Uint8Array([2]), false);
    await store.save(`pantry:${PANTRY}`, new Uint8Array([3]), false);
    await store.save('other:x', new Uint8Array([4]), false);
    expect(await db.select().from(schema.yjsDoc)).toEqual([]);
  });
});
