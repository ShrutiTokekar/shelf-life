import { Hono } from 'hono';
import { ERROR_CODES } from '@shelf-life/shared';
import { apiError } from '../middleware/errors';
import { findRecipe } from '../services/recipes';
import type { AppEnv } from '../types';

/** GET /recipes/:id: a local recipe or a kept AI one (SRS 11.1). */
export const recipeRoutes = new Hono<AppEnv>().get('/:id', async (c) => {
  const recipe = await findRecipe(c.var.db, c.req.param('id'));
  if (!recipe) return apiError(c, 404, ERROR_CODES.notFound, 'Recipe not found.');
  return c.json(recipe);
});
