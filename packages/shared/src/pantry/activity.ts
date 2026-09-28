import { z } from 'zod';

/** SRS 10, Activity.type */
export const ACTIVITY_TYPES = [
  'used',
  'ran_out',
  'claimed',
  'bought',
  'scanned',
  'joined',
  'cooked',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/**
 * One entry in the pantry doc's `activity` map (SRS 8.7, 10). Written by "Used it" and "Ran out"
 * from Milestone 2 so later milestones have the history: impact stats count `used` entries with
 * `beforeExpiry: true` as items saved (Profile, SRS 6.11), and ran-out reminders read `ran_out`
 * (SRS 8.6).
 */
export const activitySchema = z.object({
  id: z.string().min(1),
  pantryId: z.string().min(1),
  listId: z.string().min(1),
  actorId: z.string().min(1),
  type: z.enum(ACTIVITY_TYPES),
  /** What it was about, e.g. the item name. */
  subject: z.string(),
  /** The pantry item, when there is one. */
  itemId: z.string().nullable(),
  /** For `used`: was it used on or before its use-by date? null when not applicable. */
  beforeExpiry: z.boolean().nullable(),
  createdAt: z.string(),
});
export type Activity = z.infer<typeof activitySchema>;
