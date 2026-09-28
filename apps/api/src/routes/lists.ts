import { Hono } from 'hono';
import { createListInputSchema } from '@shelf-life/shared';
import { createList, deleteList } from '../services/onboarding';
import type { AppEnv } from '../types';

export const listRoutes = new Hono<AppEnv>()
  .post('/', async (c) => {
    const input = createListInputSchema.parse(await c.req.json().catch(() => ({})));
    const created = await createList(c.var.db, c.var.user.id, input);
    return c.json(
      {
        ...created,
        shopBy: created.shopBy,
        createdAt: created.createdAt.toISOString(),
        role: 'owner' as const,
        members: [],
      },
      201,
    );
  })
  .delete('/:id', async (c) => {
    await deleteList(c.var.db, c.var.user.id, c.req.param('id'));
    return c.body(null, 204);
  });
