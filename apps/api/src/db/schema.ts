import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  customType,
  integer,
  jsonb,
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
import {
  DIETS,
  EXPIRY_ALERTS,
  LIST_COLORS,
  LIST_ROLES,
  TEXT_SIZES,
  type ChatAction,
  type Recipe,
} from '@shelf-life/shared';

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
    /** SEC-9: "browser" signs out after 5 h without use; "app" (installed PWA) lasts 30 days. */
    client: text('client', { enum: ['browser', 'app'] })
      .notNull()
      .default('browser'),
    /** Last API request on this session (updated at most every 5 minutes). */
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
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

export const diet = pgEnum('diet', DIETS);
export const expiryAlert = pgEnum('expiry_alert', EXPIRY_ALERTS);

/** Display settings (Milestone 1) and recipe preferences (Milestone 6); notifications in 8. */
export const userSettings = pgTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  textSize: textSize('text_size').notNull().default('default'),
  highContrast: boolean('high_contrast').notNull().default(false),
  reduceMotion: boolean('reduce_motion').notNull().default(false),
  language: language('language').notNull().default('en'),
  diet: diet('diet').notNull().default('any'),
  /** Preferred cuisines; empty = any. */
  cuisines: text('cuisines')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  maxMinutes: integer('max_minutes'),
  avoid: text('avoid')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  // PRO-5 notifications (Milestone 8).
  notifyRanOut: boolean('notify_ran_out').notNull().default(true),
  expiryAlert: expiryAlert('expiry_alert').notNull().default('1_day'),
  weeklyReminder: boolean('weekly_reminder').notNull().default(false),
  weeklyDay: integer('weekly_day').notNull().default(6),
  weeklyTime: text('weekly_time').notNull().default('10:00'),
  timeZone: text('time_zone').notNull().default('UTC'),
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

/** SRS 9.4: AI calls per pantry per day (30). Cache hits don't count. */
export const aiUsage = pgTable(
  'ai_usage',
  {
    pantryId: uuid('pantry_id')
      .notNull()
      .references(() => pantry.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.pantryId, t.day] })],
);

/** App-wide AI calls per day, kept under Google's free quota for the whole project. */
export const aiUsageGlobal = pgTable('ai_usage_global', {
  day: date('day').primaryKey(),
  count: integer('count').notNull().default(0),
});

/**
 * SRS 9.4: AI answers cached by their input, shared by everyone. Keys hold only receipt text or
 * an item name and storage place, never anything personal.
 */
export const aiCache = pgTable('ai_cache', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  createdAt: createdAt(),
});

/**
 * SRS 10 Recipe, for AI recipes only (local ones ship with the app). Kept so saved recipes and
 * `GET /recipes/:id` keep working after the 6-hour suggestion cache expires. No personal data.
 */
export const recipe = pgTable('recipe', {
  id: text('id').primaryKey(),
  payload: jsonb('payload').$type<Recipe>().notNull(),
  createdAt: createdAt(),
});

/**
 * SRS 9.4 RecipeCache: AI suggestions for 6 hours, keyed by a hash of the expiring items and
 * preferences. Shared by everyone (the key holds no personal data), so the same fridge of
 * spinach and paneer costs one call. `pantryId` records which pantry spent the call.
 */
export const recipeCache = pgTable('recipe_cache', {
  key: text('key').primaryKey(),
  pantryId: uuid('pantry_id').references(() => pantry.id, { onDelete: 'set null' }),
  recipeIds: jsonb('recipe_ids').$type<string[]>().notNull(),
  createdAt: createdAt(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

/** SRS 10 SavedRecipe (SAV-2). `recipeId` is a local recipe id or an AI `recipe.id`. */
export const savedRecipe = pgTable(
  'saved_recipe',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    recipeId: text('recipe_id').notNull(),
    savedAt: timestamp('saved_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.recipeId] })],
);

/** SRS 10 ChatThread (RCP-8): one person's chat about one recipe. Kept 30 days. */
export const chatThread = pgTable(
  'chat_thread',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    recipeId: text('recipe_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('chat_thread_user_id_idx').on(t.userId)],
);

export const chatRole = pgEnum('chat_role', ['user', 'ai']);

/** SRS 10 ChatMessage. `actions` are the buttons an AI reply offered. Kept 30 days. */
export const chatMessage = pgTable(
  'chat_message',
  {
    id: uuid('id').primaryKey(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => chatThread.id, { onDelete: 'cascade' }),
    role: chatRole('role').notNull(),
    text: text('text').notNull(),
    actions: jsonb('actions').$type<ChatAction[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [
    index('chat_message_thread_id_idx').on(t.threadId, t.createdAt),
    index('chat_message_created_at_idx').on(t.createdAt),
  ],
);

/** SRS 10 PushSubscription: one per device that turned notifications on (SRS 8.8). */
export const pushSubscription = pgTable(
  'push_subscription',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [index('push_subscription_user_id_idx').on(t.userId)],
);

/**
 * Pushes sent (SRS 8.8): each notification's key once per user (no repeats), and the count per
 * day (at most 3). Rows older than a week are deleted as new ones are written.
 */
export const pushSent = pgTable(
  'push_sent',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] }), index('push_sent_sent_at_idx').on(t.sentAt)],
);
