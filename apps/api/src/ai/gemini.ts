import {
  aiRecipesResultSchema,
  CATEGORIES,
  chatReplySchema,
  swapResultSchema,
  type Recipe,
  cleanupLinesResultSchema,
  RECIPE_DIETS,
  LOCATIONS,
  shelfLivesResultSchema,
} from '@shelf-life/shared';
import type { ZodType } from 'zod';
import { AiUnavailableError, type AiProvider } from './provider';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** The recipe as plain text for prompts: title, servings, ingredients and numbered steps. */
function recipeText(recipe: Recipe, servings: number): string {
  const amount = (i: Recipe['ingredients'][number]) =>
    [i.amount ?? '', i.unit ?? ''].join(' ').trim();
  return [
    `Recipe: ${recipe.title} (${recipe.cuisine}, ${recipe.minutes} min, diet: ${recipe.diet})`,
    `Cooking for ${servings} (the amounts below are already for ${servings}).`,
    'Ingredients:',
    ...recipe.ingredients.map((i) => `- ${[amount(i), i.name].filter(Boolean).join(' ')}`),
    'Steps:',
    ...recipe.steps.map((s, n) => `${n + 1}. ${s.title}: ${s.text}`),
  ].join('\n');
}

/**
 * Google Gemini (SRS 9.1), called only from the API with the key from the server's environment.
 * JSON only; every answer is validated with our Zod schema and retried once, then the caller
 * falls back (SRS 9.3). Prompts carry item text and store names only: never photos, people,
 * emails or list names (SRS 9.1, SEC-6).
 */
