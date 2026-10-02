import type { Recipe } from './types';
import { EAST_ASIAN } from './data/eastAsian';
import { EVERYDAY } from './data/everyday';
import { ITALIAN } from './data/italian';
import { MEXICAN } from './data/mexican';
import { MIDDLE_EASTERN } from './data/middleEastern';
import { SOUTH_ASIAN } from './data/southAsian';

/**
 * The local recipe set (SRS 8.5): original recipes written for Shelf Life, CC0. It is the
 * fallback whenever AI is off, offline or over its limit (rule 2). Imported through
 * `@shelf-life/shared/recipes` so the app loads it only when recipes are needed.
 */
export const LOCAL_RECIPES: readonly Recipe[] = [
  ...SOUTH_ASIAN,
  ...MEXICAN,
  ...ITALIAN,
  ...MIDDLE_EASTERN,
  ...EAST_ASIAN,
  ...EVERYDAY,
].map((r) => ({ ...r, source: 'local' as const }));

const byId = new Map(LOCAL_RECIPES.map((r) => [r.id, r]));

export function localRecipe(id: string): Recipe | undefined {
  return byId.get(id);
}
