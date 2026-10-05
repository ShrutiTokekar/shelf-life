import { describe, expect, it } from 'vitest';
import {
  applyCooked,
  formatAmount,
  otherSystem,
  scaleAmount,
  scaleIngredients,
  suggestedUse,
} from '../src';

describe('SRS 8.10 servings scaling', () => {
  it.each([
    // [amount, unit, factor, expected]
    [1, 'tsp', 0.5, 0.5],
    [1, 'tsp', 1 / 3, 1 / 3],
    [0.5, 'tsp', 0.5, 0.25],
    [1, 'cup', 1.5, 1.5],
    [0.75, 'cup', 2, 1.5],
    [300, 'g', 2 / 3, 200],
    [150, 'g', 1.5, 230],
    [30, 'g', 1.5, 45],
    [4, null, 1.5, 6],
    [1, null, 0.5, 1],
    [3, 'cloves', 2 / 3, 2],
    [0.5, null, 2, 1],
    [1, 'inch', 1.5, 1.5],
    [null, null, 2, null],
  ])('%s %s × %d → %s', (amount, unit, factor, expected) => {
    const got = scaleAmount(amount, unit, factor);
    if (expected === null) expect(got).toBeNull();
    else expect(got).toBeCloseTo(expected, 5);
  });

  it('formats kitchen fractions', () => {
    expect([0.25, 1 / 3, 0.5, 1.5, 2, 2.75, 250].map(formatAmount)).toEqual([
      '¼',
      '⅓',
      '½',
      '1½',
      '2',
      '2¾',
      '250',
    ]);
  });

  it('RCP-3 shows the other system for volumes only', () => {
    expect(otherSystem(1, 'cup')).toBe('240 ml');
    expect(otherSystem(2, 'tbsp')).toBe('30 ml');
    expect(otherSystem(250, 'ml')).toBe('1 cup');
    expect(otherSystem(500, 'ml')).toBe('2 cups');
    expect(otherSystem(300, 'g')).toBeNull();
    expect(otherSystem(null, 'cup')).toBeNull();
  });

  it('scales a whole ingredient list', () => {
    const out = scaleIngredients(
      [
        { name: 'Eggs', amount: 4, unit: null },
        { name: 'Salt', amount: null, unit: null, basic: true },
      ],
      2,
      4,
    );
    expect(out.map((i) => i.amount)).toEqual([8, null]);
  });
});

describe('RCP-10 I made this', () => {
  it('suggests what is left when units match, else asks', () => {
    expect(suggestedUse({ quantity: 6, unit: '' }, { amount: 4, unit: null })).toEqual({
      use: 4,
      left: 2,
    });
    expect(suggestedUse({ quantity: 400, unit: 'g' }, { amount: 150, unit: 'grams' })).toEqual({
      use: 150,
      left: 250,
    });
    expect(suggestedUse({ quantity: 1, unit: 'bag' }, { amount: 300, unit: 'g' })).toBeNull();
    expect(suggestedUse({ quantity: null, unit: 'g' }, { amount: 300, unit: 'g' })).toBeNull();
  });

  it('"Used it all" or 0 left runs it out; some left updates the quantity; unknown leaves it', () => {
    const today = '2026-10-01';
    expect(applyCooked({ quantity: 6 }, { kind: 'all' }, today)?.ranOut).toBe(true);
    expect(applyCooked({ quantity: 6 }, { kind: 'some', left: 0 }, today)?.ranOut).toBe(true);
    expect(applyCooked({ quantity: 6 }, { kind: 'some', left: 2 }, today)).toEqual({
      // SRS 8.6: remembers there were 6, for running low.
      patch: { quantity: 2, status: 'active', outAt: null, startQuantity: 6, lowAt: null },
      ranOut: false,
    });
    expect(applyCooked({ quantity: 1 }, { kind: 'some', left: null }, today)).toBeNull();
  });
});
