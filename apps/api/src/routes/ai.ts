import { Hono } from 'hono';
import { cleanupLinesInputSchema, shelfLifeInputSchema } from '@shelf-life/shared';
import type { AiService } from '../ai/service';
import type { AppEnv } from '../types';

/** /ai/* (SRS 11.1). Errors: 503 ai_unavailable or 429 ai_limit → the app uses its fallback. */
export function aiRoutes(ai: AiService) {
  return new Hono<AppEnv>()
    .post('/cleanup-lines', async (c) => {
      const input = cleanupLinesInputSchema.parse(await c.req.json().catch(() => ({})));
      return c.json({ lines: await ai.cleanupLines(c.var.user.id, input) });
    })
    .post('/shelf-life', async (c) => {
      const input = shelfLifeInputSchema.parse(await c.req.json().catch(() => ({})));
      return c.json({ items: await ai.estimateShelfLives(c.var.user.id, input) });
    });
}
