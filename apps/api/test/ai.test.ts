import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiErrorSchema, shelfLifeResultSchema } from '@shelf-life/shared';
import { geminiProvider } from '../src/ai/gemini';
import { mockProvider } from '../src/ai/mock';
import type { AiProvider } from '../src/ai/provider';
import { setup } from './helpers';

let t: Awaited<ReturnType<typeof setup>> | undefined;
afterEach(async () => {
  await t?.close();
  t = undefined;
});

/** A mock provider that counts calls. */
function counting(): AiProvider & { calls: number } {
  const base = mockProvider();
  const p = {
    name: 'counting',
    calls: 0,
    async cleanupLines(input: Parameters<AiProvider['cleanupLines']>[0]) {
      p.calls++;
      return base.cleanupLines(input);
    },
    async estimateShelfLife(input: Parameters<AiProvider['estimateShelfLife']>[0]) {
      p.calls++;
      return base.estimateShelfLife(input);
    },
  };
  return p;
}

async function owner() {
  const { cookie, user } = await t!.signIn();
  const home = (await (
    await t!.request('/api/v1/lists', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ name: 'Home', color: 'navy' }),
    })
  ).json()) as { pantryId: string };
  return { cookie, user, pantryId: home.pantryId };
}

const post = (path: string, cookie: string, body: object) =>
  t!.request(path, { method: 'POST', cookie, body: JSON.stringify(body) });

