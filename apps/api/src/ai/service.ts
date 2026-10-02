import {
  AI_DAILY_LIMIT,
  AI_GLOBAL_DAILY_LIMIT,
  AI_PER_MINUTE_LIMIT,
  cleanedLineSchema,
  lineCaption,
  shelfLifeResultSchema,
  type CleanedLine,
  type CleanupLinesInput,
  type ShelfLifeInput,
  type ShelfLifeItem,
  type ShelfLifeResult,
} from '@shelf-life/shared';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { schema } from '../db/client';
import { docAccess } from '../services/access';
import { NotFoundError } from '../services/onboarding';
import { AiUnavailableError, type AiProvider } from './provider';

/** The pantry used up its AI calls for today (SRS 9.4). */
export class AiLimitError extends Error {}

/** Cache keys hold only receipt text or an item name and storage place (no personal data). */
const lineKey = (line: string) =>
  `cleanup:${lineCaption(line).toLowerCase().replace(/\s+/g, ' ').trim()}`;
const shelfKey = (name: string, location: string) =>
  `shelf:${name.toLowerCase().replace(/\s+/g, ' ').trim()}|${location}`;

/**
 * SRS 9: the AI proxy. Checks the caller can edit the pantry, serves cached answers first, then
 * spends one of the pantry's 30 daily calls on the provider. Any failure is AiUnavailableError or
 * AiLimitError, and the app falls back to its non-AI behaviour (rule 2).
 */
export function aiService(deps: {
  db: Db;
  provider: AiProvider | null;
  /** Per pantry per day (SRS 9.4). */
  dailyLimit?: number;
  /** For the whole app per day, and per minute: under Google's project-wide free quota. */
  globalDailyLimit?: number;
  perMinuteLimit?: number;
  today?: () => string;
  now?: () => number;
}) {
  const { db, provider } = deps;
  const limit = deps.dailyLimit ?? AI_DAILY_LIMIT;
  const globalLimit = deps.globalDailyLimit ?? AI_GLOBAL_DAILY_LIMIT;
  const perMinute = deps.perMinuteLimit ?? AI_PER_MINUTE_LIMIT;
  const today = deps.today ?? (() => new Date().toISOString().slice(0, 10));
  const now = deps.now ?? (() => Date.now());
  // Calls in the last minute. In memory is fine: the API runs as one service (Render).
  const recent: number[] = [];

  async function requireEditor(userId: string, pantryId: string) {
    if ((await docAccess(db, userId, `pantry:${pantryId}`)) !== 'write')
      throw new NotFoundError('Pantry not found.');
  }

  /**
   * Take one call from the pantry's daily allowance and the app's, atomically (both or
   * neither), after the per-minute check. Over the pantry's limit is AiLimitError; over the
   * app's is AiUnavailableError (it isn't this household's doing). Either way the app falls back.
   */
  async function spend(pantryId: string) {
    const t = now();
    while (recent.length > 0 && t - recent[0]! >= 60_000) recent.shift();
    if (recent.length >= perMinute) throw new AiUnavailableError('AI is busy. Try again soon.');
    const day = today();
    await db.transaction(async (tx) => {
      const mine = await tx
        .insert(schema.aiUsage)
        .values({ pantryId, day, count: 1 })
        .onConflictDoUpdate({
          target: [schema.aiUsage.pantryId, schema.aiUsage.day],
          set: { count: sql`${schema.aiUsage.count} + 1` },
          where: lt(schema.aiUsage.count, limit),
        })
        .returning({ count: schema.aiUsage.count });
      if (mine.length === 0 || mine[0]!.count > limit)
        throw new AiLimitError('Today’s AI help for this pantry is used up.');
      const all = await tx
        .insert(schema.aiUsageGlobal)
        .values({ day, count: 1 })
        .onConflictDoUpdate({
          target: schema.aiUsageGlobal.day,
          set: { count: sql`${schema.aiUsageGlobal.count} + 1` },
          where: lt(schema.aiUsageGlobal.count, globalLimit),
        })
        .returning({ count: schema.aiUsageGlobal.count });
      if (all.length === 0 || all[0]!.count > globalLimit)
        throw new AiUnavailableError('The app’s AI help for today is used up.');
    });
    recent.push(t);
  }

  function need(): AiProvider {
    if (!provider) throw new AiUnavailableError('AI is turned off.');
    return provider;
  }

  return {
    providerName: provider?.name ?? 'off',

    async usage(pantryId: string) {
      const [row] = await db
        .select({ count: schema.aiUsage.count })
        .from(schema.aiUsage)
        .where(and(eq(schema.aiUsage.pantryId, pantryId), eq(schema.aiUsage.day, today())))
        .limit(1);
      return { used: row?.count ?? 0, limit };
    },

    /** SRS 9.2 receipt line cleanup, one cleaned line per input line, in order. */
    async cleanupLines(userId: string, input: CleanupLinesInput): Promise<CleanedLine[]> {
      await requireEditor(userId, input.pantryId);
      const keys = input.lines.map(lineKey);
      const cached = new Map<string, CleanedLine>();
      const rows = await db
        .select()
        .from(schema.aiCache)
        .where(inArray(schema.aiCache.key, [...new Set(keys)]));
      for (const r of rows) {
        const parsed = cleanedLineSchema.safeParse(r.value);
        if (parsed.success) cached.set(r.key, parsed.data);
      }
      const missing = [...new Set(input.lines.filter((_, i) => !cached.has(keys[i]!)))];
      if (missing.length > 0) {
        const ai = need();
        await spend(input.pantryId);
        const fresh = await ai.cleanupLines({ lines: missing, store: input.store ?? null });
        for (const line of fresh.lines) {
          cached.set(lineKey(line.raw), line);
          await db
            .insert(schema.aiCache)
            .values({ key: lineKey(line.raw), value: line })
            .onConflictDoNothing();
        }
      }
      return input.lines.map((raw, i) => ({ ...cached.get(keys[i]!)!, raw }));
    },

    /** SRS 9.2 shelf-life estimates for items the dictionary doesn't know: one call per batch. */
    async estimateShelfLives(userId: string, input: ShelfLifeInput): Promise<ShelfLifeResult[]> {
      await requireEditor(userId, input.pantryId);
      const keys = input.items.map((i) => shelfKey(i.name, i.location));
      const known = new Map<string, ShelfLifeResult>();
      const rows = await db
        .select()
        .from(schema.aiCache)
        .where(inArray(schema.aiCache.key, [...new Set(keys)]));
      for (const r of rows) {
        const parsed = shelfLifeResultSchema.safeParse(r.value);
        if (parsed.success) known.set(r.key, parsed.data);
      }
      const missing: ShelfLifeItem[] = [];
      input.items.forEach((item, i) => {
        if (!known.has(keys[i]!) && !missing.some((m) => shelfKey(m.name, m.location) === keys[i]))
          missing.push({ name: item.name, location: item.location });
      });
      if (missing.length > 0) {
        const ai = need();
        await spend(input.pantryId);
        const fresh = await ai.estimateShelfLives({ items: missing });
        for (const [n, item] of missing.entries()) {
          const key = shelfKey(item.name, item.location);
          known.set(key, fresh.items[n]!);
          await db
            .insert(schema.aiCache)
            .values({ key, value: fresh.items[n]! })
            .onConflictDoNothing();
        }
      }
      return keys.map((k) => known.get(k)!);
    },
  };
}

export type AiService = ReturnType<typeof aiService>;
