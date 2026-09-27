import { z } from 'zod';
import { TEXT_SIZES } from '../constants';

export const userSchema = z.object({
  id: z.string(),
  email: z.email(),
  displayName: z.string(),
  avatarInitial: z.string().length(1),
  createdAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

/** Settings stored server-side. Most fields are used from Milestone 6/8 on. */
export const userSettingsSchema = z.object({
  textSize: z.enum(TEXT_SIZES),
  highContrast: z.boolean(),
  reduceMotion: z.boolean(),
  language: z.enum(['en', 'hi']),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

export const pantrySchema = z.object({
  id: z.uuid(),
  ownerId: z.string(),
  homeListId: z.uuid(),
  createdAt: z.string(),
});
export type Pantry = z.infer<typeof pantrySchema>;
