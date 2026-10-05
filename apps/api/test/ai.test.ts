import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiErrorSchema, shelfLivesResultSchema } from '@shelf-life/shared';
import { geminiProvider } from '../src/ai/gemini';
import { mockProvider } from '../src/ai/mock';
import type { AiProvider } from '../src/ai/provider';
import { aiService } from '../src/ai/service';
import { setup } from './helpers';

let t: Awaited<ReturnType<typeof setup>> | undefined;
afterEach(async () => {
  await t?.close();
  t = undefined;
});

/** A mock provider that counts calls. */
function counting(): AiProvider & { calls: number } {
  const base = mockProvider();
  const p: AiProvider & { calls: number } = {
    ...base,
    name: 'counting',
    calls: 0,
    async cleanupLines(input) {
      p.calls++;
      return base.cleanupLines(input);
    },
    async estimateShelfLives(input) {
      p.calls++;
      return base.estimateShelfLives(input);
    },
    async suggestRecipes(input) {
      p.calls++;
      return base.suggestRecipes(input);
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

const shelf = (cookie: string, pantryId: string, ...names: string[]) =>
  post('/api/v1/ai/shelf-life', cookie, {
    pantryId,
    items: names.map((name) => ({ name, location: 'fridge' })),
  });

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
    const stranger = await t.signIn('x@example.com', 'X');
    expect(
      (await post('/api/v1/ai/cleanup-lines', stranger.cookie, { pantryId, lines: ['A'] })).status,
    ).toBe(404);
    expect(
      (await post('/api/v1/ai/cleanup-lines', stranger.cookie, { pantryId, lines: [] })).status,
    ).toBe(400);
    expect(
      (await t.request('/api/v1/ai/cleanup-lines', { method: 'POST', body: '{}' })).status,
    ).toBe(401);
  });
});

describe('POST /ai/shelf-life (SRS 9.2), batched', () => {
  it('answers several items in one call, in order, and caches each', async () => {
    const provider = counting();
    t = await setup({ ai: provider });
    const { cookie, pantryId } = await owner();
    const res = await shelf(cookie, pantryId, 'Paneer', 'Yuzu kosho', 'Paneer');
    const body = shelfLivesResultSchema.parse(await res.json());
    expect(body.items).toHaveLength(3);
    expect(body.items[0]).toEqual(body.items[2]);
    expect(provider.calls).toBe(1);
    await shelf(cookie, pantryId, 'Yuzu kosho');
    expect(provider.calls).toBe(1);
  });
});

describe('SRS 9.4 limits', () => {
  it('per pantry: stops at its daily limit with 429 ai_limit; cached answers still work', async () => {
    t = await setup({ ai: counting() });
    const { cookie, pantryId } = await owner();
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++)
      statuses.push((await shelf(cookie, pantryId, `Thing ${i}`)).status);
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
    const last = await shelf(cookie, pantryId, 'Another');
    expect(apiErrorSchema.parse(await last.json()).error.code).toBe('ai_limit');
    expect((await shelf(cookie, pantryId, 'Thing 0')).status).toBe(200);
  });

  async function serviceWith(opts: { globalDailyLimit?: number; perMinuteLimit?: number }) {
    t = await setup({ ai: counting() });
    const a = await owner();
    const b = await t.signIn('b@example.com', 'B');
    const bHome = (await (
      await t.request('/api/v1/lists', {
        method: 'POST',
        cookie: b.cookie,
        body: JSON.stringify({ name: 'B home', color: 'olive' }),
      })
    ).json()) as { pantryId: string };
    let clock = 0;
    const ai = aiService({
      db: t.db,
      provider: counting(),
      dailyLimit: 30,
      perMinuteLimit: 100,
      ...opts,
      now: () => clock,
    });
    const ask = (who: 'a' | 'b', name: string) =>
      ai.estimateShelfLives(who === 'a' ? a.user.id : b.user.id, {
        pantryId: who === 'a' ? a.pantryId : bHome.pantryId,
        items: [{ name, location: 'fridge' }],
      });
    return { ask, tick: (ms: number) => (clock += ms) };
  }

  it('app-wide: one shared daily ceiling across all pantries, then AI is "unavailable"', async () => {
    const { ask } = await serviceWith({ globalDailyLimit: 3 });
    await ask('a', 'One');
    await ask('b', 'Two');
    await ask('a', 'Three');
    await expect(ask('b', 'Four')).rejects.toThrow(/app’s AI help for today/);
    // The failed call didn't use up B's own allowance either (both or neither).
    const used = await t!.db.query.aiUsage.findMany();
    expect(used.reduce((n, r) => n + r.count, 0)).toBe(3);
  });

  it('per minute: spreads calls so Google’s per-minute limit isn’t hit', async () => {
    const { ask, tick } = await serviceWith({ perMinuteLimit: 2 });
    await ask('a', 'One');
    await ask('b', 'Two');
    await expect(ask('a', 'Three')).rejects.toThrow(/busy/);
    tick(60_000);
    await expect(ask('a', 'Three')).resolves.toHaveLength(1);
  });
});

