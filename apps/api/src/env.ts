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
  /** Small jobs (receipt cleanup, shelf life), so they use their own free quota. */
  GEMINI_LIGHT_MODEL: z.string().min(1).default('gemini-3.5-flash-lite'),
  /**
   * gemini (needs the key), mock (fixtures from the app's dictionary) or off. Default: gemini
   * when a key is set, otherwise mock in development and tests and off in production.
   */
  AI_PROVIDER: z.enum(['gemini', 'mock', 'off']).optional(),
  /** SRS 9.4: AI calls per pantry per day. */
  AI_DAILY_LIMIT: z.coerce.number().int().min(0).default(30),
  /**
   * The whole app's AI calls per day and per minute. Set just under the free-tier limits AI Studio
   * shows for the project (Rate limit page), which every user shares.
   */
  AI_GLOBAL_DAILY_LIMIT: z.coerce.number().int().min(0).default(500),
  AI_PER_MINUTE_LIMIT: z.coerce.number().int().min(1).default(10),
  /**
   * Web Push (SRS 8.8): VAPID keys from `npx web-push generate-vapid-keys`. Without them push is
   * off and reminders stay in the app (SRS 12.3 graceful degradation).
   */
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  /** Contact for push services: a mailto: or https: URL. Defaults to APP_URL. */
  VAPID_SUBJECT: z.string().min(1).optional(),
  /**
   * Milestone 9b: Brevo (free, 300 emails a day) for sign-up, password reset and expiry emails.
   * EMAIL_FROM must be a sender address verified in Brevo. Without both, email accounts are off
   * in production (Google sign-in still works); development and tests keep emails in memory.
   */
  BREVO_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.email().optional(),
  EMAIL_FROM_NAME: z.string().min(1).default('Shelf Life'),
  /** Bearer secret the hourly reminders job (GitHub Actions) sends (Milestone 8d). */
  CRON_SECRET: z.string().min(32, 'CRON_SECRET must be at least 32 characters').optional(),
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
