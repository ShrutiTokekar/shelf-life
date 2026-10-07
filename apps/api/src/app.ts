import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { ERROR_CODES } from '@shelf-life/shared';
import type { Auth } from './auth';
import type { Db } from './db/client';
import type { Env } from './env';
import { sameOriginOnly } from './middleware/csrf';
import { apiError, onError } from './middleware/errors';
import { rateLimitPerUser } from './middleware/rateLimit';
import { authGuards } from './middleware/authGuards';
import { authIdleCheck, requireSession } from './middleware/requireSession';
import { hibpCheck, offlinePwnedCheck, type PwnedCheck } from './email/pwned';
import { providerFromEnv } from './ai';
import { aiService } from './ai/service';
import type { AiProvider } from './ai/provider';
import { aiRoutes } from './routes/ai';
import { inviteRoutes } from './routes/invites';
import { jobRoutes } from './routes/jobs';
import { listRoutes } from './routes/lists';
import { meRoutes } from './routes/me';
import { pushService, type PushSender } from './push/service';
import { pushRoutes } from './routes/push';
import { recipeRoutes } from './routes/recipes';
import { sessionRoutes } from './routes/session';
import { syncTokenRoutes } from './routes/syncToken';
import type { AppEnv } from './types';

export type AppDeps = {
  env: Env;
  db: Db;
  auth: Auth;
  /** Extra routes mounted under /api/v1 (used for the test-only login route). */
  extraRoutes?: Hono<AppEnv>;
  /** Override the AI provider (tests). Default: from the environment; null turns AI off. */
  ai?: AiProvider | null;
  /** Override how pushes are sent, and the clock (tests). */
  pushSend?: PushSender;
  now?: () => Date;
  /** Override the breached-password check (tests). Default: Have I Been Pwned, offline in tests. */
  pwned?: PwnedCheck;
};

export function createApp({ env, db, auth, extraRoutes, ai, pushSend, now, pwned }: AppDeps) {
  const app = new Hono<AppEnv>();

  app.use(
    '*',
    secureHeaders({
      strictTransportSecurity: 'max-age=31536000; includeSubDomains',
      // SEC-1: the API only returns JSON; nothing it sends may run or be framed.
      contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    }),
  );
  app.use('*', async (c, next) => {
    c.set('db', db);
    c.set('auth', auth);
    c.set('now', now ?? (() => new Date()));
    await next();
  });
  // SEC-2: reject cross-site mutating requests by checking Origin.
  app.use('/api/*', sameOriginOnly(env.APP_URL));

  app.get('/health', (c) => c.json({ ok: true }));

  const push = pushService({ db, env, send: pushSend, now });
  // SRS 8.8: the hourly reminders job (GitHub Actions, bearer secret; not a browser route).
  app.route('/jobs', jobRoutes({ secret: env.CRON_SECRET, push, now }));

  // Milestone 9b: is email sign-in available? (Welcome asks before anyone is signed in.)
  const emailSignIn = auth.options.emailAndPassword?.enabled === true;
  app.get('/api/v1/config', (c) => c.json({ emailSignIn }));

  app.use('/api/v1/auth/*', authIdleCheck);
  app.use(
    '/api/v1/auth/*',
    authGuards({ pwned: pwned ?? (env.NODE_ENV === 'test' ? offlinePwnedCheck : hibpCheck()) }),
  );
  app.on(['GET', 'POST'], '/api/v1/auth/*', (c) => auth.handler(c.req.raw));

  if (extraRoutes) app.route('/api/v1', extraRoutes);

  const api = new Hono<AppEnv>();
  api.use('*', requireSession, rateLimitPerUser());
  api.route('/me', meRoutes);
  api.route('/session', sessionRoutes);
  api.route('/lists', listRoutes(env.APP_URL));
  api.route('/invites', inviteRoutes());
  api.route('/recipes', recipeRoutes);
  api.route(
    '/ai',
    aiRoutes(
      aiService({
        db,
        provider: ai === undefined ? providerFromEnv(env) : ai,
        dailyLimit: env.AI_DAILY_LIMIT,
        globalDailyLimit: env.AI_GLOBAL_DAILY_LIMIT,
        perMinuteLimit: env.AI_PER_MINUTE_LIMIT,
      }),
    ),
  );
  api.route('/sync-token', syncTokenRoutes(env.SYNC_JWT_SECRET, env.SYNC_URL));
  api.route('/push', pushRoutes(push));
  app.route('/api/v1', api);

  app.notFound((c) => apiError(c, 404, ERROR_CODES.notFound, 'Not found.'));
  app.onError(onError);
  return app;
}
