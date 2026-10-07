import { docAccess, schema, type Db, type DocAccess } from '@shelf-life/api/sync';
import { and, eq, gt } from 'drizzle-orm';

/** Everything the sync server needs from Postgres (SRS 8.7). An interface so tests can fake it. */
export type Store = {
  load(name: string): Promise<Uint8Array | null>;
  save(name: string, state: Uint8Array, hasCart: boolean): Promise<void>;
  access(userId: string, name: string): Promise<DocAccess | null>;
  /** SEC-9: does this person still have a session that hasn't run out (on any device)? */
  signedIn(userId: string, at: Date): Promise<boolean>;
  /** The pantry a list stocks (SRS 8.9), or null if the list is gone. */
  pantryOf(listId: string): Promise<string | null>;
  /** Lists with items waiting to move into a pantry, to reload after a restart. */
  pendingCarts(): Promise<string[]>;
};

/** Is the pantry or list behind "pantry:<id>" / "list:<id>" still there? */
async function exists(db: Db, name: string): Promise<boolean> {
  const [kind, id] = name.split(':') as [string, string];
  const table = kind === 'pantry' ? schema.pantry : kind === 'list' ? schema.list : null;
  if (!table || !id) return false;
  const [row] = await db.select({ id: table.id }).from(table).where(eq(table.id, id)).limit(1);
  return !!row;
}

export function dbStore(db: Db): Store {
  return {
    async load(name) {
      const [row] = await db
        .select({ state: schema.yjsDoc.state })
        .from(schema.yjsDoc)
        .where(eq(schema.yjsDoc.name, name))
        .limit(1);
      return row ? new Uint8Array(row.state) : null;
    },
    async save(name, state, hasCart) {
      // Never write back a doc whose list or pantry was deleted (list deleted, account deleted,
      // PRO-6) while someone still had it open: that would bring the data back.
      if (!(await exists(db, name))) return;
      await db
        .insert(schema.yjsDoc)
        .values({ name, state, hasCart })
        .onConflictDoUpdate({
          target: schema.yjsDoc.name,
          set: { state, hasCart, updatedAt: new Date() },
        });
    },
    access: (userId, name) => docAccess(db, userId, name),
    async signedIn(userId, at) {
      const [row] = await db
        .select({ id: schema.session.id })
        .from(schema.session)
        .where(and(eq(schema.session.userId, userId), gt(schema.session.expiresAt, at)))
        .limit(1);
      return !!row;
    },
    async pantryOf(listId) {
      const [row] = await db
        .select({ pantryId: schema.list.pantryId })
        .from(schema.list)
        .where(eq(schema.list.id, listId))
        .limit(1);
      return row?.pantryId ?? null;
    },
    async pendingCarts() {
      const rows = await db
        .select({ name: schema.yjsDoc.name })
        .from(schema.yjsDoc)
        .where(eq(schema.yjsDoc.hasCart, true));
      return rows.map((r) => r.name);
    },
  };
}
