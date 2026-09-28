import type { Category, Location } from '../pantry/types';

/** Shelf life in days for [pantry/cupboard, fridge, freezer]; null = not listed or not advised. */
export type ShelfLifeRow = [pantry: number | null, fridge: number | null, freezer: number | null];

/**
 * One dictionary row, as written in `data/*.ts`:
 * [id, display name, comma-separated aliases, default location, shelf life, source, staple?].
 * `source` cites USDA FoodKeeper product IDs (`fk:…`), SRS 8.3 figures (`srs:…`) or `curated`.
 */
export type FoodRow = [
  id: string,
  name: string,
  aliases: string,
  defaultLocation: Location,
  shelfLife: ShelfLifeRow,
  source: string,
  staple?: 1,
];

/** SRS 10 FoodDictionary entry. */
export type Food = {
  foodId: string;
  name: string;
  /** Lowercase name + aliases (receipt spellings, brands, Hindi names). */
  names: string[];
  category: Category;
  defaultLocation: Location;
  shelfLifeDays: Record<Location, number | null>;
  /** Staples auto-suggest on the list when they run out (SRS 8.6). */
  isStaple: boolean;
  source: string;
};
