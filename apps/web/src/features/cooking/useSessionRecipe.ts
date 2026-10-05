import { scaleIngredients, type Recipe } from '@shelf-life/shared';
import { useMemo } from 'react';
import { useCookSession, type Swap } from '../../stores/cookSession';

const sameName = (a: string, b: string) => {
  const n = (s: string) => s.toLowerCase().split(/[,(]/)[0]!.trim();
  return n(a) === n(b) || a.toLowerCase().includes(n(b)) || b.toLowerCase().includes(n(a));
};

/** Swap ingredients by name (RCP-4): the new item, same amount, matched to the pantry by name. */
export function applySwaps(recipe: Recipe, swaps: readonly Swap[]): Recipe {
  if (swaps.length === 0) return recipe;
  return {
    ...recipe,
    ingredients: recipe.ingredients.map((i) => {
      const s = swaps.find((x) => sameName(i.name, x.from));
      if (!s) return i;
      // A new ingredient: match it to the pantry by its name, not the old food id.
      const next = { ...i, name: s.to };
      delete next.foodId;
      return next;
    }),
  };
}

/**
 * The recipe as cooked in this session (SRS 8.10, RCP-4, RCP-8): scaled to the chosen servings,
 * with any AI update and swaps applied. Shared by the recipe page, cook-along and chat.
 */
export function useSessionRecipe(recipe: Recipe | null) {
  const id = recipe?.id ?? '';
  const chosen = useCookSession((s) => s.servings[id]);
  const swaps = useCookSession((s) => s.swaps[id]);
  const update = useCookSession((s) => s.updates[id]);
  const setServingsFor = useCookSession((s) => s.setServings);
  const servings = chosen ?? recipe?.servings ?? 1;

  const session = useMemo(() => {
    if (!recipe) return null;
    let r: Recipe = recipe;
    if (update) {
      r = {
        ...r,
        ingredients: scaleIngredients(
          update.ingredients ?? r.ingredients,
          update.servings,
          servings,
        ),
        steps: update.steps ?? r.steps,
      };
    } else {
      r = { ...r, ingredients: scaleIngredients(r.ingredients, r.servings, servings) };
    }
    return applySwaps(r, swaps ?? []);
  }, [recipe, update, swaps, servings]);

  return {
    recipe: session,
    servings,
    swaps: swaps ?? [],
    update: update ?? null,
    setServings: (n: number) => {
      if (recipe) setServingsFor(recipe.id, n);
    },
  };
}
