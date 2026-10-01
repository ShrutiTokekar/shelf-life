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
  /**
   * Pantries this user can open: their own, plus the pantry of any home list they joined
   * (SHR-6). The Pantry page shows a switcher when there's more than one.
   */
  pantries: z.array(
    pantrySchema.extend({ name: z.string(), own: z.boolean(), canEdit: z.boolean() }),
  ),
  settings: userSettingsSchema,
});
export type MeResponse = z.infer<typeof meResponseSchema>;
