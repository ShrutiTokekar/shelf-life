import { addDays, type IsoDate } from '../dates';
import type { Category, Location } from './types';

/**
 * Default shelf life in days by category × location (SRS 8.3 fallback, approved for Milestone 2).
 * The food dictionary (Milestone 3) and AI estimates replace these per item; a user-set date wins.
 */
export const DEFAULT_SHELF_LIFE_DAYS: Record<Category, Record<Location, number>> = {
  produce: { fridge: 7, freezer: 240, cupboard: 5 },
  dairy_eggs: { fridge: 10, freezer: 90, cupboard: 3 },
  grains_dals: { fridge: 30, freezer: 180, cupboard: 180 },
  spices_oils: { fridge: 180, freezer: 365, cupboard: 365 },
  frozen: { fridge: 3, freezer: 240, cupboard: 2 },
  other: { fridge: 7, freezer: 7, cupboard: 7 },
};

/** `expiresOn = purchaseDate + shelfLife(category, location)` (SRS 8.3). */
export function estimateExpiry(
  category: Category,
  location: Location,
  purchasedOn: IsoDate,
): IsoDate {
  return addDays(purchasedOn, DEFAULT_SHELF_LIFE_DAYS[category][location]);
}

/** Where new items of a category usually go. */
export const DEFAULT_LOCATION: Record<Category, Location> = {
  produce: 'fridge',
  dairy_eggs: 'fridge',
  grains_dals: 'cupboard',
  spices_oils: 'cupboard',
  frozen: 'freezer',
  other: 'cupboard',
};
