import { z } from 'zod';

/** Server config (SRS 14.4). Secrets only ever live in env vars, never in the client. */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().default('postgres://postgres:postgres@localhost:5432/shelflife'),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  /** Public origin of the web app, used for CSRF and OAuth redirects. */
  APP_URL: z.url().default('https://localhost:5173'),
  /**
   * Public origin the browser uses to reach the API. Locally the Vite dev server proxies
   * /api to this process, so it's the same as APP_URL (keeps cookies same-site).
   */
  API_URL: z.url().optional(),
  /** Signs the 5-minute sync tokens (SRS 11.1); the sync service verifies with the same value. */
  SYNC_JWT_SECRET: z.string().min(32, 'SYNC_JWT_SECRET must be at least 32 characters'),
  /**
   * Public WebSocket origin of the sync service, e.g. wss://sync.example.com. Unset locally: the
   * browser then connects through the Vite dev server at /sync on its own origin.
   */
  SYNC_URL: z.url().optional(),
  /** SRS 9.1: Gemini API key (Google AI Studio, free tier). Never sent to the browser. */
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).default('gemini-3.5-flash'),
  /**
   * gemini (needs the key), mock (fixtures from the app's dictionary) or off. Default: gemini
   * when a key is set, otherwise mock in development and tests and off in production.
   */
  AI_PROVIDER: z.enum(['gemini', 'mock', 'off']).optional(),
  /** SRS 9.4: AI calls per pantry per day. */
  AI_DAILY_LIMIT: z.coerce.number().int().min(0).default(30),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(
      `Invalid environment. Create .env as described in README step 3.\n${problems.join('\n')}`,
    );
  }
  return parsed.data;
}
