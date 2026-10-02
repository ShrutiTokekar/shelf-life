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
