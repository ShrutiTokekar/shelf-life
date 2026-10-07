import { readActivity, readItems, readListItems, readReceipts } from '@shelf-life/docs';
import { and, asc, eq, inArray, or } from 'drizzle-orm';
import * as Y from 'yjs';
import type { SessionUser } from '../auth';
import type { Db } from '../db/client';
import { schema } from '../db/client';
import { getMe } from './me';
import { listSaved } from './recipes';

/** A saved Yjs doc ("pantry:<id>" / "list:<id>") as of its last save (every 30 s, SRS 8.7). */
export async function loadDoc(db: Db, name: string): Promise<Y.Doc | null> {
  const [row] = await db
    .select({ state: schema.yjsDoc.state })
    .from(schema.yjsDoc)
    .where(eq(schema.yjsDoc.name, name))
    .limit(1);
  if (!row) return null;
  const doc = new Y.Doc();
  Y.applyUpdate(doc, row.state);
  return doc;
}

/**
 * PRO-6 "Download my data" (GET /me/export): everything this person can see, as JSON. Other
 * people appear by name and role only (no emails). Receipts are text lines only: photos never
 * left the device (rule 1).
 */
export async function exportData(db: Db, user: SessionUser) {
  const me = await getMe(db, user);
  const lists = await Promise.all(
    me.lists.map(async (l) => {
      const doc = await loadDoc(db, `list:${l.id}`);
      return {
        id: l.id,
        name: l.name,
        color: l.color,
        role: l.role,
        isHome: l.isHome,
        isPrivate: l.isPrivate,
        shopBy: l.shopBy,
        members: l.members.map((m) => ({ name: m.displayName, role: m.role })),
        items: doc ? readListItems(doc) : [],
      };
    }),
  );
  const pantries = await Promise.all(
    me.pantries.map(async (p) => {
      const doc = await loadDoc(db, `pantry:${p.id}`);
      return {
        id: p.id,
        name: p.name,
        yours: p.own,
        items: doc ? readItems(doc) : [],
        receipts: doc ? readReceipts(doc) : [],
        activity: doc ? readActivity(doc) : [],
      };
    }),
  );
  const threads = await db
    .select()
    .from(schema.chatThread)
    .where(eq(schema.chatThread.userId, user.id));
  const messages = threads.length
    ? await db
        .select()
        .from(schema.chatMessage)
        .where(
          inArray(
            schema.chatMessage.threadId,
            threads.map((t) => t.id),
          ),
        )
        .orderBy(asc(schema.chatMessage.createdAt))
    : [];
  return {
    exportedAt: new Date().toISOString(),
    note: 'Shelf Life data export. Lists and pantries are as of their last sync. Receipt photos are never stored, only their text.',
    user: me.user,
    settings: me.settings,
    lists,
    pantries,
    savedRecipes: await listSaved(db, user.id),
    recipeChats: threads.map((t) => ({
      recipeId: t.recipeId,
      startedAt: t.createdAt.toISOString(),
      messages: messages
        .filter((m) => m.threadId === t.id)
        .map((m) => ({ role: m.role, text: m.text, at: m.createdAt.toISOString() })),
    })),
  };
}

/**
 * PRO-6 Delete account (DELETE /me). Deleting the user cascades to their sessions, settings,
 * saved recipes, chats, memberships, the lists they own and their pantry with its lists (the
 * dialog names any shared ones first). Saved Yjs docs aren't linked by foreign key, so the
 * pantry and list docs that go away are deleted here too.
 */
export async function deleteAccount(db: Db, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const pantries = await tx
      .select({ id: schema.pantry.id })
      .from(schema.pantry)
      .where(eq(schema.pantry.ownerId, userId));
    const pantryIds = pantries.map((p) => p.id);
    const lists = await tx
      .select({ id: schema.list.id })
      .from(schema.list)
      .where(
        pantryIds.length
          ? or(eq(schema.list.ownerId, userId), inArray(schema.list.pantryId, pantryIds))
          : eq(schema.list.ownerId, userId),
      );
    const docs = [...pantryIds.map((id) => `pantry:${id}`), ...lists.map((l) => `list:${l.id}`)];
    if (docs.length) await tx.delete(schema.yjsDoc).where(inArray(schema.yjsDoc.name, docs));
    // Deleting the user cascades: their pantry (and every list stocking it), the lists they own,
    // memberships, settings, saved recipes and chats.
    await tx.delete(schema.user).where(and(eq(schema.user.id, userId)));
  });
}

/** Edit profile (PRO-1): the display name. */
export async function updateProfile(db: Db, userId: string, name: string): Promise<void> {
  await db.update(schema.user).set({ name }).where(eq(schema.user.id, userId));
}
