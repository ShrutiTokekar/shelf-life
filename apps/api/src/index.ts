import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createAuth } from './auth';
import { createDb } from './db/client';
import { loadEnv } from './env';

const env = loadEnv();
const { db } = createDb(env.DATABASE_URL);
const auth = createAuth(env, db);

const extraRoutes =
  env.NODE_ENV === 'test' ? (await import('./testRoutes')).createTestRoutes(env, db) : undefined;

const app = createApp({ env, db, auth, extraRoutes });

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Shelf Life API listening on http://localhost:${info.port}`);
});
