import { randomBytes } from 'node:crypto';
import { and, asc, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import {
  INVITE_TTL_DAYS,
  createInviteInputSchema,
  updateListInputSchema,
  type CreateInviteInput,
  type Invite,
  type InvitePreview,
  type InviteRole,
  type ListDetail,
  type UpdateListInput,
} from '@shelf-life/shared';
import type { Db } from '../db/client';
import { schema } from '../db/client';
import { roleOn } from './access';
import { ForbiddenError, NotFoundError } from './onboarding';

const DAY_MS = 86_400_000;

const displayName = (name: string) => name.trim() || 'Member';

/** 404 for non-members (never reveal a list exists), 403 for the wrong role. */
async function requireRole(db: Db, userId: string, listId: string, allowed: string[]) {
  const role = await roleOn(db, userId, listId);
  if (!role) throw new NotFoundError('List not found.');
  if (!allowed.includes(role)) throw new ForbiddenError('You can’t do that on this list.');
  return role;
}

async function getList(db: Db, listId: string) {
  const [row] = await db.select().from(schema.list).where(eq(schema.list.id, listId)).limit(1);
  if (!row) throw new NotFoundError('List not found.');
  return row;
}

const toInvite = (row: typeof schema.listInvite.$inferSelect, appUrl: string): Invite => ({
  token: row.token,
  url: `${appUrl}/join/${row.token}`,
  role: row.role === 'view' ? 'view' : 'edit',
  expiresAt: row.expiresAt.toISOString(),
  sentTo: row.sentTo,
  acceptedAt: row.acceptedAt?.toISOString() ?? null,
});

/** GET /lists/:id: members for everyone on the list; open invites for owners and editors. */
export async function getListDetail(
  db: Db,
  userId: string,
  listId: string,
  appUrl: string,
  now = new Date(),
): Promise<ListDetail> {
  const role = await requireRole(db, userId, listId, ['owner', 'edit', 'view']);
  const list = await getList(db, listId);
  const members = await db
    .select({
      userId: schema.listMember.userId,
      role: schema.listMember.role,
      joinedAt: schema.listMember.joinedAt,
      name: schema.user.name,
    })
    .from(schema.listMember)
    .innerJoin(schema.user, eq(schema.user.id, schema.listMember.userId))
    .where(eq(schema.listMember.listId, listId))
    .orderBy(asc(schema.listMember.joinedAt));
  const invites =
    role === 'view'
      ? []
      : await db
          .select()
          .from(schema.listInvite)
          .where(
            and(
              eq(schema.listInvite.listId, listId),
              isNull(schema.listInvite.revokedAt),
              gt(schema.listInvite.expiresAt, now),
            ),
          )
          .orderBy(asc(schema.listInvite.createdAt));
  return {
    id: list.id,
    pantryId: list.pantryId,
    name: list.name,
    color: list.color,
    ownerId: list.ownerId,
    isHome: list.isHome,
    isPrivate: list.isPrivate,
    shopBy: list.shopBy,
    createdAt: list.createdAt.toISOString(),
    role,
    members: members.map((m) => ({
      userId: m.userId,
      displayName: displayName(m.name),
      avatarInitial: displayName(m.name).charAt(0).toUpperCase(),
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    })),
    invites: invites.map((i) => toInvite(i, appUrl)),
  };
}

/** PATCH /lists/:id (owner). SHR-7: a private list becomes shareable by turning Private off. */
export async function updateList(db: Db, userId: string, listId: string, input: UpdateListInput) {
  const data = updateListInputSchema.parse(input);
  await requireRole(db, userId, listId, ['owner']);
  const list = await getList(db, listId);
  if (list.isHome && data.isPrivate) throw new ForbiddenError('Your home list can’t be private.');
  if (Object.keys(data).length > 0)
    await db.update(schema.list).set(data).where(eq(schema.list.id, listId));
}

/** POST /lists/:id/invites (SHR-3): owners and editors; 14-day link; not for private lists. */
export async function createInvite(
  db: Db,
  userId: string,
  listId: string,
  input: CreateInviteInput,
  appUrl: string,
  now = new Date(),
): Promise<Invite> {
  const data = createInviteInputSchema.parse(input);
  await requireRole(db, userId, listId, ['owner', 'edit']);
  const list = await getList(db, listId);
  if (list.isPrivate)
    throw new ForbiddenError('Private lists can’t be shared. Turn off Private to share it.');
  const [row] = await db
    .insert(schema.listInvite)
    .values({
      // 24 random bytes → 32 URL-safe characters: unguessable, and short enough to paste.
      token: randomBytes(24).toString('base64url'),
      listId,
      role: data.role,
      createdBy: userId,
      expiresAt: new Date(now.getTime() + INVITE_TTL_DAYS * DAY_MS),
      sentTo: data.sendTo ?? null,
    })
    .returning();
  return toInvite(row!, appUrl);
}

/** DELETE /lists/:id/invites/:token: the owner, or whoever made the link. */
export async function revokeInvite(db: Db, userId: string, listId: string, token: string) {
  const role = await requireRole(db, userId, listId, ['owner', 'edit']);
  const [invite] = await db
    .select()
    .from(schema.listInvite)
    .where(and(eq(schema.listInvite.token, token), eq(schema.listInvite.listId, listId)))
    .limit(1);
  if (!invite) throw new NotFoundError('Invite not found.');
  if (role !== 'owner' && invite.createdBy !== userId)
    throw new ForbiddenError('Only the owner can revoke someone else’s link.');
  await db
    .update(schema.listInvite)
    .set({ revokedAt: new Date() })
    .where(eq(schema.listInvite.token, token));
}

async function usableInvite(db: Db, token: string, now: Date) {
  const [invite] = await db
    .select()
    .from(schema.listInvite)
    .where(eq(schema.listInvite.token, token))
    .limit(1);
  if (!invite || invite.revokedAt || invite.expiresAt <= now)
    throw new NotFoundError('This invite link has expired or was turned off. Ask for a new one.');
  return invite;
}

/** GET /invites/:token: shown on the join page (signed in) before accepting. */
export async function previewInvite(
  db: Db,
  userId: string,
  token: string,
  now = new Date(),
): Promise<InvitePreview> {
  const invite = await usableInvite(db, token, now);
  const list = await getList(db, invite.listId);
  const [inviter] = invite.createdBy
    ? await db
        .select({ name: schema.user.name })
        .from(schema.user)
        .where(eq(schema.user.id, invite.createdBy))
        .limit(1)
    : [];
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.listMember)
    .where(eq(schema.listMember.listId, list.id));
  return {
    listName: list.name,
    color: list.color,
    role: invite.role === 'view' ? 'view' : 'edit',
    invitedBy: inviter ? displayName(inviter.name) : 'Someone',
    memberCount: count,
    sharesPantry: list.isHome,
    alreadyMember: (await roleOn(db, userId, list.id)) !== null,
  };
}