describe('POST /ai/cleanup-lines (SRS 9.2)', () => {
  it('turns receipt shorthand into grocery names, in order, and caches by line text', async () => {
    const provider = counting();
    t = await setup({ ai: provider });
    const { cookie, pantryId } = await owner();
    const lines = ['GV WHL MLK 4.29', 'PAPER TOWELS 5.99', 'XQZ 1.00'];
    const res = await post('/api/v1/ai/cleanup-lines', cookie, {
      pantryId,
      lines,
      store: 'Walmart',
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { lines: { raw: string; name: string | null }[] };
    expect(body.lines.map((l) => [l.raw, l.name])).toEqual([
      ['GV WHL MLK 4.29', 'Milk'],
      ['PAPER TOWELS 5.99', null],
      ['XQZ 1.00', 'Xqz'],
    ]);
    expect(provider.calls).toBe(1);
    // Same lines (prices may differ) come from the cache: no new call, nothing spent.
    await post('/api/v1/ai/cleanup-lines', cookie, { pantryId, lines: ['GV WHL MLK 3.99'] });
    expect(provider.calls).toBe(1);
  });

  it('SRS 9.4 stops at the daily limit with 429 ai_limit', async () => {
    t = await setup({ ai: counting() });
    const { cookie, pantryId } = await owner();
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++)
      statuses.push(
        (
          await post('/api/v1/ai/shelf-life', cookie, {
            pantryId,
            name: `Thing ${i}`,
            location: 'fridge',
          })
        ).status,
      );
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
    const last = await post('/api/v1/ai/shelf-life', cookie, {
      pantryId,
      name: 'Another',
      location: 'fridge',
    });
    expect(apiErrorSchema.parse(await last.json()).error.code).toBe('ai_limit');
    // A cached answer still works after the limit.
    expect(
      (
        await post('/api/v1/ai/shelf-life', cookie, {
          pantryId,
          name: 'Thing 0',
          location: 'fridge',
        })
      ).status,
    ).toBe(200);
  });

  it('rule 2: with AI off the API says 503 ai_unavailable and the app falls back', async () => {
    t = await setup({ ai: null });
    const { cookie, pantryId } = await owner();
    const res = await post('/api/v1/ai/cleanup-lines', cookie, { pantryId, lines: ['GV WHL MLK'] });
    expect(res.status).toBe(503);
    expect(apiErrorSchema.parse(await res.json()).error.code).toBe('ai_unavailable');
  });

  it('SEC-3 only people who can edit the pantry can spend its AI calls', async () => {
    t = await setup({ ai: counting() });
    const { pantryId } = await owner();
    const stranger = await t!.signIn('x@example.com', 'X');
    expect(
      (await post('/api/v1/ai/cleanup-lines', stranger.cookie, { pantryId, lines: ['A'] })).status,
    ).toBe(404);
    expect(
      (await post('/api/v1/ai/cleanup-lines', stranger.cookie, { pantryId, lines: [] })).status,
    ).toBe(400);
    expect(
      (await t!.request('/api/v1/ai/cleanup-lines', { method: 'POST', body: '{}' })).status,
    ).toBe(401);
  });
});

describe('POST /ai/shelf-life (SRS 9.2)', () => {
  it('returns days and a reason', async () => {
    t = await setup({ ai: mockProvider() });
    const { cookie, pantryId } = await owner();
    const res = await post('/api/v1/ai/shelf-life', cookie, {
      pantryId,
      name: 'Paneer',
      location: 'fridge',
    });
    expect(shelfLifeResultSchema.parse(await res.json()).days).toBeGreaterThan(0);
  });
});

describe('geminiProvider (SRS 9.1, 9.3)', () => {
  const answer = (text: string, status = 200) =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status });

  it('sends JSON-only requests with the key in a header and validates the answer', async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) =>
      answer('{"days": 5, "basis": "Fresh herb, refrigerated"}'),
    );
    const ai = geminiProvider({ apiKey: 'k', model: 'gemini-test', fetch: fetch as never });
    expect(await ai.estimateShelfLife({ name: 'Curry leaves', location: 'fridge' })).toEqual({
      days: 5,
      basis: 'Fresh herb, refrigerated',
    });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toContain('/models/gemini-test:generateContent');
    expect(url).not.toContain('k');
    expect((init!.headers as Record<string, string>)['x-goog-api-key']).toBe('k');
    const body = JSON.parse(String(init!.body));
    expect(body.generationConfig).toEqual({ temperature: 0, responseMimeType: 'application/json' });
    expect(body.contents[0].parts[0].text).toBe('Item: Curry leaves\nStored in: fridge');
  });

  it('retries once on a bad answer or a 429, then gives up', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(answer('not json'))
      .mockResolvedValueOnce(answer('{"days": 3, "basis": "ok"}'));
    const ai = geminiProvider({ apiKey: 'k', model: 'm', fetch });
    expect((await ai.estimateShelfLife({ name: 'X', location: 'fridge' })).days).toBe(3);

    const failing = vi.fn().mockImplementation(async () => new Response('busy', { status: 429 }));
    await expect(
      geminiProvider({ apiKey: 'k', model: 'm', fetch: failing }).estimateShelfLife({
        name: 'X',
        location: 'fridge',
      }),
    ).rejects.toThrow(/usable answer/);
    expect(failing).toHaveBeenCalledTimes(2);

    const badKey = vi.fn().mockImplementation(async () => new Response('no', { status: 403 }));
    await expect(
      geminiProvider({ apiKey: 'k', model: 'm', fetch: badKey }).estimateShelfLife({
        name: 'X',
        location: 'fridge',
      }),
    ).rejects.toThrow();
    expect(badKey).toHaveBeenCalledTimes(1);
  });

  it('cleanup keeps our copy of each line and rejects a wrong-length answer', async () => {
    const fetch = vi.fn().mockImplementation(async () =>
      answer(
        JSON.stringify({
          lines: [
            {
              raw: 'model echo',
              name: 'Whole milk',
              category: 'dairy_eggs',
              location: 'fridge',
              confidence: 0.9,
            },
          ],
        }),
      ),
    );
    const ai = geminiProvider({ apiKey: 'k', model: 'm', fetch });
    expect((await ai.cleanupLines({ lines: ['GV WHL MLK'], store: null })).lines[0]).toMatchObject({
      raw: 'GV WHL MLK',
      name: 'Whole milk',
    });
    await expect(ai.cleanupLines({ lines: ['A', 'B'], store: null })).rejects.toThrow(
      /wrong number/,
    );
  });
});
