import type { IsoDate } from '../dates';
import type { PantryItem } from './types';

/**
 * Units counted one at a time. "Used it" on these counts down by one; anything weighed or
 * measured (g, kg, lb, ml, l, gal, cups…) is finished in one tap. An empty unit is a plain count
 * ("6 tomatoes").
 */
const COUNTABLE_UNITS = new Set([
  '',
  'pc',
  'pcs',
  'piece',
  'pieces',
  'bag',
  'bags',
  'bunch',
  'bunches',
  'pack',
  'packs',
  'packet',
  'packets',
  'can',
  'cans',
  'bottle',
  'bottles',
  'jar',
  'jars',
  'box',
  'boxes',
  'loaf',
  'loaves',
  'head',
  'heads',
  'block',
  'blocks',
  'tub',
  'tubs',
  'carton',
  'cartons',
]);

export function isCountable(item: Pick<PantryItem, 'quantity' | 'unit'>): boolean {
  return (
    item.quantity !== null &&
    Number.isInteger(item.quantity) &&
    COUNTABLE_UNITS.has(item.unit.trim().toLowerCase())
  );
}

export type UsedItResult = {
  /** Fields to write back to the item. */
  patch: Pick<PantryItem, 'quantity' | 'status' | 'outAt'>;
  /** true when this tap finished the item, so it moves to Ran out (SRS 8.6). */
  ranOut: boolean;
};

/**
 * PAN-8 "Used it" (approved behavior): countable items count down one per tap and run out at 0;
 * weighed or measured items are finished in one tap. Either way the last tap marks the item out.
 */
export function applyUsedIt(
  item: Pick<PantryItem, 'quantity' | 'unit'>,
  today: IsoDate,
): UsedItResult {
  if (isCountable(item) && item.quantity! > 1) {
    return {
      patch: { quantity: item.quantity! - 1, status: 'active', outAt: null },
      ranOut: false,
    };
  }
  return { patch: { quantity: 0, status: 'out', outAt: today }, ranOut: true };
}
