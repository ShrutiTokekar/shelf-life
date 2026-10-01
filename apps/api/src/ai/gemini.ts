import {
  CATEGORIES,
  cleanupLinesResultSchema,
  LOCATIONS,
  shelfLifeResultSchema,
} from '@shelf-life/shared';
import type { ZodType } from 'zod';
import { AiUnavailableError, type AiProvider } from './provider';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Google Gemini (SRS 9.1), called only from the API with the key from the server's environment.
 * JSON only; every answer is validated with our Zod schema and retried once, then the caller
 * falls back (SRS 9.3). Prompts carry item text and store names only: never photos, people,
 * emails or list names (SRS 9.1, SEC-6).
 */
export function geminiProvider(opts: {
  apiKey: string;
  model: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}): AiProvider {
  const fetchImpl = opts.fetch ?? globalThis.fetch;

  async function ask<T>(schema: ZodType<T>, system: string, user: string, temperature: number) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      let res: Response;
      try {
        res = await fetchImpl(`${ENDPOINT}/${encodeURIComponent(opts.model)}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': opts.apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: { temperature, responseMimeType: 'application/json' },
          }),
          signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
        });
      } catch {
        continue; // network error or timeout: try once more
      }
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) continue;
        break; // bad key or request: retrying won't help
      }
      try {
        const body = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        return schema.parse(JSON.parse(text));
      } catch {
        // Not JSON, or not our shape: ask again once.
      }
    }
    throw new AiUnavailableError('The AI model didn’t give a usable answer.');
  }

  return {
    name: `gemini:${opts.model}`,
    async cleanupLines({ lines, store }) {
      const system = [
        'You turn abbreviated grocery receipt lines into plain grocery names.',
        'Respond with JSON only, exactly: {"lines":[{"raw":string,"name":string|null,"category":string,"location":string,"confidence":number}]}',
        'with one entry per input line, in the same order.',
        `category is one of: ${CATEGORIES.join(', ')}. location is one of: ${LOCATIONS.join(', ')}.`,
        'name is a short, generic grocery name in sentence case (e.g. "Whole milk", "Greek yogurt", "Toor dal"); never a brand.',
        'Use null for name when the line is not food (household goods, fees, store info).',
        'confidence is how sure you are, from 0 to 1. Do not invent items.',
      ].join('\n');
      const user = `Store: ${store ?? 'unknown'}\nLines:\n${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}`;
      const result = await ask(cleanupLinesResultSchema, system, user, 0);
      if (result.lines.length !== lines.length)
        throw new AiUnavailableError('The AI model returned the wrong number of lines.');
      // Trust our own copy of each line, not the model's echo.
      return { lines: result.lines.map((l, i) => ({ ...l, raw: lines[i]! })) };
    },
    async estimateShelfLife({ name, location }) {
      const system = [
        'Estimate how many days a grocery item stays good from the day it is bought, kept where stated.',
        'Be conservative, in the spirit of USDA FoodKeeper guidance.',
        'Respond with JSON only, exactly: {"days":integer,"basis":string} where basis is a short reason (under 100 characters).',
      ].join('\n');
      return ask(shelfLifeResultSchema, system, `Item: ${name}\nStored in: ${location}`, 0);
    },
  };
}
