import { z } from 'zod';
import { CATEGORIES, LOCATIONS } from '../pantry/types';

/**
 * SRS 9.2 AI features, as shared request/response schemas. The model's JSON is validated with
 * these on the API before anything reaches the app (SRS 9.3).
 */

/** Receipt line cleanup: up to 20 unsure lines and the store name (no people, no photos). */
export const cleanupLinesInputSchema = z.object({
  pantryId: z.uuid(),
  lines: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  store: z.string().trim().max(60).nullable().optional(),
});
export type CleanupLinesInput = z.infer<typeof cleanupLinesInputSchema>;

export const cleanedLineSchema = z.object({
  raw: z.string(),
  /** Plain grocery name ("Whole milk"), or null when the line isn't a grocery. */
  name: z.string().trim().max(60).nullable(),
  category: z.enum(CATEGORIES),
  location: z.enum(LOCATIONS),
  confidence: z.number().min(0).max(1),
});
export type CleanedLine = z.infer<typeof cleanedLineSchema>;

export const cleanupLinesResultSchema = z.object({ lines: z.array(cleanedLineSchema) });
export type CleanupLinesResult = z.infer<typeof cleanupLinesResultSchema>;

/** Shelf-life estimates for items the dictionary doesn't know, batched: one AI call per scan. */
export const shelfLifeItemSchema = z.object({
  name: z.string().trim().min(1).max(60),
  location: z.enum(LOCATIONS),
});
export type ShelfLifeItem = z.infer<typeof shelfLifeItemSchema>;

export const shelfLifeInputSchema = z.object({
  pantryId: z.uuid(),
  items: z.array(shelfLifeItemSchema).min(1).max(10),
});
export type ShelfLifeInput = z.infer<typeof shelfLifeInputSchema>;

export const shelfLifeResultSchema = z.object({
  days: z.number().int().min(1).max(3650),
  /** Short reason, e.g. "Opened jar, refrigerated". */
  basis: z.string().trim().max(120),
});
export type ShelfLifeResult = z.infer<typeof shelfLifeResultSchema>;

export const shelfLivesResultSchema = z.object({ items: z.array(shelfLifeResultSchema) });
export type ShelfLivesResult = z.infer<typeof shelfLivesResultSchema>;

/** SRS 9.4: AI calls per pantry per day. */
export const AI_DAILY_LIMIT = 30;
/**
 * App-wide AI calls per day and per minute, kept under Google's free-tier quota for the whole
 * project (shared by every user). Set from AI Studio's rate-limit page with the env vars.
 */
export const AI_GLOBAL_DAILY_LIMIT = 500;
export const AI_PER_MINUTE_LIMIT = 10;
