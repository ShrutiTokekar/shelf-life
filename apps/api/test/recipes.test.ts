import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  apiErrorSchema,
  DEFAULT_RECIPE_PREFS,
  meResponseSchema,
  recipeSchema,
  recipesResponseSchema,
  savedRecipeSchema,
  type AiRecipe,
} from '@shelf-life/shared';
import { geminiProvider } from '../src/ai/gemini';
import { mockProvider } from '../src/ai/mock';
import type { AiProvider } from '../src/ai/provider';
import { recipeCacheKey, toRecipe } from '../src/ai/service';
import { setup } from './helpers';

let t: Awaited<ReturnType<typeof setup>> | undefined;
afterEach(async () => {
  await t?.close();
  t = undefined;
});

function counting(): AiProvider & { calls: number } {
  const base = mockProvider();
  const p = { ...base, name: 'counting', calls: 0 } as AiProvider & { calls: number };
  p.suggestRecipes = async (input) => {
    p.calls++;
    return base.suggestRecipes(input);
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

const ask = (cookie: string, pantryId: string, over: object = {}) =>
  t!.request('/api/v1/ai/recipes', {
    method: 'POST',
    cookie,
    body: JSON.stringify({
      pantryId,
      expiring: [
        { name: 'Spinach', daysLeft: 0 },
        { name: 'Paneer', daysLeft: 1 },
      ],
      available: ['Onion', 'Garlic'],
      preferences: DEFAULT_RECIPE_PREFS,
      ...over,
    }),
  });

describe('POST /ai/recipes (SRS 9.2, 9.4)', () => {
  it('returns stored AI recipes, cached for 6 hours by expiring items and preferences', async () => {
    const provider = counting();
    t = await setup({ ai: provider });
    const { cookie, pantryId } = await owner();
    const first = recipesResponseSchema.parse(await (await ask(cookie, pantryId)).json());
    expect(first.recipes.map((r) => r.title)).toEqual([
      'Quick spinach stir-fry',
      'Quick paneer stir-fry',
    ]);
    expect(first.recipes[0]!.source).toBe('ai');
    // Same expiring food, different "available": served from the cache, no new call.
    const again = recipesResponseSchema.parse(
      await (await ask(cookie, pantryId, { available: ['Rice'] })).json(),
    );
    expect(again.recipes.map((r) => r.id)).toEqual(first.recipes.map((r) => r.id));
    expect(provider.calls).toBe(1);
    // Different preferences: a new call.
    await ask(cookie, pantryId, { preferences: { ...DEFAULT_RECIPE_PREFS, maxMinutes: 30 } });
    expect(provider.calls).toBe(2);
    // GET /recipes/:id serves the kept AI recipe.
    const res = await t.request(`/api/v1/recipes/${first.recipes[0]!.id}`, { cookie });
    expect(recipeSchema.parse(await res.json()).title).toBe('Quick spinach stir-fry');
  });

  it('rule 2: AI off answers 503 so the app ranks its local recipes instead', async () => {
    t = await setup({ ai: null });
    const { cookie, pantryId } = await owner();
    const res = await ask(cookie, pantryId);
    expect(res.status).toBe(503);
    expect(apiErrorSchema.parse(await res.json()).error.code).toBe('ai_unavailable');
  });

  it('SEC-3 only people who can edit the pantry spend its AI calls', async () => {
    t = await setup({ ai: counting() });
    const { pantryId } = await owner();
    const stranger = await t.signIn('x@example.com', 'X');
    expect((await ask(stranger.cookie, pantryId)).status).toBe(404);
  });
});

describe('SRS 8.5, 9.3 hard rules on AI answers', () => {
  const base: AiRecipe = {
    title: 'Paneer tikka',
    cuisine: 'South Asian',
    minutes: 25,
    servings: 2,
    diet: 'vegetarian',
    ingredients: [
      { name: 'Paneer', amount: 200, unit: 'g', have: true },
      { name: 'Salt', amount: null, unit: null, have: true },
    ],
    steps: [{ title: 'Grill', text: 'Grill it.', timerSeconds: null }],
    usesExpiring: ['Paneer'],
  };
  const prefs = DEFAULT_RECIPE_PREFS;

  it('drops recipes that break the diet, time limit or avoid list; marks basics', () => {
    const ok = toRecipe(base, prefs)!;
    expect(ok.ingredients[1]).toMatchObject({ name: 'Salt', basic: true });
    expect(ok.steps[0]!.timerSeconds).toBeUndefined();
    expect(toRecipe(base, { ...prefs, diet: 'vegan' })).toBeNull();
    expect(toRecipe({ ...base, diet: 'eggs' }, { ...prefs, diet: 'vegetarian' })).toBeNull();
    expect(toRecipe(base, { ...prefs, maxMinutes: 20 })).toBeNull();
    expect(toRecipe(base, { ...prefs, avoid: ['paneer'] })).toBeNull();
  });

  it('the cache key ignores order and case and holds no pantry or person', () => {
    const a = recipeCacheKey({
      expiring: [
        { name: 'Spinach', daysLeft: 0 },
        { name: 'paneer', daysLeft: 1 },
      ],
      preferences: prefs,
    });
    const b = recipeCacheKey({
      expiring: [
        { name: 'Paneer', daysLeft: 2 },
        { name: 'spinach', daysLeft: 1 },
      ],
      preferences: prefs,
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^recipes:[0-9a-f]{64}$/);
  });

  it('Gemini: recipes use the main model at temperature 0.4 and send no people', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify({ recipes: [base] }) }] } }],
          }),
        ),
    );
    const ai = geminiProvider({
      apiKey: 'k',
      model: 'gemini-big',
      lightModel: 'gemini-lite',
      fetch: fetch as never,
    });
    const out = await ai.suggestRecipes({
      expiring: [{ name: 'Paneer', daysLeft: 1 }],
      available: ['Onion'],
      preferences: { ...prefs, diet: 'vegetarian', avoid: ['peanuts'] },
    });
    expect(out.recipes).toHaveLength(1);
    const [url, init] = fetch.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toContain('/models/gemini-big:generateContent');
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig.temperature).toBe(0.4);
    const text = body.contents[0].parts[0].text as string;
    expect(text).toContain('Paneer (1)');
    expect(text).toContain('Avoid: peanuts');
    expect(text).toContain('Diet: vegetarian');
  });
});

