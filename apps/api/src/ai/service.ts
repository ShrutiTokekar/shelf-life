import {
  AI_DAILY_LIMIT,
  cleanedLineSchema,
  lineCaption,
  shelfLifeResultSchema,
  type CleanedLine,
  type CleanupLinesInput,
  type ShelfLifeInput,
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
  dailyLimit?: number;
  today?: () => string;
}) {
  const { db, provider } = deps;
  const limit = deps.dailyLimit ?? AI_DAILY_LIMIT;
  const today = deps.today ?? (() => new Date().toISOString().slice(0, 10));

  async function requireEditor(userId: string, pantryId: string) {
    if ((await docAccess(db, userId, `pantry:${pantryId}`)) !== 'write')
      throw new NotFoundError('Pantry not found.');
  }

  /** Take one call from today's allowance, atomically. */
  async function spend(pantryId: string) {
    const day = today();
    const rows = await db
      .insert(schema.aiUsage)
      .values({ pantryId, day, count: 1 })
      .onConflictDoUpdate({
        target: [schema.aiUsage.pantryId, schema.aiUsage.day],
        set: { count: sql`${schema.aiUsage.count} + 1` },
        where: lt(schema.aiUsage.count, limit),
      })
      .returning({ count: schema.aiUsage.count });
    if (rows.length === 0) throw new AiLimitError('Today’s AI help for this pantry is used up.');
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

    /** SRS 9.2 shelf-life estimate for an item the dictionary doesn't know. */
    async estimateShelfLife(userId: string, input: ShelfLifeInput): Promise<ShelfLifeResult> {
      await requireEditor(userId, input.pantryId);
      const key = shelfKey(input.name, input.location);
      const [row] = await db
        .select()
        .from(schema.aiCache)
        .where(eq(schema.aiCache.key, key))
        .limit(1);
      const hit = row ? shelfLifeResultSchema.safeParse(row.value) : null;
      if (hit?.success) return hit.data;
      const ai = need();
      await spend(input.pantryId);
      const result = await ai.estimateShelfLife({ name: input.name, location: input.location });
      await db.insert(schema.aiCache).values({ key, value: result }).onConflictDoNothing();
      return result;
    },
  };
}

export type AiService = ReturnType<typeof aiService>;
