import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  apiErrorSchema,
  chatResponseSchema,
  DEFAULT_RECIPE_PREFS,
  swapResultSchema,
  type Recipe,
} from '@shelf-life/shared';
import { localRecipe } from '@shelf-life/shared/recipes';
import { geminiProvider } from '../src/ai/gemini';
import { mockProvider } from '../src/ai/mock';
import type { AiProvider } from '../src/ai/provider';
import { groundAction } from '../src/ai/service';
import { schema } from '../src/db/client';
import { setup } from './helpers';

let t: Awaited<ReturnType<typeof setup>> | undefined;
afterEach(async () => {
  await t?.close();
  t = undefined;
});

const recipe = localRecipe('black-bean-quesadillas')!;

function counting(over: Partial<AiProvider> = {}): AiProvider & { calls: number } {
  const base = mockProvider();
  const p = { ...base, name: 'counting', calls: 0, ...over } as AiProvider & { calls: number };
  const swap = p.suggestSwap;
  const chat = p.chat;
  p.suggestSwap = async (i) => {
    p.calls++;
    return swap(i);
  };
  p.chat = async (i) => {
    p.calls++;
    return chat(i);
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

describe('POST /ai/swap (RCP-4, SRS 9.2)', () => {
  it('suggests something from the pantry, caches it, and nulls invented swaps', async () => {
    const provider = counting();
    t = await setup({ ai: provider });
    const { cookie, pantryId } = await owner();
    const body = { pantryId, recipe, missing: 'Cheddar', pantry: ['Paneer', 'Spinach'] };
    const first = swapResultSchema.parse(
      await (await post('/api/v1/ai/swap', cookie, body)).json(),
    );
    expect(first.swap).toBe('Paneer');
    await post('/api/v1/ai/swap', cookie, { ...body, pantry: ['spinach', 'PANEER'] });
    expect(provider.calls).toBe(1);

    const inventing = counting({
      async suggestSwap() {
        return { swap: 'Gruyère', amount: '100 g', note: 'Use gruyère.', adjustments: '' };
      },
    });
    await t.close();
    t = await setup({ ai: inventing });
    const o = await owner();
    const res = swapResultSchema.parse(
      await (await post('/api/v1/ai/swap', o.cookie, { ...body, pantryId: o.pantryId })).json(),
    );
    expect(res).toEqual({ swap: null, amount: '', note: '', adjustments: '' });
  });

  it('rule 2: AI off is 503 and the app shows "Missing" only', async () => {
    t = await setup({ ai: null });
    const { cookie, pantryId } = await owner();
    const res = await post('/api/v1/ai/swap', cookie, {
      pantryId,
      recipe,
      missing: 'Cheddar',
      pantry: ['Paneer'],
    });
    expect(res.status).toBe(503);
  });
});

describe('POST /ai/chat (RCP-8, SRS 9.2)', () => {
  const ask = (cookie: string, pantryId: string, message: string, threadId?: string) =>
    post('/api/v1/ai/chat', cookie, {
      pantryId,
      threadId,
      recipe,
      step: 2,
      servings: 2,
      preferences: DEFAULT_RECIPE_PREFS,
      pantry: ['Paneer', 'Tortillas'],
      message,
    });

  it('answers with actions, keeps a thread with the last 10 messages, each message spends a call', async () => {
    const seen: number[] = [];
    const provider = counting();
    const chat = provider.chat;
    provider.chat = async (i) => {
      seen.push(i.history.length);
      return chat(i);
    };
    t = await setup({ ai: provider });
    const { cookie, pantryId } = await owner();
    const one = chatResponseSchema.parse(
      await (await ask(cookie, pantryId, 'I don’t have cheddar')).json(),
    );
    expect(one.actions).toEqual(
      expect.arrayContaining([
        { type: 'swap', from: 'Cheddar, grated', to: 'Paneer', amount: 'same amount' },
        { type: 'addToList', name: 'Cheddar, grated' },
      ]),
    );
    const two = chatResponseSchema.parse(
      await (await ask(cookie, pantryId, 'Make it for 4', one.threadId)).json(),
    );
    expect(two.threadId).toBe(one.threadId);
    expect(two.actions).toEqual([{ type: 'updateServings', servings: 4 }]);
    expect(seen).toEqual([0, 2]);
    expect(provider.calls).toBe(2);
    const usage = await t.db.query.aiUsage.findMany();
    expect(usage[0]!.count).toBe(2);

    const thread = (await (
      await t.request(`/api/v1/ai/chat/${one.threadId}`, { cookie })
    ).json()) as { messages: { role: string }[] };
    expect(thread.messages.map((m) => m.role)).toEqual(['user', 'ai', 'user', 'ai']);
  });

  it('SEC-3 threads are private: someone else’s thread id starts a new thread', async () => {
    t = await setup({ ai: counting() });
    const a = await owner();
    const first = chatResponseSchema.parse(await (await ask(a.cookie, a.pantryId, 'Hi')).json());
    const b = await t.signIn('b@example.com', 'B');
    const bHome = (await (
      await t.request('/api/v1/lists', {
        method: 'POST',
        cookie: b.cookie,
        body: JSON.stringify({ name: 'B', color: 'olive' }),
      })
    ).json()) as { pantryId: string };
    const theirs = chatResponseSchema.parse(
      await (await ask(b.cookie, bHome.pantryId, 'Hi', first.threadId)).json(),
    );
    expect(theirs.threadId).not.toBe(first.threadId);
    expect(
      (await t.request(`/api/v1/ai/chat/${first.threadId}`, { cookie: b.cookie })).status,
    ).toBe(404);
  });

  it('SRS 10: messages older than 30 days are deleted', async () => {
    t = await setup({ ai: counting() });
    const { cookie, pantryId } = await owner();
    const first = chatResponseSchema.parse(await (await ask(cookie, pantryId, 'Hi')).json());
    await t.db
      .update(schema.chatMessage)
      .set({ createdAt: new Date(Date.now() - 31 * 24 * 3600_000) });
    await ask(cookie, pantryId, 'Again', first.threadId);
    const left = await t.db.select().from(schema.chatMessage);
    expect(left.map((m) => m.text).sort()).toEqual(['Again', expect.stringContaining('Again')]);
  });

  it('rule 2: offline/AI off is 503 so the app says chat needs a connection', async () => {
    t = await setup({ ai: null });
    const { cookie, pantryId } = await owner();
    const res = await ask(cookie, pantryId, 'Hi');
    expect(res.status).toBe(503);
    expect(apiErrorSchema.parse(await res.json()).error.code).toBe('ai_unavailable');
  });
});

describe('SRS 9.3 grounding chat actions', () => {
  const input = { pantry: ['Paneer'], preferences: DEFAULT_RECIPE_PREFS, recipe };
  it('drops swaps to things not in the pantry and recipe updates that break the avoid list', () => {
    expect(
      groundAction({ type: 'swap', from: 'Cheddar', to: 'paneer', amount: '' }, input),
    ).toEqual({ type: 'swap', from: 'Cheddar', to: 'Paneer', amount: '' });
    expect(
      groundAction({ type: 'swap', from: 'Cheddar', to: 'Feta', amount: '' }, input),
    ).toBeNull();
    const withPeanuts: Recipe['ingredients'] = [{ name: 'Peanuts', amount: 50, unit: 'g' }];
    expect(
      groundAction(
        { type: 'updateRecipe', summary: 'Nutty', ingredients: withPeanuts },
        { ...input, preferences: { ...DEFAULT_RECIPE_PREFS, avoid: ['peanuts'] } },
      ),
    ).toBeNull();
    expect(groundAction({ type: 'updateRecipe', summary: 'Nothing' }, input)).toBeNull();
  });

  it('Gemini: chat uses the main model at 0.4 and sends recipe, step and history, not people', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: '{"reply":"Use paneer.","actions":[]}' }] } },
            ],
          }),
        ),
    );
    const ai = geminiProvider({
      apiKey: 'k',
      model: 'big',
      lightModel: 'lite',
      fetch: fetch as never,
    });
    await ai.chat({
      recipe,
      step: 3,
      servings: 4,
      preferences: { ...DEFAULT_RECIPE_PREFS, avoid: ['peanuts'] },
      pantry: ['Paneer'],
      history: [{ role: 'user', text: 'Hi', actions: [] }],
      message: 'Swap for cheddar?',
    });
    const [url, init] = fetch.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toContain('/models/big:');
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig.temperature).toBe(0.4);
    const text = body.contents[0].parts[0].text as string;
    expect(text).toContain('The cook is on step 3.');
    expect(text).toContain('Cook: Hi');
    expect(text).toContain('Cook: Swap for cheddar?');
    expect(body.systemInstruction.parts[0].text).toContain('never use peanuts');
  });
});
