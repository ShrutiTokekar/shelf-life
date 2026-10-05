import type { RecipeIngredient } from './types';

/** Units measured with spoons and cups: rounded to kitchen fractions (SRS 8.10). */
const SPOON_CUP = new Set(['tsp', 'tbsp', 'cup', 'cups']);
/** Weights and liquids: rounded to sensible steps, never fractions. */
const METRIC = new Set(['g', 'kg', 'ml', 'l']);

/** ml per unit, for showing the other system next to a volume (RCP-3 "metric and cups"). */
const ML: Record<string, number> = { tsp: 5, tbsp: 15, cup: 240, cups: 240, ml: 1, l: 1000 };

const FRACTIONS: [number, string][] = [
  [0, ''],
  [0.25, '¼'],
  [1 / 3, '⅓'],
  [0.5, '½'],
  [2 / 3, '⅔'],
  [0.75, '¾'],
  [1, ''],
];

function nearestFraction(x: number): number {
  const whole = Math.floor(x);
  const frac = x - whole;
  let best = FRACTIONS[0]!;
  for (const f of FRACTIONS) if (Math.abs(f[0] - frac) < Math.abs(best[0] - frac)) best = f;
  return whole + best[0];
}

function roundMetric(x: number): number {
  if (x >= 100) return Math.round(x / 10) * 10;
  if (x >= 20) return Math.round(x / 5) * 5;
  return Math.max(1, Math.round(x));
}

/**
 * SRS 8.10: scale an amount by `factor` and round to a kitchen-friendly value: ¼, ⅓, ½ … for
 * spoons and cups; tens or fives of grams and millilitres; whole items (eggs, tortillas,
 * cloves) for counts, never below one; anything else to the nearest quarter.
 */
export function scaleAmount(
  amount: number | null,
  unit: string | null,
  factor: number,
): number | null {
  if (amount === null) return null;
  const x = amount * factor;
  if (factor === 1) return amount;
  const u = (unit ?? '').trim().toLowerCase();
  if (SPOON_CUP.has(u)) return Math.max(0.25, nearestFraction(x));
  if (METRIC.has(u)) return u === 'kg' || u === 'l' ? Math.round(x * 4) / 4 : roundMetric(x);
  if (u === '' || u === 'cloves' || u === 'clove' || u === 'slices' || u === 'can' || u === 'cans')
    return Math.max(amount < 1 ? 0.5 : 1, amount < 1 ? nearestFraction(x) : Math.round(x));
  return Math.max(0.25, Math.round(x * 4) / 4);
}

/** "1½", "⅓", "250", "0.25" → "¼". */
export function formatAmount(x: number): string {
  const whole = Math.floor(x + 1e-9);
  const frac = x - whole;
  const f = FRACTIONS.find(([v]) => Math.abs(v - frac) < 0.02 && v > 0 && v < 1);
  if (f) return whole > 0 ? `${whole}${f[1]}` : f[1];
  return Number.isInteger(x) ? String(x) : String(Math.round(x * 100) / 100);
}

/** "1 cup (240 ml)", "250 ml (1 cup)": the other system for volumes, else null. */
export function otherSystem(amount: number | null, unit: string | null): string | null {
  if (amount === null || !unit) return null;
  const u = unit.trim().toLowerCase();
  const ml = ML[u];
  if (ml === undefined) return null;
  const total = amount * ml;
  if (u === 'ml' || u === 'l') {
    if (total < 15) return `${formatAmount(nearestFraction(total / 5))} tsp`;
    if (total < 60) return `${formatAmount(nearestFraction(total / 15))} tbsp`;
    const cups = nearestFraction(total / 240);
    return `${formatAmount(cups)} ${cups > 1 ? 'cups' : 'cup'}`;
  }
  return `${roundMetric(total)} ml`;
}

/** Every ingredient scaled from the recipe's servings to `servings`. */
export function scaleIngredients(
  ingredients: readonly RecipeIngredient[],
  from: number,
  to: number,
): RecipeIngredient[] {
  const factor = to / from;
  return ingredients.map((i) => ({ ...i, amount: scaleAmount(i.amount, i.unit, factor) }));
}
