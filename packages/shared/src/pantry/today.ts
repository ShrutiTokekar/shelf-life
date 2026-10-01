import { z } from 'zod';
import type { IsoDate } from '../dates';

/**
 * One person's Today progress for a day (SRS 8.4, TOD-2): what they finished and what they
 * snoozed. Kept in the pantry doc's `today` map per user, so it follows them across devices but
 * never hides anything from the people they share the pantry with.
 */
export const todayStateSchema = z.object({
  date: z.iso.date(),
  done: z.array(z.string()),
  /** Key → date it's snoozed until (shown again from that day). */
  snoozed: z.record(z.string(), z.iso.date()),
});
export type TodayState = z.infer<typeof todayStateSchema>;

export const emptyTodayState = (date: IsoDate): TodayState => ({ date, done: [], snoozed: {} });
