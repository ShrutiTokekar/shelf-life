import { z } from 'zod';

/** Sync service config (SRS 14.4). Same DATABASE_URL and SYNC_JWT_SECRET as the API. */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SYNC_PORT: z.coerce.number().default(8790),
  DATABASE_URL: z.string().default('postgres://postgres:postgres@localhost:5432/shelflife'),
  SYNC_JWT_SECRET: z.string().min(32, 'SYNC_JWT_SECRET must be at least 32 characters'),
});

export type SyncEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): SyncEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment for the sync service.\n${problems.join('\n')}`);
  }
  return parsed.data;
}
