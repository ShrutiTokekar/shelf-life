import { betterAuth } from 'better-auth';
import { testUtils } from 'better-auth/plugins';
import { Hono } from 'hono';
import { z } from 'zod';
import { authOptions } from './auth';
import { seedDemoData } from './db/seedData';
import type { Db } from './db/client';
import type { Env } from './env';
import type { AppEnv } from './types';

/**
 * TEST ONLY. Signs a test user in without Google so Playwright can run the onboarding flow.
 * index.ts mounts this only when NODE_ENV === 'test'; it never exists in dev or production.
 */
export function createTestRoutes(env: Env, db: Db) {
  if (env.NODE_ENV !== 'test') throw new Error('Test routes are only available when NODE_ENV=test');
  const testAuth = betterAuth({ ...authOptions(env, db), plugins: [testUtils()] });
  const body = z.object({ email: z.email(), name: z.string().min(1) });

  return (
    new Hono<AppEnv>()
      .post('/test/login', async (c) => {
        const { email, name } = body.parse(await c.req.json());
        const ctx = await testAuth.$context;
        const found = await ctx.internalAdapter.findUserByEmail(email);
        const user = found?.user ?? (await ctx.test.saveUser(ctx.test.createUser({ email, name })));
        const { headers } = await ctx.test.login({ userId: user.id });
        const cookie = headers.get('cookie');
        if (cookie) {
          for (const part of cookie.split('; ')) {
            c.header('Set-Cookie', `${part}; Path=/; HttpOnly; Secure; SameSite=Lax`, {
              append: true,
            });
          }
        }
        return c.json({ userId: user.id });
      })
      // Same as `pnpm db:seed` for the signed-in user: extra lists + demo members (Milestone 2 E2E).
      .post('/test/seed-demo', async (c) => {
        const session = await testAuth.api.getSession({ headers: c.req.raw.headers });
        if (!session)
          return c.json({ error: { code: 'unauthorized', message: 'Please sign in.' } }, 401);
        return c.json(await seedDemoData(db, session.user.email));
      })
  );
}