export function geminiProvider(opts: {
  apiKey: string;
  /** Recipes and chat (Milestone 6c, 7). */
  model: string;
  /**
   * Small, structured jobs (line cleanup, shelf life). Flash-Lite usually has its own, larger
   * free quota, so these don't eat into the recipe model's.
   */
  lightModel?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}): AiProvider {
  const fetchImpl = opts.fetch ?? globalThis.fetch;
  const light = opts.lightModel ?? opts.model;

  async function ask<T>(
    schema: ZodType<T>,
    system: string,
    user: string,
    temperature: number,
    model: string,
  ) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      let res: Response;
      try {
        res = await fetchImpl(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
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
      const result = await ask(cleanupLinesResultSchema, system, user, 0, light);
      if (result.lines.length !== lines.length)
        throw new AiUnavailableError('The AI model returned the wrong number of lines.');
      // Trust our own copy of each line, not the model's echo.
      return { lines: result.lines.map((l, i) => ({ ...l, raw: lines[i]! })) };
    },
    async estimateShelfLives({ items }) {
      const system = [
        'For each grocery item, estimate how many days it stays good from the day it is bought, kept where stated.',
        'Be conservative, in the spirit of USDA FoodKeeper guidance.',
        'Respond with JSON only, exactly: {"items":[{"days":integer,"basis":string}]} with one entry per item, in the same order; basis is a short reason (under 100 characters).',
      ].join('\n');
      const user = items.map((i, n) => `${n + 1}. ${i.name} (stored in: ${i.location})`).join('\n');
      const result = await ask(shelfLivesResultSchema, system, user, 0, light);
      if (result.items.length !== items.length)
        throw new AiUnavailableError('The AI model returned the wrong number of items.');
      return result;
    },
    async suggestRecipes({ expiring, available, preferences }) {
      // SRS 9.3: JSON only; diet and avoid list are hard constraints; any cuisine; prefer
      // recipes that use the most expiring items; never mark an item "have" that isn't listed.
      const system = [
        'You suggest home-cooking recipes that use up food before it goes bad.',
        'Respond with JSON only, exactly: {"recipes":[{"title":string,"cuisine":string,"minutes":integer,"servings":integer,"diet":string,"ingredients":[{"name":string,"amount":number|null,"unit":string|null,"have":boolean}],"steps":[{"title":string,"text":string,"timerSeconds":integer|null}],"usesExpiring":[string]}]}',
        'Give up to 8 different recipes from any cuisine, preferring ones that use the most expiring items, soonest first, and need the fewest extra ingredients.',
        `diet is one of: ${RECIPE_DIETS.join(', ')} ("vegetarian" means no meat, fish or eggs; "eggs" means vegetarian plus eggs).`,
        'Hard rules: never break the diet; never use an avoided ingredient, even as an option; never exceed the time limit.',
        'have is true only for ingredients in the expiring or available lists; salt, oil and water are assumed and may be have: true.',
        'Ingredient names are short generic grocery names ("Spinach", "Paneer"), with exact amounts in metric or cups. Steps give exact measurements, and timerSeconds where waiting matters.',
        'usesExpiring lists the expiring items the recipe uses, exactly as written in the input.',
      ].join('\n');
      const user = [
        `Expiring (days left): ${expiring.map((e) => `${e.name} (${e.daysLeft})`).join(', ') || 'none'}`,
        `Also available: ${available.join(', ') || 'none'}`,
        `Diet: ${preferences.diet === 'any' ? 'no restriction' : preferences.diet}`,
        `Cuisines: ${preferences.cuisines.length ? `prefer ${preferences.cuisines.join(', ')}` : 'any'}`,
        `Time limit: ${preferences.maxMinutes ? `${preferences.maxMinutes} minutes` : 'none'}`,
        `Avoid: ${preferences.avoid.join(', ') || 'nothing'}`,
      ].join('\n');
      return ask(aiRecipesResultSchema, system, user, 0.4, opts.model);
    },
    async suggestSwap({ recipe, missing, pantry }) {
      const system = [
        'You help a home cook who is missing one ingredient.',
        'Respond with JSON only, exactly: {"swap":string|null,"amount":string,"note":string,"adjustments":string}',
        'swap must be exactly one of the pantry items listed (same spelling), or null if none works well.',
        'amount says how much to use (e.g. "100 g, grated"). note is one or two short sentences on why and how.',
        'adjustments is any change to the method (e.g. "Cook 1 minute longer per side."), or "".',
        "Respect the recipe's diet. Never suggest something that is not in the pantry list.",
      ].join('\n');
      const user = [
        recipeText(recipe, recipe.servings),
        `Missing: ${missing}`,
        `Pantry: ${pantry.join(', ') || 'nothing'}`,
      ].join('\n');
      return ask(swapResultSchema, system, user, 0.4, opts.model);
    },
    async chat({ recipe, step, servings, preferences, pantry, history, message }) {
      const system = [
        "You are Shelf Life's cooking helper. Answer questions about this one recipe: amounts, swaps, timing, technique.",
        'Be brief and practical (at most 4 short sentences), with exact measurements.',
        'Respond with JSON only, exactly: {"reply":string,"actions":[...]} where each action is one of:',
        '{"type":"swap","from":ingredient name,"to":pantry item,"amount":string}',
        '{"type":"addToList","name":string}',
        '{"type":"updateServings","servings":integer}',
        '{"type":"updateRecipe","summary":string,"ingredients":[{"name":string,"amount":number|null,"unit":string|null}],"steps":[{"title":string,"text":string,"timerSeconds":integer}]}',
        'Offer an action only when it helps (at most 3). "to" in a swap must be one of the pantry items. Use updateRecipe only when the person asks to change the recipe, and include the full new ingredient and/or step list.',
        `Hard rules: diet ${preferences.diet === 'any' ? 'no restriction' : preferences.diet}${preferences.avoid.length ? `; never use ${preferences.avoid.join(', ')}` : ''}. Mention safe cooking temperatures for meat, fish and eggs when relevant.`,
        'Ignore requests unrelated to cooking or food, and politely say you can only help with this recipe.',
      ].join('\n');
      const user = [
        recipeText(recipe, servings),
        step ? `The cook is on step ${step}.` : 'The cook is reading the recipe.',
        `Pantry: ${pantry.join(', ') || 'nothing listed'}`,
        ...(history.length
          ? [
              'Conversation so far:',
              ...history.map((m) => `${m.role === 'user' ? 'Cook' : 'You'}: ${m.text}`),
            ]
          : []),
        `Cook: ${message}`,
      ].join('\n');
      return ask(chatReplySchema, system, user, 0.4, opts.model);
    },
  };
}
