import {
  avoidedIn,
  daysLeft,
  dietAllows,
  foodById,
  foodByName,
  type IsoDate,
  type ListItem,
  type PantryItem,
  type Recipe,
  type RecipeIngredient,
  type RecipePrefs,
} from '@shelf-life/shared';

/** SRS 8.5 urgency weight of a pantry item a recipe uses, by days left. */
export function urgencyWeight(days: number): number {
  if (days <= 0) return 10;
  if (days === 1) return 7;
  if (days === 2) return 6;
  if (days === 3) return 5;
  if (days <= 7) return 3;
  return 0.5;
}

export const MISSING_PENALTY = 3;
/** Already on a list and someone claimed it: it's coming. */
export const MISSING_CLAIMED_PENALTY = 1;
/** It ran out: the household clearly needs a restock first. */
export const MISSING_RAN_OUT_PENALTY = 4;
export const MINUTE_PENALTY = 0.05;
/** Soft cuisine preference (REC-7: never a filter unless the user sets one). */
export const CUISINE_BONUS = 2;
/** "Saves" chips: things a recipe uses that expire within this many days. */
export const SAVES_WITHIN_DAYS = 7;

export type UsedItem = { ingredient: RecipeIngredient; item: PantryItem; daysLeft: number };

export type MissingIngredient = {
  ingredient: RecipeIngredient;
  /** `claimed`: on a list and someone's buying it; `ran_out`: the pantry's one ran out. */
  state: 'missing' | 'claimed' | 'on_list' | 'ran_out';
  listItem: ListItem | null;
};

/** Why a recipe ranks where it does; the app turns the top two into a sentence (SRS 8.5). */
export type WhyPart =
  | { kind: 'saves'; count: number; names: string[]; daysLeft: number }
  | { kind: 'everything' }
  | { kind: 'fastest'; minutes: number }
  | { kind: 'cuisine'; cuisine: string }
  | { kind: 'few_missing'; count: number };

export type RecipeMatch = {
  recipe: Recipe;
  used: UsedItem[];
  /** Used items expiring within a week, soonest first ("Saves" chips). */
  saves: UsedItem[];
  missing: MissingIngredient[];
  /** Spices and condiments this pantry has never tracked: assumed on hand, like salt. */
  assumed: RecipeIngredient[];
  /** "You have X of Y ingredients": required ones (not basics, optional extras or assumed). */
  have: number;
  total: number;
};

export type RankedRecipe = RecipeMatch & { score: number; why: WhyPart[] };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const singular = (s: string) => s.replace(/(?<=[a-z]{3})(es|s)$/, '');

/** The dictionary food an ingredient means: its own id, or a lookup by name for AI recipes. */
function ingredientFoodId(ing: RecipeIngredient): string | null {
  if (ing.foodId) return ing.foodId;
  const n = norm(ing.name.split(/,|\(/)[0]!);
  const words = n.split(' ');
  for (const candidate of [n, words.slice(-2).join(' '), words.at(-1) ?? '']) {
    const food = candidate ? foodByName(candidate) : undefined;
    if (food) return food.foodId;
  }
  return null;
}

function sameFood(ing: RecipeIngredient, foodId: string | null, item: PantryItem): boolean {
  if (foodId && item.foodId) return foodId === item.foodId;
  return singular(norm(ing.name)) === singular(norm(item.name));
}

const isRequired = (ing: RecipeIngredient) => !ing.basic && !ing.optional;

/** Spices and condiments (the dictionary's spices_oils category). */
const isSpiceOrCondiment = (foodId: string | null) =>
  !!foodId && foodById(foodId)?.category === 'spices_oils';

/**
 * Which pantry items a recipe would use, and which required ingredients are missing. Each
 * ingredient uses the matching item that expires soonest; expired items aren't used.
 */
export function matchRecipe(
  recipe: Recipe,
  pantry: readonly PantryItem[],
  listItems: readonly ListItem[],
  today: IsoDate,
): RecipeMatch {
  const active = pantry.filter((p) => p.status === 'active' && daysLeft(p, today) >= 0);
  const ranOut = pantry.filter((p) => p.status === 'out');
  const open = listItems.filter((l) => !l.checked);
  const used: UsedItem[] = [];
  const missing: MissingIngredient[] = [];
  const assumed: RecipeIngredient[] = [];
  const taken = new Set<string>();
  let have = 0;
  let total = 0;

  for (const ing of recipe.ingredients) {
    const foodId = ingredientFoodId(ing);
    // Most people never add their spices and condiments. One this pantry has never tracked is
    // assumed on hand; one it tracks counts as usual (so a spice that ran out is missing).
    if (
      isRequired(ing) &&
      isSpiceOrCondiment(foodId) &&
      !pantry.some((p) => (p.status === 'active' || p.status === 'out') && sameFood(ing, foodId, p))
    ) {
      assumed.push(ing);
      continue;
    }
    const match = active
      .filter((p) => !taken.has(p.id) && sameFood(ing, foodId, p))
      .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn))[0];
    if (isRequired(ing)) total++;
    if (match) {
      taken.add(match.id);
      used.push({ ingredient: ing, item: match, daysLeft: daysLeft(match, today) });
      if (isRequired(ing)) have++;
      continue;
    }
    if (!isRequired(ing)) continue;
    const listItem =
      open.find((l) => {
        const lf = foodByName(norm(l.name))?.foodId ?? null;
        return foodId && lf ? lf === foodId : singular(norm(l.name)) === singular(norm(ing.name));
      }) ?? null;
    const state = listItem
      ? listItem.claimedBy
        ? 'claimed'
        : 'on_list'
      : ranOut.some((p) => sameFood(ing, foodId, p))
        ? 'ran_out'
        : 'missing';
    missing.push({ ingredient: ing, state, listItem });
  }

  const saves = used
    .filter((u) => u.daysLeft <= SAVES_WITHIN_DAYS)
    .sort((a, b) => a.daysLeft - b.daysLeft || a.item.name.localeCompare(b.item.name));
  return { recipe, used, saves, missing, assumed, have, total };
}

