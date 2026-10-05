import {
  DEFAULT_LOCATION,
  DEFAULT_SHELF_LIFE_DAYS,
  displayName,
  expandReceiptText,
  foodByName,
  isNonFood,
  matchFood,
  matchKey,
  shelfLifeFor,
} from '@shelf-life/shared';
import type { AiProvider } from './provider';

/**
 * SRS 14.1 local and test provider: deterministic answers without calling anyone. It reads lines
 * with the app's own dictionary, so it's a believable stand-in for the model.
 */
export function mockProvider(): AiProvider {
  return {
    name: 'mock',
    async cleanupLines({ lines }) {
      return {
        lines: lines.map((raw) => {
          const expanded = expandReceiptText(raw);
          const match = matchFood(matchKey(expanded));
          if (isNonFood(expanded))
            return { raw, name: null, category: 'other', location: 'cupboard', confidence: 0.9 };
          if (match)
            return {
              raw,
              name: match.food.name,
              category: match.food.category,
              location: match.food.defaultLocation,
              confidence: 0.75,
            };
          return {
            raw,
            name: displayName(expanded) || raw,
            category: 'other',
            location: DEFAULT_LOCATION.other,
            confidence: 0.4,
          };
        }),
      };
    },
    async suggestRecipes({ expiring, available }) {
      // One simple, clearly-mock recipe per expiring item (at most 3).
      return {
        recipes: expiring.slice(0, 3).map(({ name }) => ({
          title: `Quick ${name.toLowerCase()} stir-fry`,
          cuisine: 'everyday',
          minutes: 15,
          servings: 2,
          diet: 'vegan' as const,
          ingredients: [
            { name, amount: null, unit: null, have: true },
            { name: 'Garlic', amount: 2, unit: 'cloves', have: available.includes('Garlic') },
            { name: 'Soy sauce', amount: 1, unit: 'tbsp', have: available.includes('Soy sauce') },
          ],
          steps: [
            { title: 'Prep', text: `Chop the ${name.toLowerCase()} and the garlic.` },
            {
              title: 'Stir-fry',
              text: 'Stir-fry everything in a hot pan with a little oil, then add the soy sauce.',
              timerSeconds: 300,
            },
          ],
          usesExpiring: [name],
        })),
      };
    },
    async suggestSwap({ missing, pantry }) {
      // Same dictionary category as the missing item (cheddar → paneer): a believable stand-in.
      const want = foodByName(missing.toLowerCase())?.category;
      const swap = want ? pantry.find((p) => foodByName(p.toLowerCase())?.category === want) : null;
      return swap
        ? {
            swap,
            amount: 'the same amount',
            note: `Use your ${swap.toLowerCase()} instead of ${missing.toLowerCase()} (mock).`,
            adjustments: '',
          }
        : {
            swap: null,
            amount: '',
            note: 'Nothing in your pantry is a good match (mock).',
            adjustments: '',
          };
    },
    async chat({ message, servings, step, recipe, pantry }) {
      const forN = /\bfor (\d{1,2})\b/i.exec(message);
      if (forN)
        return {
          reply: `Done: here it is for ${forN[1]} servings (mock).`,
          actions: [{ type: 'updateServings' as const, servings: Number(forN[1]) }],
        };
      const missing = recipe.ingredients.find((i) =>
        message.toLowerCase().includes(i.name.toLowerCase().split(/[ ,(]/)[0]!),
      );
      if (missing && /don.t have|missing|out of|no /i.test(message)) {
        const swap = pantry.find((p) => p.toLowerCase() !== missing.name.toLowerCase());
        return {
          reply: swap
            ? `Try your ${swap.toLowerCase()} instead (mock).`
            : `Add ${missing.name.toLowerCase()} to your list (mock).`,
          actions: [
            ...(swap
              ? [{ type: 'swap' as const, from: missing.name, to: swap, amount: 'same amount' }]
              : []),
            { type: 'addToList' as const, name: missing.name },
          ],
        };
      }
      return {
        reply: `Mock answer for ${servings} servings${step ? `, step ${step}` : ''}: ${message}`,
        actions: [],
      };
    },
    async estimateShelfLives({ items }) {
      return {
        items: items.map(({ name, location }) => {
          const food = foodByName(name);
          return food
            ? { days: shelfLifeFor(food, location).days, basis: 'Typical for this food (mock)' }
            : { days: DEFAULT_SHELF_LIFE_DAYS.other[location], basis: 'Category default (mock)' };
        }),
      };
    },
  };
}
