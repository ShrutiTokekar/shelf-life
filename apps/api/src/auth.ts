import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { newId } from '@shelf-life/shared';
import type { Db } from './db/client';
import { schema } from './db/client';
import type { Env } from './env';

/**
 * Better Auth with Google sign-in only (SRS 2.5: no email/password in MVP).
 * Session cookie is HttpOnly, Secure, SameSite=Lax (SEC-2).
 */
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
