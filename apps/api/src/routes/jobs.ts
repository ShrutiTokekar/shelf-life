import { createHash, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { ERROR_CODES } from '@shelf-life/shared';
import { runReminders } from '../jobs/reminders';
import { apiError } from '../middleware/errors';
import type { PushService } from '../push/service';
import type { AppEnv } from '../types';

const digest = (s: string) => createHash('sha256').update(s).digest();

/**
 * /jobs/* (SRS 8.8, Milestone 8d): called by the hourly GitHub Actions workflow with
 * `Authorization: Bearer $CRON_SECRET`, not by browsers, so it sits outside the session and
 * same-origin checks. Without CRON_SECRET the jobs are off.
 */
export function jobRoutes(opts: {
  secret: string | undefined;
  push: PushService;
  now?: () => Date;
}) {
  return new Hono<AppEnv>().post('/reminders', async (c) => {
    const given = c.req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    if (!opts.secret || !timingSafeEqual(digest(given), digest(opts.secret)))
      return apiError(c, 401, ERROR_CODES.unauthorized, 'Not allowed.');
    return c.json(await runReminders({ db: c.var.db, push: opts.push, now: opts.now }));
  });
}
