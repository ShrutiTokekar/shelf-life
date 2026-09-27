import { Hono } from 'hono';
import { getMe } from '../services/me';
import type { AppEnv } from '../types';

export const meRoutes = new Hono<AppEnv>().get('/', async (c) => {
  return c.json(await getMe(c.var.db, c.var.user));
});