describe('saved recipes and GET /recipes/:id (SAV-1, SAV-2, SRS 11.1)', () => {
  it('saves, lists and unsaves local recipes; unknown ids are 404', async () => {
    t = await setup({ ai: counting() });
    const { cookie } = await owner();
    const local = await t.request('/api/v1/recipes/palak-paneer-quick', { cookie });
    expect(recipeSchema.parse(await local.json()).source).toBe('local');
    expect((await t.request('/api/v1/recipes/nope', { cookie })).status).toBe(404);

    const put = (id: string) =>
      t!.request(`/api/v1/me/saved-recipes/${id}`, { method: 'PUT', cookie });
    expect((await put('palak-paneer-quick')).status).toBe(204);
    expect((await put('palak-paneer-quick')).status).toBe(204);
    expect((await put('nope')).status).toBe(404);
    const list = async () =>
      (
        (await (await t!.request('/api/v1/me/saved-recipes', { cookie })).json()) as {
          saved: unknown[];
        }
      ).saved.map((s) => savedRecipeSchema.parse(s).recipe.id);
    expect(await list()).toEqual(['palak-paneer-quick']);
    await t.request('/api/v1/me/saved-recipes/palak-paneer-quick', { method: 'DELETE', cookie });
    expect(await list()).toEqual([]);
  });
});

describe('PATCH /me/settings (SRS 11.1, PRO-3)', () => {
  it('stores recipe preferences and returns them on /me', async () => {
    t = await setup({ ai: null });
    const { cookie } = await owner();
    const res = await t.request('/api/v1/me/settings', {
      method: 'PATCH',
      cookie,
      body: JSON.stringify({ diet: 'vegetarian', maxMinutes: 30, avoid: ['peanuts'] }),
    });
    expect(res.status).toBe(200);
    const me = meResponseSchema.parse(await (await t.request('/api/v1/me', { cookie })).json());
    expect(me.settings).toMatchObject({
      diet: 'vegetarian',
      maxMinutes: 30,
      avoid: ['peanuts'],
      cuisines: [],
      textSize: 'default',
    });
    const bad = await t.request('/api/v1/me/settings', {
      method: 'PATCH',
      cookie,
      body: JSON.stringify({ diet: 'carnivore' }),
    });
    expect(bad.status).toBe(400);
  });
});
