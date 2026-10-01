import type { Server } from 'node:http';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createAuth } from './auth';
import { createDb, type Db } from './db/client';
import type { Env } from './env';

/**
 * Start the API's HTTP server. Shared by `src/index.ts` (the API alone) and the sync service's
 * combined entry, which also serves sync on the same port (production on Render's free plan).
 */
export async function startApi(
  env: Env,
): Promise<{ server: Server; db: Db; close: () => Promise<void> }> {
  const { db, close } = createDb(env.DATABASE_URL);
  const auth = createAuth(env, db);
  const extraRoutes =
    env.NODE_ENV === 'test' ? (await import('./testRoutes')).createTestRoutes(env, db) : undefined;
  const app = createApp({ env, db, auth, extraRoutes });
  const server = await new Promise<Server>((resolve) => {
    const s = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
      console.log(`Shelf Life API listening on http://localhost:${info.port}`);
      resolve(s as Server);
    });
  });
  return { server, db, close };
}
