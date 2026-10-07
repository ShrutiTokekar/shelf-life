import { Hono } from 'hono';
import { ERROR_CODES, profilePatchSchema, settingsPatchSchema } from '@shelf-life/shared';
import { apiError } from '../middleware/errors';
import { REAUTH_WINDOW_MS } from '../middleware/requireSession';
import { deleteAccount, exportData, updateProfile } from '../services/account';
import { getMe, patchSettings } from '../services/me';
import { listSaved, saveRecipe, unsaveRecipe } from '../services/recipes';
import type { AppEnv } from '../types';

export const meRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await getMe(c.var.db, c.var.user)))
  // PRO-1 Edit profile.
  .patch('/profile', async (c) => {
    const { displayName } = profilePatchSchema.parse(await c.req.json().catch(() => ({})));
    await updateProfile(c.var.db, c.var.user.id, displayName);
    return c.body(null, 204);
  })
  // PRO-6 Download my data.
  .get('/export', async (c) => {
    const data = await exportData(c.var.db, c.var.user);
    c.header(
      'content-disposition',
      `attachment; filename="shelf-life-${data.exportedAt.slice(0, 10)}.json"`,
    );
    return c.json(data);
  })
  // PRO-6 Delete account. SEC-9: only right after signing in (the last 15 minutes).
  .delete('/', async (c) => {
    const signedInAt = new Date(c.var.session.createdAt).getTime();
    if (c.var.now().getTime() - signedInAt > REAUTH_WINDOW_MS)
      return apiError(
        c,
        403,
        ERROR_CODES.reauthRequired,
        'For your safety, sign in again to delete your account.',
      );
    await deleteAccount(c.var.db, c.var.user.id);
    return c.body(null, 204);
  })
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