describe('geminiProvider (SRS 9.1, 9.3)', () => {
  const answer = (text: string, status = 200) =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status });
  const urlOf = (call: unknown[]) => String(call[0]);

  it('sends JSON-only requests with the key in a header, using the light model for small jobs', async () => {
    const fetch = vi.fn(async () => answer('{"items":[{"days": 5, "basis": "Fresh herb"}]}'));
    const ai = geminiProvider({
      apiKey: 'k',
      model: 'gemini-big',
      lightModel: 'gemini-lite',
      fetch: fetch as never,
    });
    expect(
      await ai.estimateShelfLives({ items: [{ name: 'Curry leaves', location: 'fridge' }] }),
    ).toEqual({
      items: [{ days: 5, basis: 'Fresh herb' }],
    });
    const [url, init] = fetch.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toContain('/models/gemini-lite:generateContent');
    expect(url).not.toContain('key=');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('k');
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig).toEqual({ temperature: 0, responseMimeType: 'application/json' });
    expect(body.contents[0].parts[0].text).toBe('1. Curry leaves (stored in: fridge)');
  });

  it('retries once on a bad answer or a 429, then gives up; a bad key isn’t retried', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(answer('not json'))
      .mockResolvedValueOnce(answer('{"items":[{"days": 3, "basis": "ok"}]}'));
    const ai = geminiProvider({ apiKey: 'k', model: 'm', fetch });
    expect(
      (await ai.estimateShelfLives({ items: [{ name: 'X', location: 'fridge' }] })).items[0]!.days,
    ).toBe(3);

    const failing = vi.fn().mockImplementation(async () => new Response('busy', { status: 429 }));
    await expect(
      geminiProvider({ apiKey: 'k', model: 'm', fetch: failing }).estimateShelfLives({
        items: [{ name: 'X', location: 'fridge' }],
      }),
    ).rejects.toThrow(/usable answer/);
    expect(failing).toHaveBeenCalledTimes(2);

    const badKey = vi.fn().mockImplementation(async () => new Response('no', { status: 403 }));
    await expect(
      geminiProvider({ apiKey: 'k', model: 'm', fetch: badKey }).estimateShelfLives({
        items: [{ name: 'X', location: 'fridge' }],
      }),
    ).rejects.toThrow();
    expect(badKey).toHaveBeenCalledTimes(1);
    expect(urlOf(badKey.mock.calls[0]!)).toContain('/models/m:');
  });

  it('keeps our copy of each line and rejects wrong-length answers', async () => {
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
    const short = vi.fn().mockImplementation(async () => answer('{"items":[]}'));
    await expect(
      geminiProvider({ apiKey: 'k', model: 'm', fetch: short }).estimateShelfLives({
        items: [{ name: 'X', location: 'fridge' }],
      }),
    ).rejects.toThrow();
  });
});
