import { Hono } from 'hono';
import { ERROR_CODES, settingsPatchSchema } from '@shelf-life/shared';
import { apiError } from '../middleware/errors';
import { getMe, patchSettings } from '../services/me';
import { listSaved, saveRecipe, unsaveRecipe } from '../services/recipes';
import type { AppEnv } from '../types';

export const meRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await getMe(c.var.db, c.var.user)))
  .patch('/settings', async (c) => {
    const patch = settingsPatchSchema.strict().parse(await c.req.json().catch(() => ({})));
    return c.json(await patchSettings(c.var.db, c.var.user.id, patch));
  })
  // SAV-1, SAV-2
  .get('/saved-recipes', async (c) => c.json({ saved: await listSaved(c.var.db, c.var.user.id) }))
  .put('/saved-recipes/:recipeId', async (c) => {
    if (!(await saveRecipe(c.var.db, c.var.user.id, c.req.param('recipeId'))))
      return apiError(c, 404, ERROR_CODES.notFound, 'Recipe not found.');
    return c.body(null, 204);
  })
  .delete('/saved-recipes/:recipeId', async (c) => {
    await unsaveRecipe(c.var.db, c.var.user.id, c.req.param('recipeId'));
    return c.body(null, 204);
  });
