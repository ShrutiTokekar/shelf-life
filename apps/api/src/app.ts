import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { ERROR_CODES } from '@shelf-life/shared';
import type { Auth } from './auth';
import type { Db } from './db/client';
import type { Env } from './env';
import { sameOriginOnly } from './middleware/csrf';
import { apiError, onError } from './middleware/errors';
import { rateLimitPerUser } from './middleware/rateLimit';
import { requireSession } from './middleware/requireSession';
import { providerFromEnv } from './ai';
import { aiService } from './ai/service';
import type { AiProvider } from './ai/provider';
import { aiRoutes } from './routes/ai';
import { inviteRoutes } from './routes/invites';
import { listRoutes } from './routes/lists';
import { meRoutes } from './routes/me';
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
};

export function createApp({ env, db, auth, extraRoutes, ai }: AppDeps) {
  const app = new Hono<AppEnv>();

  app.use('*', secureHeaders({ strictTransportSecurity: 'max-age=31536000; includeSubDomains' }));
  app.use('*', async (c, next) => {
    c.set('db', db);
    c.set('auth', auth);
    await next();
  });
  // SEC-2: reject cross-site mutating requests by checking Origin.
  app.use('/api/*', sameOriginOnly(env.APP_URL));

  app.get('/health', (c) => c.json({ ok: true }));

  app.on(['GET', 'POST'], '/api/v1/auth/*', (c) => auth.handler(c.req.raw));

  if (extraRoutes) app.route('/api/v1', extraRoutes);

  const api = new Hono<AppEnv>();
  api.use('*', requireSession, rateLimitPerUser());
  api.route('/me', meRoutes);
  api.route('/lists', listRoutes(env.APP_URL));
  api.route('/invites', inviteRoutes());
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
  app.route('/api/v1', api);

  app.notFound((c) => apiError(c, 404, ERROR_CODES.notFound, 'Not found.'));
  app.onError(onError);
  return app;
}
