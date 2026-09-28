import { eq, inArray } from 'drizzle-orm';
import type { MeResponse } from '@shelf-life/shared';
import type { SessionUser } from '../auth';
import type { Db } from '../db/client';
import { schema } from '../db/client';

const DEFAULT_SETTINGS: MeResponse['settings'] = {
  textSize: 'default',
  highContrast: false,
  reduceMotion: false,
  language: 'en',
};

/** GET /me: current user, pantry, lists with roles, settings (SRS 11.1). */
export async function getMe(db: Db, user: SessionUser): Promise<MeResponse> {
  const [pantryRow] = await db
    .select()
    .from(schema.pantry)
    .where(eq(schema.pantry.ownerId, user.id))
    .limit(1);

  const listRows = await db
    .select({ list: schema.list, role: schema.listMember.role })
    .from(schema.listMember)
    .innerJoin(schema.list, eq(schema.list.id, schema.listMember.listId))
    .where(eq(schema.listMember.userId, user.id))
    .orderBy(schema.list.createdAt);

  // Members of every list this user is on (names only, never emails).
  const listIds = listRows.map((r) => r.list.id);
  const memberRows = listIds.length
    ? await db
        .select({
          listId: schema.listMember.listId,
          userId: schema.listMember.userId,
          role: schema.listMember.role,
          name: schema.user.name,
        })
        .from(schema.listMember)
        .innerJoin(schema.user, eq(schema.user.id, schema.listMember.userId))
        .where(inArray(schema.listMember.listId, listIds))
        .orderBy(schema.listMember.joinedAt, schema.user.name)
    : [];

  const [settingsRow] = await db
    .select()
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, user.id))
    .limit(1);

  const displayName = user.name?.trim() || user.email.split('@')[0] || 'You';
  return {
    user: {
      id: user.id,
      email: user.email,
      displayName,
      avatarInitial: displayName.charAt(0).toUpperCase(),
      createdAt: new Date(user.createdAt).toISOString(),
    },
    pantry:
      pantryRow && pantryRow.homeListId
        ? {
            id: pantryRow.id,
            ownerId: pantryRow.ownerId,
            homeListId: pantryRow.homeListId,
            createdAt: pantryRow.createdAt.toISOString(),
          }
        : null,
    lists: listRows.map(({ list, role }) => ({
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
      members: memberRows
        .filter((m) => m.listId === list.id)
        .map((m) => {
          const name = m.name.trim() || 'Member';
          return {
            userId: m.userId,
            displayName: name,
            avatarInitial: name.charAt(0).toUpperCase(),
            role: m.role,
          };
        }),
    })),
    settings: settingsRow
      ? {
          textSize: settingsRow.textSize,
          highContrast: settingsRow.highContrast,
          reduceMotion: settingsRow.reduceMotion,
          language: settingsRow.language,
        }
      : DEFAULT_SETTINGS,
  };
}
