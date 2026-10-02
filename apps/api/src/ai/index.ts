import type { Env } from '../env';
import { geminiProvider } from './gemini';
import { mockProvider } from './mock';
import type { AiProvider } from './provider';

/** Pick the provider from the environment (SRS 9.1, 14.1). null = AI off; the app falls back. */
export function providerFromEnv(env: Env): AiProvider | null {
  const choice =
    env.AI_PROVIDER ??
    (env.GEMINI_API_KEY ? 'gemini' : env.NODE_ENV === 'production' ? 'off' : 'mock');
  if (choice === 'off') return null;
  if (choice === 'mock') return mockProvider();
  if (!env.GEMINI_API_KEY) return null;
  return geminiProvider({
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL,
    lightModel: env.GEMINI_LIGHT_MODEL,
  });
}
