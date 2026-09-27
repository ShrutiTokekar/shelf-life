import { z } from 'zod';
import { listWithRoleSchema } from './list';
import { pantrySchema, userSchema, userSettingsSchema } from './user';

/**
 * GET /me (SRS 11.1). `pantry` is null until the user finishes home list setup (WEL-4);
 * the web app uses that to route new users to onboarding (WEL-2).
 */
export const meResponseSchema = z.object({
  user: userSchema,
  pantry: pantrySchema.nullable(),
  lists: z.array(listWithRoleSchema),
  settings: userSettingsSchema,
});
export type MeResponse = z.infer<typeof meResponseSchema>;
