import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { newId } from '@shelf-life/shared';
import type { Db } from './db/client';
import { schema } from './db/client';
import { emailSenderFromEnv, type EmailSender } from './email/send';
import { existingAccountEmail, resetPasswordEmail, verifyEmail } from './email/templates';
import type { Env } from './env';

/** Password rules (Milestone 9b): 12 to 128 characters, not in a known breach (authGuards.ts). */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

/**
 * Better Auth: Google sign-in, plus email and password (Milestone 9b, changes SRS 15.2) when an
 * email service is set up. Email accounts work only after the address is confirmed by link.
 * Session cookie is HttpOnly, Secure, SameSite=Lax (SEC-2). Sessions end 30 days after sign-in,
 * never extended; browsers also sign out after 5 hours without use (SEC-9, middleware/session.ts).
 */
/** SEC-9: every session ends 30 days after sign-in. */
export const SESSION_MAX_AGE_S = 30 * 24 * 3600;

export type AuthDeps = {
  /** Override how emails are sent (tests). Default: from the environment; null turns email off. */
  email?: EmailSender | null;
};

export function authOptions(env: Env, db: Db, deps: AuthDeps = {}) {
  const email = deps.email === undefined ? emailSenderFromEnv(env) : deps.email;
  const send = (e: Parameters<EmailSender>[0]) => {
    if (!email) throw new Error('Email isn’t set up');
    return email(e);
  };
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
    emailAndPassword: {
      enabled: email !== null,
      requireEmailVerification: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      resetPasswordTokenExpiresIn: 3600,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({
        user,
        url,
      }: {
        user: { email: string; name: string };
        url: string;
      }) => send(resetPasswordEmail(user.email, user.name, url)),
      // Signing up with an address that has an account answers the same as a new one (no way to
      // learn who has an account); the owner gets an email instead.
      onExistingUserSignUp: async ({ user }: { user: { email: string; name: string } }) =>
        send(existingAccountEmail(user.email, user.name, env.APP_URL)),
    },
    emailVerification: {
      sendOnSignUp: true,
      // Signing in before confirming sends a fresh link.
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 24 * 3600,
      sendVerificationEmail: async ({
        user,
        url,
      }: {
        user: { email: string; name: string };
        url: string;
      }) => send(verifyEmail(user.email, user.name, url)),
    },
    account: {
      // Google can join an email account only once that email is confirmed (the default, kept
      // explicit): nobody can claim an address first and wait for its owner to use Google.
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
        requireLocalEmailVerified: true,
      },
    },
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
        '/sign-up/email': { window: 600, max: 5 },
        '/request-password-reset': { window: 600, max: 5 },
        '/send-verification-email': { window: 600, max: 5 },
        '/reset-password': { window: 600, max: 10 },
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

export function createAuth(env: Env, db: Db, deps: AuthDeps = {}) {
  return betterAuth(authOptions(env, db, deps));
}

export type Auth = ReturnType<typeof createAuth>;
export type SessionUser = Auth['$Infer']['Session']['user'];
export type SessionRecord = Auth['$Infer']['Session']['session'];
