import {
  addDays,
  DEFAULT_RECIPE_PREFS,
  foodById,
  newListItem,
  recipeSchema,
  type ListItem,
  type PantryItem,
  type Recipe,
  type RecipePrefs,
} from '@shelf-life/shared';
import { LOCAL_RECIPES } from '@shelf-life/shared/recipes';
import { describe, expect, it } from 'vitest';
import { matchRecipe, rankRecipes, readiness, scoreRecipe, urgencyWeight } from '../src';

const TODAY = '2026-10-01';
let n = 0;
function item(foodId: string | null, days: number, over: Partial<PantryItem> = {}): PantryItem {
  n++;
  return {
    id: `i${n}`,
    pantryId: 'p',
    listId: 'home',
    foodId,
    name: foodId ? foodById(foodId)!.name : `Item ${n}`,
    category: 'produce',
    location: 'fridge',
    quantity: 1,
    unit: '',
    note: '',
    purchasedOn: addDays(TODAY, -3),
    expiresOn: addDays(TODAY, days),
    expiryIsEstimate: true,
    expirySource: 'dictionary',
    status: 'active',
    outAt: null,
    addedBy: 'u1',
    receiptLineId: null,
    updatedAt: '',
    ...over,
  };
}
const entry = (name: string, over: Partial<ListItem> = {}): ListItem => ({
  ...newListItem({ name, quantity: null, unit: '' }, { listId: 'home', userId: 'u2', now: '' }),
  ...over,
});

function recipe(over: Partial<Recipe> & Pick<Recipe, 'ingredients'>): Recipe {
  return {
    id: over.title ?? 'r',
    source: 'local',
    title: 'R',
    cuisine: 'everyday',
    minutes: 20,
    servings: 2,
    diet: 'vegan',
    steps: [{ title: 'Cook', text: 'Cook it.' }],
    ...over,
  };
}
const ing = (name: string, foodId?: string, flag?: 'basic' | 'optional') => ({
  name,
  ...(foodId ? { foodId } : {}),
  amount: null,
  unit: null,
  ...(flag ? { [flag]: true as const } : {}),
});
const prefs = (over: Partial<RecipePrefs> = {}): RecipePrefs => ({
  ...DEFAULT_RECIPE_PREFS,
  ...over,
});

describe('SRS 8.5 urgency weight', () => {
  it.each([
    [-1, 10],
    [0, 10],
    [1, 7],
    [2, 6],
    [3, 5],
    [4, 3],
    [7, 3],
    [8, 0.5],
  ])('%i days left → %d', (d, w) => expect(urgencyWeight(d)).toBe(w));
});

describe('SRS 8.5 score', () => {
  it('Σ urgency − 3 × missing − 0.05 × minutes; basics and optional extras are never missing', () => {
    const r = recipe({
      minutes: 20,
      ingredients: [
        ing('Spinach', 'spinach'),
        ing('Paneer', 'paneer'),
        ing('Onion', 'onion'),
        ing('Salt', 'salt', 'basic'),
        ing('Cilantro', 'cilantro', 'optional'),
      ],
    });
    const m = matchRecipe(r, [item('spinach', 0), item('paneer', 2)], [], TODAY);
    expect(m.have).toBe(2);
    expect(m.total).toBe(3);
    expect(m.missing.map((x) => x.ingredient.name)).toEqual(['Onion']);
    expect(scoreRecipe(m, prefs())).toBeCloseTo(10 + 6 - 3 - 1);
  });

  it('missing but claimed on a list costs 1; missing because it ran out costs 4', () => {
    const r = recipe({ ingredients: [ing('Onion', 'onion'), ing('Eggs', 'eggs')] });
    const claimed = matchRecipe(r, [], [entry('Onions', { claimedBy: 'u2' })], TODAY);
    expect(claimed.missing.find((x) => x.ingredient.name === 'Onion')!.state).toBe('claimed');
    const ranOut = matchRecipe(r, [item('eggs', 5, { status: 'out', outAt: TODAY })], [], TODAY);
    expect(ranOut.missing.find((x) => x.ingredient.name === 'Eggs')!.state).toBe('ran_out');
    expect(scoreRecipe(claimed, prefs())).toBeCloseTo(-1 - 3 - 1);
    expect(scoreRecipe(ranOut, prefs())).toBeCloseTo(-3 - 4 - 1);
  });

  it('spices and condiments the pantry never tracked are assumed on hand, like salt', () => {
    const r = recipe({
      ingredients: [ing('Spinach', 'spinach'), ing('Cumin', 'cumin'), ing('Soy sauce')],
    });
    const m = matchRecipe(r, [item('spinach', 0)], [], TODAY);
    expect(m.missing).toEqual([]);
    expect(m.assumed.map((i) => i.name)).toEqual(['Cumin', 'Soy sauce']);
    expect([m.have, m.total]).toEqual([1, 1]);
    // Tracked spices count as usual: in stock is used; ran out is missing (−4).
    const tracked = matchRecipe(
      r,
      [
        item('spinach', 0),
        item('cumin', 200),
        item('soy-sauce', 90, { status: 'out', outAt: TODAY }),
      ],
      [],
      TODAY,
    );
    expect(tracked.used.map((u) => u.ingredient.name)).toEqual(['Spinach', 'Cumin']);
    expect(tracked.missing).toEqual([
      expect.objectContaining({
        state: 'ran_out',
        ingredient: expect.objectContaining({ name: 'Soy sauce' }),
      }),
    ]);
  });

  it('uses the soonest-expiring matching item and skips expired ones', () => {
    const r = recipe({ ingredients: [ing('Milk', 'milk')] });
    const m = matchRecipe(r, [item('milk', 6), item('milk', 1), item('milk', -1)], [], TODAY);
    expect(m.used.map((u) => u.daysLeft)).toEqual([1]);
  });

  it('AI recipes match the pantry by ingredient name', () => {
    const r = recipe({
      source: 'ai',
      ingredients: [ing('Fresh spinach'), ing('Cherry tomatoes'), ing('Yuzu kosho')],
    });
    const m = matchRecipe(
      r,
      [item('spinach', 1), item('cherry-tomato', 3), item(null, 3, { name: 'Yuzu kosho' })],
      [],
      TODAY,
    );
    expect(m.used).toHaveLength(3);
  });
});

