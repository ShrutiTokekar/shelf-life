import { and, eq } from 'drizzle-orm';
import type { ListRole } from '@shelf-life/shared';
import type { Db } from '../db/client';
import { schema } from '../db/client';

export type DocAccess = 'write' | 'read';

/** The user's role on a list, or null if they aren't on it. */
export async function roleOn(db: Db, userId: string, listId: string): Promise<ListRole | null> {
  const [row] = await db
    .select({ role: schema.listMember.role })
    .from(schema.listMember)
    .where(and(eq(schema.listMember.listId, listId), eq(schema.listMember.userId, userId)))
    .limit(1);
  return row?.role ?? null;
}

/**
 * SEC-3 / SHR-5 / SHR-6: what a user may do with a Yjs doc.
 * - `list:<id>`: members of the list; "Can view" members read only.
 * - `pantry:<id>`: members of that pantry's home list (SRS 8.9). Members of its other lists never
 *   see the pantry; "Can view" home-list members read only.
 * Checked by the API when it issues a sync token and again by the sync service on connect.
 */
export async function docAccess(
  db: Db,
  userId: string,
  docName: string,
): Promise<DocAccess | null> {
  const [kind, id] = docName.split(':') as [string, string | undefined];
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  let role: ListRole | null = null;
  if (kind === 'list') {
    role = await roleOn(db, userId, id);
  } else if (kind === 'pantry') {
    const [pantry] = await db
      .select({ homeListId: schema.pantry.homeListId })
      .from(schema.pantry)
      .where(eq(schema.pantry.id, id))
      .limit(1);
    if (pantry?.homeListId) role = await roleOn(db, userId, pantry.homeListId);
  }
  if (!role) return null;
  return role === 'view' ? 'read' : 'write';
}