const PENALTY: Record<MissingIngredient['state'], number> = {
  missing: MISSING_PENALTY,
  on_list: MISSING_PENALTY,
  claimed: MISSING_CLAIMED_PENALTY,
  ran_out: MISSING_RAN_OUT_PENALTY,
};

/** SRS 8.5 hard filters: diet, avoid list, max time. */
export function passesFilters(recipe: Recipe, prefs: RecipePrefs): boolean {
  if (!dietAllows(prefs.diet, recipe.diet)) return false;
  if (prefs.maxMinutes !== null && recipe.minutes > prefs.maxMinutes) return false;
  return avoidedIn(recipe, prefs.avoid).length === 0;
}

const prefersCuisine = (recipe: Recipe, prefs: RecipePrefs) =>
  prefs.cuisines.some((c) => norm(c) === norm(recipe.cuisine));

/** SRS 8.5 score: Σ urgency of used items − missing penalties − 0.05 × minutes + bonuses. */
export function scoreRecipe(m: RecipeMatch, prefs: RecipePrefs): number {
  const urgency = m.used.reduce((sum, u) => sum + urgencyWeight(u.daysLeft), 0);
  const missing = m.missing.reduce((sum, x) => sum + PENALTY[x.state], 0);
  const bonus = prefersCuisine(m.recipe, prefs) ? CUISINE_BONUS : 0;
  return urgency - missing - MINUTE_PENALTY * m.recipe.minutes + bonus;
}

export type RankInput = {
  recipes: readonly Recipe[];
  pantry: readonly PantryItem[];
  listItems: readonly ListItem[];
  today: IsoDate;
  prefs: RecipePrefs;
};

/**
 * SRS 8.5: filter, score and rank recipes (from AI or the local set). Each result carries its
 * top contributors ("why"), most important first; the app shows the top two for #1.
 */
export function rankRecipes(input: RankInput): RankedRecipe[] {
  const { prefs } = input;
  const matched = input.recipes
    .filter((r) => passesFilters(r, prefs))
    .map((r) => matchRecipe(r, input.pantry, input.listItems, input.today));
  const fastest = Math.min(...matched.map((m) => m.recipe.minutes));
  return matched
    .map((m) => ({ ...m, score: scoreRecipe(m, prefs), why: whyParts(m, prefs, fastest) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.recipe.minutes - b.recipe.minutes ||
        a.recipe.title.localeCompare(b.recipe.title),
    );
}

/** Contributors in order of weight: what it saves, then completeness, speed and cuisine. */
function whyParts(m: RecipeMatch, prefs: RecipePrefs, fastest: number): WhyPart[] {
  const parts: { part: WhyPart; weight: number }[] = [];
  if (m.saves.length > 0)
    parts.push({
      part: {
        kind: 'saves',
        count: m.saves.length,
        names: m.saves.map((u) => u.item.name),
        daysLeft: m.saves[0]!.daysLeft,
      },
      weight: m.saves.reduce((s, u) => s + urgencyWeight(u.daysLeft), 0),
    });
  if (m.missing.length === 0) parts.push({ part: { kind: 'everything' }, weight: MISSING_PENALTY });
  else if (m.missing.length <= 2)
    parts.push({ part: { kind: 'few_missing', count: m.missing.length }, weight: 1 });
  if (m.recipe.minutes === fastest)
    parts.push({ part: { kind: 'fastest', minutes: m.recipe.minutes }, weight: 2 });
  if (prefersCuisine(m.recipe, prefs))
    parts.push({ part: { kind: 'cuisine', cuisine: m.recipe.cuisine }, weight: CUISINE_BONUS });
  return parts.sort((a, b) => b.weight - a.weight).map((p) => p.part);
}

/** SAV-3: how ready a saved recipe is with what's in the pantry now. */
export type Readiness = 'ready' | 'almost' | 'needs_more';

export function readiness(m: RecipeMatch): Readiness {
  if (m.missing.length === 0) return 'ready';
  return m.missing.length <= 2 ? 'almost' : 'needs_more';
}