/** POST /invites/:token/accept: join with the link's role. Joining twice changes nothing. */
export async function acceptInvite(db: Db, userId: string, token: string, now = new Date()) {
  const invite = await usableInvite(db, token, now);
  const list = await getList(db, invite.listId);
  if (list.isPrivate) throw new ForbiddenError('This list is private now.');
  if (!(await roleOn(db, userId, list.id))) {
    await db.transaction(async (tx) => {
      await tx.insert(schema.listMember).values({
        listId: list.id,
        userId,
        role: invite.role === 'view' ? 'view' : 'edit',
        invitedBy: invite.createdBy,
      });
      await tx
        .update(schema.listInvite)
        .set({ acceptedAt: now })
        .where(eq(schema.listInvite.token, token));
    });
  }
  return { listId: list.id };
}

/** PATCH /lists/:id/members/:userId (owner): Can edit ↔ Can view. */
export async function changeRole(
  db: Db,
  userId: string,
  listId: string,
  memberId: string,
  role: InviteRole,
) {
  await requireRole(db, userId, listId, ['owner']);
  const target = await roleOn(db, memberId, listId);
  if (!target) throw new NotFoundError('That person isn’t on this list.');
  if (target === 'owner') throw new ForbiddenError('The owner’s role can’t change.');
  await db
    .update(schema.listMember)
    .set({ role })
    .where(and(eq(schema.listMember.listId, listId), eq(schema.listMember.userId, memberId)));
}

/**
 * DELETE /lists/:id/members/:userId: the owner removes someone, or anyone leaves. The owner can't
 * leave (they delete the list instead). Their items and claims stay, shown as "Former member"
 * (SHR-8).
 */
export async function removeMember(db: Db, userId: string, listId: string, memberId: string) {
  const role = await requireRole(db, userId, listId, ['owner', 'edit', 'view']);
  if (memberId !== userId && role !== 'owner')
    throw new ForbiddenError('Only the owner can remove people.');
  const target = await roleOn(db, memberId, listId);
  if (!target) throw new NotFoundError('That person isn’t on this list.');
  if (target === 'owner')
    throw new ForbiddenError('The owner can’t leave. Delete the list instead.');
  await db
    .delete(schema.listMember)
    .where(and(eq(schema.listMember.listId, listId), eq(schema.listMember.userId, memberId)));
}

/** SHR-4 Stop sharing (owner): everyone else leaves and every link stops working. */
export async function stopSharing(db: Db, userId: string, listId: string, now = new Date()) {
  await requireRole(db, userId, listId, ['owner']);
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.listMember)
      .where(and(eq(schema.listMember.listId, listId), ne(schema.listMember.role, 'owner')));
    await tx
      .update(schema.listInvite)
      .set({ revokedAt: now })
      .where(and(eq(schema.listInvite.listId, listId), isNull(schema.listInvite.revokedAt)));
  });
}
