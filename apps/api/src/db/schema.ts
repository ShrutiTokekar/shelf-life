import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  customType,
  date,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { LIST_COLORS, LIST_ROLES, TEXT_SIZES } from '@shelf-life/shared';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---- Better Auth core tables (Google sign-in only; no passwords stored) ----

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('session_user_id_idx').on(t.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('account_user_id_idx').on(t.userId)],
);

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---- Shelf Life tables (SRS 10) ----

export const listColor = pgEnum('list_color', LIST_COLORS);
export const listRole = pgEnum('list_role', LIST_ROLES);
export const textSize = pgEnum('text_size', TEXT_SIZES);
export const language = pgEnum('language', ['en', 'hi']);

/** One pantry per user (more than one is P2). Owned by the home list. */
export const pantry = pgTable('pantry', {
  id: uuid('id').primaryKey(),
  ownerId: text('owner_id')
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  // Nullable only because pantry and home list reference each other; both are written in one
  // transaction (services/onboarding.ts), so a committed pantry always has a home list.
  homeListId: uuid('home_list_id')
    .unique()
    .references((): AnyPgColumn => list.id),
  createdAt: createdAt(),
});

export const list = pgTable(
  'list',
  {
    id: uuid('id').primaryKey(),
    pantryId: uuid('pantry_id')
      .notNull()
      .references(() => pantry.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: listColor('color').notNull(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    isHome: boolean('is_home').notNull().default(false),
    isPrivate: boolean('is_private').notNull().default(false),
    shopBy: date('shop_by'),
    createdAt: createdAt(),
  },
  (t) => [
    index('list_pantry_id_idx').on(t.pantryId),
    // A pantry has exactly one home list.
    uniqueIndex('list_one_home_per_pantry')
      .on(t.pantryId)
      .where(sql`${t.isHome}`),
  ],
);

export const listMember = pgTable(
  'list_member',
  {
    listId: uuid('list_id')
      .notNull()
      .references(() => list.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: listRole('role').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    invitedBy: text('invited_by').references(() => user.id, { onDelete: 'set null' }),
  },
  (t) => [
    primaryKey({ columns: [t.listId, t.userId] }),
    index('list_member_user_id_idx').on(t.userId),
  ],
);

/** Display settings in Milestone 1; AI and notification fields are added in Milestones 6 and 8. */
export const userSettings = pgTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  textSize: textSize('text_size').notNull().default('default'),
  highContrast: boolean('high_contrast').notNull().default(false),
  reduceMotion: boolean('reduce_motion').notNull().default(false),
  language: language('language').notNull().default('en'),
  updatedAt: updatedAt(),
});

/** SHR-3: an invite link. The token is the secret in `/join/:token`; one link can be used by many. */
export const listInvite = pgTable(
  'list_invite',
  {
    token: text('token').primaryKey(),
    listId: uuid('list_id')
      .notNull()
      .references(() => list.id, { onDelete: 'cascade' }),
    role: listRole('role').notNull(),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    /** Who it was sent to (email or phone), shown to the owner as "Invite pending". */
    sentTo: text('sent_to'),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  },
  (t) => [index('list_invite_list_id_idx').on(t.listId)],
);

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => 'bytea',
});

/**
 * SRS 8.7: the sync service's saved copy of each Yjs doc ("list:<id>" or "pantry:<id>"), written
 * every 30 s and when the last person leaves. `hasCart` marks lists with items waiting to move
 * into the pantry (LST-7), so the service reloads them after a restart.
 */
export const yjsDoc = pgTable('yjs_docs', {
  name: text('name').primaryKey(),
  state: bytea('state').notNull(),
  hasCart: boolean('has_cart').notNull().default(false),
  updatedAt: updatedAt(),
});
