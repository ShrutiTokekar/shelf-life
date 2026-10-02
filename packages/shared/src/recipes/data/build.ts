import type { RecipeIngredient, RecipeStep } from '../types';

/** Ingredient shorthand: `i('Spinach', 'spinach', 300, 'g')`. */
export function i(
  name: string,
  foodId: string | null,
  amount: number | null = null,
  unit: string | null = null,
  flag?: 'basic' | 'optional',
): RecipeIngredient {
  return {
    name,
    ...(foodId ? { foodId } : {}),
    amount,
    unit,
    ...(flag === 'basic' ? { basic: true as const } : {}),
    ...(flag === 'optional' ? { optional: true as const } : {}),
  };
}

/** Kitchen basics every recipe may assume: never "missing". */
export const SALT = i('Salt', 'salt', null, null, 'basic');
export const OIL = (amount = 1, unit = 'tbsp') => i('Oil', 'vegetable-oil', amount, unit, 'basic');
export const OLIVE_OIL = (amount = 2, unit = 'tbsp') =>
  i('Olive oil', 'olive-oil', amount, unit, 'basic');
export const PEPPER = i('Black pepper', 'black-pepper', null, null, 'basic');
export const WATER = (amount: number | null = null, unit: string | null = null) =>
  i('Water', null, amount, unit, 'basic');

/** Step shorthand: `s('Simmer', 'Simmer for 5 minutes.', 300)`. */
export function s(title: string, text: string, timerSeconds?: number): RecipeStep {
  return { title, text, ...(timerSeconds ? { timerSeconds } : {}) };
}
