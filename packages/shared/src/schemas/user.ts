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
/** PRO-5 expiry alert timing ("off" added Oct 5, 2026). */
export const EXPIRY_ALERTS = ['off', 'same_day', '1_day', '2_days'] as const;
export type ExpiryAlert = (typeof EXPIRY_ALERTS)[number];

/** PRO-5 / RMD-4 / RMD-5 notification settings. Quiet hours are fixed: 10 PM to 8 AM local. */
export const notificationSettingsSchema = z.object({
  /** "When something runs out": notify the others on that item's list. */
  notifyRanOut: z.boolean(),
  expiryAlert: z.enum(EXPIRY_ALERTS),
  weeklyReminder: z.boolean(),
  /** 0 = Sunday … 6 = Saturday. */
  weeklyDay: z.number().int().min(0).max(6),
  /** "HH:MM", 24-hour, local. */
  weeklyTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  /** IANA time zone from the device, for quiet hours and the weekly reminder. */
  timeZone: z.string().min(1).max(64),
});
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  notifyRanOut: true,
  expiryAlert: '1_day',
  weeklyReminder: false,
  weeklyDay: 6,
  weeklyTime: '10:00',
  timeZone: 'UTC',
};

/** Settings stored server-side: display (Milestone 1), recipes (6) and notifications (8). */
export const userSettingsSchema = z
  .object({
    textSize: z.enum(TEXT_SIZES),
    highContrast: z.boolean(),
    reduceMotion: z.boolean(),
    language: z.enum(['en', 'hi']),
  })
  .extend(recipePrefsSchema.shape)
  .extend(notificationSettingsSchema.shape);
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
