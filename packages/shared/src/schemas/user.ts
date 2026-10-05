import { z } from 'zod';
import { TEXT_SIZES } from '../constants';
import { recipePrefsSchema } from '../recipes/types';

export const userSchema = z.object({
  id: z.string(),
  email: z.email(),
  displayName: z.string(),
  avatarInitial: z.string().length(1),
  createdAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

/** Settings stored server-side: display (Milestone 1) and recipe preferences (Milestone 6). */
export const userSettingsSchema = z
  .object({
    textSize: z.enum(TEXT_SIZES),
    highContrast: z.boolean(),
    reduceMotion: z.boolean(),
    language: z.enum(['en', 'hi']),
  })
  .extend(recipePrefsSchema.shape);
export type UserSettings = z.infer<typeof userSettingsSchema>;

export const pantrySchema = z.object({
  id: z.uuid(),
  ownerId: z.string(),
  homeListId: z.uuid(),
  createdAt: z.string(),
});
export type Pantry = z.infer<typeof pantrySchema>;

/** PATCH /me/settings: any subset of the settings. */
export const settingsPatchSchema = userSettingsSchema.partial();
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

/** PATCH /me/profile (PRO-1 Edit profile). */
export const profilePatchSchema = z.object({
  displayName: z.string().trim().min(1, 'Add your name.').max(60, 'Keep it under 60 characters.'),
});
export type ProfilePatch = z.infer<typeof profilePatchSchema>;
