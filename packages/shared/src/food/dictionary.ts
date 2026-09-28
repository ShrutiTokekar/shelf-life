import { addDays, type IsoDate } from '../dates';
import { DEFAULT_SHELF_LIFE_DAYS } from '../pantry/expiry';
import type { Category, ExpirySource, Location } from '../pantry/types';
import { DAIRY } from './data/dairy';
import { GRAINS } from './data/grains';
import { FROZEN, OTHER } from './data/other';
import { PRODUCE } from './data/produce';
import { SPICES } from './data/spices';
import type { Food, FoodRow } from './types';

/**
 * Food dictionary (SRS 8.2, 8.3, 10). Shelf-life figures come from USDA FoodKeeper data v128
 * (public domain, https://www.fsis.usda.gov/shared/data/EN/foodkeeper.json, retrieved 2026-09-28):
 * the minimum of each range, "from date of purchase" values preferred, weeks = 7 days,
 * months = 30, years = 365. SRS 8.3 figures override where the SRS names a value. Foods FoodKeeper
 * doesn't cover (paneer, atta, curry leaves…) are marked `curated`.
 */
function build(category: Category, rows: FoodRow[]): Food[] {
  return rows.map(
    ([foodId, name, aliases, defaultLocation, [pantry, fridge, freezer], source, staple]) => ({
      foodId,
      name,
      names: [
        ...new Set(
          [name, ...aliases.split(',')].map((n) => n.trim().toLowerCase()).filter(Boolean),
        ),
      ],
      category,
      defaultLocation,
      shelfLifeDays: { cupboard: pantry, fridge, freezer },
      isStaple: staple === 1,
      source,
    }),
  );
}

export const FOODS: readonly Food[] = [
  ...build('produce', PRODUCE),
  ...build('dairy_eggs', DAIRY),
  ...build('grains_dals', GRAINS),
  ...build('spices_oils', SPICES),
  ...build('frozen', FROZEN),
  ...build('other', OTHER),
];

const byId = new Map(FOODS.map((f) => [f.foodId, f]));

export function foodById(foodId: string): Food | undefined {
  return byId.get(foodId);
}

/** Exact (case-insensitive) name or alias lookup. Fuzzy matching lives in scan/match.ts. */
const byName = new Map<string, Food>();
for (const food of FOODS) for (const n of food.names) if (!byName.has(n)) byName.set(n, food);

export function foodByName(name: string): Food | undefined {
  return byName.get(name.trim().toLowerCase());
}

/**
 * Days this food keeps in `location`: the dictionary value, or the category default when the
 * dictionary has none for that location (e.g. milk in the cupboard). Some foods never expire in
 * practice (salt, sugar, water); they get a year so they still sort sensibly.
 */
export function shelfLifeFor(
  food: Food,
  location: Location,
): { days: number; source: ExpirySource } {
  const days = food.shelfLifeDays[location];
  if (days !== null) return { days, source: 'dictionary' };
  const known = Object.values(food.shelfLifeDays).every((d) => d === null);
  if (known) return { days: 365, source: 'dictionary' };
  return { days: DEFAULT_SHELF_LIFE_DAYS[food.category][location], source: 'category_default' };
}

/** SRS 8.3: expiresOn = purchase date + shelf life for this food and location. */
export function estimateFoodExpiry(
  food: Food,
  location: Location,
  purchasedOn: IsoDate,
): { expiresOn: IsoDate; source: ExpirySource } {
  const { days, source } = shelfLifeFor(food, location);
  return { expiresOn: addDays(purchasedOn, days), source };
}
