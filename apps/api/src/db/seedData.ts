import { and, eq } from 'drizzle-orm';
import { newId } from '@shelf-life/shared';
import { createList } from '../services/onboarding';
import type { Db } from './client';
import { schema } from './client';

/** Demo people who show up as "added by" and list members. They can't sign in (no account row). */
export const DEMO_MEMBERS = [
  { name: 'Arjun Patel', email: 'arjun@demo.shelf-life.test' },
  { name: 'Meera Shah', email: 'meera@demo.shelf-life.test' },
] as const;

export const DEMO_LISTS = [
  { name: 'Family groceries', color: 'olive' as const },
  { name: 'Diwali party', color: 'amber' as const },
];

export class SeedError extends Error {}

/**
 * Development seed (Milestone 2): gives an onboarded user two more lists and two demo members, so
 * the pantry's list filters, pantry labels and "added by" avatars have something to show.
 * Safe to run repeatedly. Pantry items themselves live on the device (Yjs + IndexedDB) and are
 * loaded with the "Load sample pantry" button on the empty Pantry page.
 */
export async function seedDemoData(db: Db, email: string) {
  const [owner] = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
  if (!owner) throw new SeedError(`No user with email ${email}. Sign in to the app once first.`);
  const [pantry] = await db
    .select()
    .from(schema.pantry)
    .where(eq(schema.pantry.ownerId, owner.id))
    .limit(1);
  if (!pantry?.homeListId)
    throw new SeedError(`${email} hasn’t created a home list yet. Finish setup in the app first.`);

  // Insert-if-missing, then read back: safe when two seeds run at once (unique email).
  const members = [];
  for (const m of DEMO_MEMBERS) {
    await db
      .insert(schema.user)
      .values({ id: newId(), name: m.name, email: m.email, emailVerified: false })
      .onConflictDoNothing({ target: schema.user.email });
    const [row] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, m.email))
      .limit(1);
    members.push(row!);
  }
  const [arjun, meera] = members as [
    typeof schema.user.$inferSelect,
    typeof schema.user.$inferSelect,
  ];

  const lists = await db.select().from(schema.list).where(eq(schema.list.pantryId, pantry.id));
  const listIds: Record<string, string> = {};
  for (const demo of DEMO_LISTS) {
    const found = lists.find((l) => l.name === demo.name);
    listIds[demo.name] = found
      ? found.id
      : (await createList(db, owner.id, { name: demo.name, color: demo.color })).id;
  }

  const memberships = [
    { listId: pantry.homeListId, userId: arjun.id },
    { listId: pantry.homeListId, userId: meera.id },
    { listId: listIds['Family groceries']!, userId: meera.id },
    { listId: listIds['Diwali party']!, userId: arjun.id },
  ];
  for (const m of memberships) {
    await db
      .insert(schema.listMember)
      .values({ ...m, role: 'edit', invitedBy: owner.id })
      .onConflictDoNothing();
  }

  const allLists = await db
    .select({ name: schema.list.name })
    .from(schema.list)
    .innerJoin(
      schema.listMember,
      and(eq(schema.listMember.listId, schema.list.id), eq(schema.listMember.userId, owner.id)),
    );
  return { lists: allLists.map((l) => l.name), members: [arjun.name, meera.name] };
}
