import { docAccess, schema, type Db, type DocAccess } from '@shelf-life/api/sync';
import { eq } from 'drizzle-orm';

/** Everything the sync server needs from Postgres (SRS 8.7). An interface so tests can fake it. */
export type Store = {
  load(name: string): Promise<Uint8Array | null>;
  save(name: string, state: Uint8Array, hasCart: boolean): Promise<void>;
  access(userId: string, name: string): Promise<DocAccess | null>;
  /** The pantry a list stocks (SRS 8.9), or null if the list is gone. */
  pantryOf(listId: string): Promise<string | null>;
  /** Lists with items waiting to move into a pantry, to reload after a restart. */
  pendingCarts(): Promise<string[]>;
};

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
      await db
        .insert(schema.yjsDoc)
        .values({ name, state, hasCart })
        .onConflictDoUpdate({
          target: schema.yjsDoc.name,
          set: { state, hasCart, updatedAt: new Date() },
        });
    },
    access: (userId, name) => docAccess(db, userId, name),
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
