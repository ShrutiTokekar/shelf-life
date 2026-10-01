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
    async estimateShelfLife({ name, location }) {
      const food = foodByName(name);
      return food
        ? { days: shelfLifeFor(food, location).days, basis: 'Typical for this food (mock)' }
        : { days: DEFAULT_SHELF_LIFE_DAYS.other[location], basis: 'Category default (mock)' };
    },
  };
}
