import type { IsoDate } from '../dates';
import type { RecipeIngredient } from '../recipes/types';
import { withQuantity } from './reminders';
import type { UsedItResult } from './usedIt';
import type { PantryItem } from './types';

const UNIT_ALIASES: Record<string, string> = {
  '': '',
  pc: '',
  pcs: '',
  piece: '',
  pieces: '',
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
  cup: 'cup',
  cups: 'cup',
  tbsp: 'tbsp',
  tsp: 'tsp',
  can: 'can',
  cans: 'can',
  clove: 'clove',
  cloves: 'clove',
  slice: 'slice',
  slices: 'slice',
};

const unitKey = (u: string | null) => {
  const k = (u ?? '').trim().toLowerCase();
  return k in UNIT_ALIASES ? UNIT_ALIASES[k]! : null;
};

/**
 * RCP-10: how much of a pantry item a recipe uses, when the units line up (4 eggs from 6, 150 g
 * from 400 g). null when they don't ("1 bag" of spinach vs "300 g"): then the person says.
 */
export function suggestedUse(
  item: Pick<PantryItem, 'quantity' | 'unit'>,
  ingredient: Pick<RecipeIngredient, 'amount' | 'unit'>,
): { use: number; left: number } | null {
  if (item.quantity === null || ingredient.amount === null) return null;
  const a = unitKey(item.unit);
  const b = unitKey(ingredient.unit);
  if (a === null || b === null || a !== b) return null;
  const left = Math.max(0, Math.round((item.quantity - ingredient.amount) * 100) / 100);
  return { use: ingredient.amount, left };
}

/** "Used it all" finishes the item; "Some left" keeps it, with `left` when known (SRS 8.10). */
export type CookedChoice = { kind: 'all' } | { kind: 'some'; left: number | null };

/**
 * SRS 8.10 "I made this" for one pantry item. Finishing it runs it out (SRS 8.6); "some left"
 * with a known amount updates the quantity (0 left also runs it out); unknown leaves it as is.
 */
export function applyCooked(
  item: Pick<PantryItem, 'quantity' | 'startQuantity' | 'lowAt'>,
  choice: CookedChoice,
  today: IsoDate,
): UsedItResult | null {
  if (choice.kind === 'all' || choice.left === 0)
    return { patch: { quantity: 0, status: 'out', outAt: today }, ranOut: true };
  if (choice.left === null || choice.left === item.quantity) return null;
  // SRS 8.6: remember the starting amount, for "running low".
  return {
    patch: { ...withQuantity(item, choice.left), status: 'active', outAt: null },
    ranOut: false,
  };
}
