import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { newId } from '@shelf-life/shared';
import type { Db } from './db/client';
import { schema } from './db/client';
import type { Env } from './env';

/**
 * Better Auth with Google sign-in only (SRS 2.5: no email/password in MVP).
 * Session cookie is HttpOnly, Secure, SameSite=Lax (SEC-2). Sessions end 30 days after sign-in,
 * never extended; browsers also sign out after 5 hours without use (SEC-9, middleware/session.ts).
 */
/** SEC-9: every session ends 30 days after sign-in. */
export const SESSION_MAX_AGE_S = 30 * 24 * 3600;

export function authOptions(env: Env, db: Db) {
  return {
    appName: 'Shelf Life',
    baseURL: env.API_URL ?? env.APP_URL,
    basePath: '/api/v1/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        prompt: 'select_account' as const,
      },
    },
    emailAndPassword: { enabled: false },
    session: {
      expiresIn: SESSION_MAX_AGE_S,
      // A fixed 30 days from sign-in: using the app doesn't push it back (SEC-9).
      disableSessionRefresh: true,
      additionalFields: {
        client: { type: 'string' as const, required: false, input: false, defaultValue: 'browser' },
        lastSeenAt: { type: 'date' as const, required: false, input: false },
      },
    },
    // Per-IP limits on sign-in and the other auth endpoints (SEC-9; SRS 11.3).
    rateLimit: {
      enabled: env.NODE_ENV === 'production',
      window: 60,
      max: 60,
      customRules: {
        '/sign-in/*': { window: 60, max: 10 },
        '/callback/*': { window: 60, max: 10 },
      },
    },
    advanced: {
      cookiePrefix: 'shelf-life',
      useSecureCookies: true,
      defaultCookieAttributes: { httpOnly: true, secure: true, sameSite: 'lax' as const },
      database: { generateId: () => newId() },
    },
  };
}

export function createAuth(env: Env, db: Db) {
  return betterAuth(authOptions(env, db));
}

export type Auth = ReturnType<typeof createAuth>;
export type SessionUser = Auth['$Infer']['Session']['user'];
export type SessionRecord = Auth['$Infer']['Session']['session'];
