import { and, eq } from 'drizzle-orm';
import { newId, type CreateListInput, createListInputSchema } from '@shelf-life/shared';
import type { Db } from '../db/client';
import { schema } from '../db/client';

export type ListRow = typeof schema.list.$inferSelect;

export class ConflictError extends Error {}
export class NotFoundError extends Error {}
export class ForbiddenError extends Error {}

/**
 * POST /lists (SRS 11.1). The user's first list becomes the home list and creates their pantry
 * in the same transaction (WEL-4, SRS 8.9). Later calls add another list to the same pantry.
 */
export async function createList(db: Db, userId: string, input: CreateListInput): Promise<ListRow> {
  const data = createListInputSchema.parse(input);
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.pantry)
        .where(eq(schema.pantry.ownerId, userId))
        .limit(1);

      const isHome = !existing;
      const pantryId = existing?.id ?? newId();
      const listId = newId();

      if (isHome) {
        await tx.insert(schema.pantry).values({ id: pantryId, ownerId: userId });
      }
      const [created] = await tx
        .insert(schema.list)
        .values({
          id: listId,
          pantryId,
          name: data.name,
          color: data.color,
          ownerId: userId,
          isHome,
          // The home list owns the pantry, so it is never private.
          isPrivate: isHome ? false : data.isPrivate,
          shopBy: data.shopBy ?? null,
        })
        .returning();
      await tx.insert(schema.listMember).values({ listId, userId, role: 'owner' });
      if (isHome) {
        await tx
          .update(schema.pantry)
          .set({ homeListId: listId })
          .where(eq(schema.pantry.id, pantryId));
        await tx.insert(schema.userSettings).values({ userId }).onConflictDoNothing();
      }
      return created!;
    });
  } catch (err) {
    // Two home-list requests racing (e.g. a double tap): the unique pantry owner index rejects
    // the second one. Report it as a conflict so the client just reloads /me.
    if (isUniqueViolation(err)) throw new ConflictError('Your home list already exists.');
    throw err;
  }
}

/** DELETE /lists/:id. Owners can delete non-home lists; the home list lives as long as the pantry. */
export async function deleteList(db: Db, userId: string, listId: string): Promise<void> {
  const [row] = await db.select().from(schema.list).where(eq(schema.list.id, listId)).limit(1);
  if (!row) throw new NotFoundError('List not found.');
  const [membership] = await db
    .select()
    .from(schema.listMember)
    .where(and(eq(schema.listMember.listId, listId), eq(schema.listMember.userId, userId)))
    .limit(1);
  if (!membership) throw new NotFoundError('List not found.');
  if (membership.role !== 'owner') throw new ForbiddenError('Only the owner can delete this list.');
  if (row.isHome)
    throw new ForbiddenError('Your home list can’t be deleted while you have a pantry.');
  await db.delete(schema.list).where(eq(schema.list.id, listId));
}

function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; current && depth < 5; depth++) {
    if (typeof current === 'object' && 'code' in current && current.code === '23505') return true;
    current = typeof current === 'object' && 'cause' in current ? current.cause : undefined;
  }
  return false;
}
