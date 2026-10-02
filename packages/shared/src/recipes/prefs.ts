import { foodById } from '../food/dictionary';
import { RECIPE_DIETS, type Diet, type Recipe, type RecipeDiet } from './types';

/** The strictest recipe diet each preference accepts (vegan < vegetarian < eggs < meat). */
const ALLOWED: Record<Diet, RecipeDiet> = {
  any: 'meat',
  eggs: 'eggs',
  vegetarian: 'vegetarian',
  vegan: 'vegan',
};

/** SRS 8.5 hard filter: does a person with `diet` eat a recipe marked `recipeDiet`? */
export function dietAllows(diet: Diet, recipeDiet: RecipeDiet): boolean {
  return RECIPE_DIETS.indexOf(recipeDiet) <= RECIPE_DIETS.indexOf(ALLOWED[diet]);
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * SRS 8.5 hard filter: the avoid-list words a recipe contains, matched as whole words against
 * each ingredient's name and its food's known names ("peanut" catches "Peanuts"). Optional
 * ingredients count too: an allergy isn't safe just because a garnish is optional.
 */
export function avoidedIn(recipe: Recipe, avoid: readonly string[]): string[] {
  const terms = avoid.map(norm).filter(Boolean);
  if (terms.length === 0) return [];
  const hits = new Set<string>();
  for (const ing of recipe.ingredients) {
    const names = [ing.name, ...(ing.foodId ? (foodById(ing.foodId)?.names ?? []) : [])].map(
      (n) => ` ${norm(n)} `,
    );
    for (const t of terms) {
      // Whole words, allowing a plural "s"/"es".
      const re = new RegExp(` ${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(e?s)? `);
      if (names.some((n) => re.test(n))) hits.add(t);
    }
  }
  return [...hits];
}
