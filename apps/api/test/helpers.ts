import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { betterAuth } from 'better-auth';
import { testUtils } from 'better-auth/plugins';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app';
import { authOptions, createAuth } from '../src/auth';
import { type Db, schema } from '../src/db/client';
import { loadEnv } from '../src/env';
import { createTestRoutes } from '../src/testRoutes';

export const APP_ORIGIN = 'https://localhost:5173';

/** A fresh in-memory Postgres (PGlite) with migrations applied, plus the app wired to it. */
export async function setup() {
  const client = new PGlite();
  const pg = drizzle(client, { schema });
  await migrate(pg, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
  // PGlite and postgres-js drivers share Drizzle's query API; the types just differ by driver.
  const db = pg as unknown as Db;
  const env = loadEnv();
  const auth = createAuth(env, db);
  // Same database, plus test helpers for creating signed-in users without Google.
  const testAuth = betterAuth({ ...authOptions(env, db), plugins: [testUtils()] });
  const app = createApp({ env, db, auth, extraRoutes: createTestRoutes(env, db) });

  async function signIn(email = 'ananya@example.com', name = 'Ananya Mehta') {
    const ctx = await testAuth.$context;
    const user = await ctx.test.saveUser(ctx.test.createUser({ email, name }));
    const headers = await ctx.test.getAuthHeaders({ userId: user.id });
    return { user, cookie: headers.get('cookie') ?? '' };
  }

  function request(path: string, init: RequestInit & { cookie?: string } = {}) {
    const headers = new Headers(init.headers);
    if (init.cookie) headers.set('cookie', init.cookie);
    if (init.body) headers.set('content-type', 'application/json');
    if (!headers.has('origin')) headers.set('origin', APP_ORIGIN);
    return app.request(path, { ...init, headers });
  }

  return { db, app, auth, signIn, request, close: () => client.close() };
}