describe('SRS 8.5 ranking', () => {
  const pantry = [item('spinach', 0), item('paneer', 1), item('tortillas', 2)];
  const palak = recipe({
    title: 'Palak',
    diet: 'vegetarian',
    minutes: 30,
    ingredients: [ing('Spinach', 'spinach'), ing('Paneer', 'paneer')],
  });
  const quesadilla = recipe({
    title: 'Quesadillas',
    diet: 'vegetarian',
    minutes: 15,
    ingredients: [ing('Tortillas', 'tortillas'), ing('Cheddar', 'cheddar')],
  });
  const omelette = recipe({
    title: 'Omelette',
    diet: 'eggs',
    minutes: 10,
    ingredients: [ing('Eggs', 'eggs'), ing('Spinach', 'spinach')],
  });
  const recipes = [quesadilla, omelette, palak];

  it('ranks the recipe that saves the most expiring food first, with why parts', () => {
    const ranked = rankRecipes({ recipes, pantry, listItems: [], today: TODAY, prefs: prefs() });
    expect(ranked.map((r) => r.recipe.title)).toEqual(['Palak', 'Omelette', 'Quesadillas']);
    expect(ranked[0]!.why.slice(0, 2)).toEqual([
      { kind: 'saves', count: 2, names: ['Spinach', 'Paneer'], daysLeft: 0 },
      { kind: 'everything' },
    ]);
    expect(ranked[1]!.why).toContainEqual({ kind: 'fastest', minutes: 10 });
  });

  it('diet, avoid list and max time are hard filters; cuisine is soft', () => {
    const titles = (p: RecipePrefs) =>
      rankRecipes({ recipes, pantry, listItems: [], today: TODAY, prefs: p }).map(
        (r) => r.recipe.title,
      );
    expect(titles(prefs({ diet: 'vegetarian' }))).not.toContain('Omelette');
    expect(titles(prefs({ diet: 'eggs' }))).toContain('Omelette');
    expect(titles(prefs({ diet: 'vegan' }))).toEqual([]);
    expect(titles(prefs({ avoid: ['paneer'] }))).not.toContain('Palak');
    expect(titles(prefs({ maxMinutes: 20 }))).toEqual(['Omelette', 'Quesadillas']);
    const mexicanFirst = rankRecipes({
      recipes: [quesadilla, recipe({ title: 'Other', ingredients: [ing('Cheddar', 'cheddar')] })],
      pantry: [],
      listItems: [],
      today: TODAY,
      prefs: prefs({ cuisines: ['everyday'] }),
    });
    expect(mexicanFirst).toHaveLength(2);
  });

  it('SAV-3 readiness: ready, missing 1–2 things, or more', () => {
    const m = (p: PantryItem[]) => matchRecipe(palak, p, [], TODAY);
    expect(readiness(m(pantry))).toBe('ready');
    expect(readiness(m([item('spinach', 3)]))).toBe('almost');
  });
});

describe('local recipe set', () => {
  it('has about 60 recipes across six cuisines, each valid and with known foods', () => {
    expect(LOCAL_RECIPES.length).toBeGreaterThanOrEqual(60);
    expect(new Set(LOCAL_RECIPES.map((r) => r.cuisine)).size).toBe(6);
    expect(new Set(LOCAL_RECIPES.map((r) => r.id)).size).toBe(LOCAL_RECIPES.length);
    for (const r of LOCAL_RECIPES) expect(recipeSchema.safeParse(r).success, r.id).toBe(true);
    for (const r of LOCAL_RECIPES)
      for (const i of r.ingredients)
        if (i.foodId) expect(foodById(i.foodId), `${r.id}: ${i.foodId}`).toBeDefined();
  });

  it('ranks the full set against a real pantry without falling back to nothing', () => {
    const ranked = rankRecipes({
      recipes: LOCAL_RECIPES,
      pantry: [item('spinach', 0), item('paneer', 1), item('onion', 10), item('tomato', 3)],
      listItems: [],
      today: TODAY,
      prefs: prefs({ diet: 'vegetarian' }),
    });
    expect(ranked[0]!.recipe.id).toBe('palak-paneer-quick');
  });
});
