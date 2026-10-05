import { localRecipe } from '@shelf-life/shared/recipes';
import { describe, expect, it } from 'vitest';
import { applySwaps } from './useSessionRecipe';

describe('RCP-4 applySwaps', () => {
  it('replaces the ingredient by name, keeps its amount, and drops the old food id', () => {
    const r = localRecipe('black-bean-quesadillas')!;
    const out = applySwaps(r, [{ from: 'Cheddar', to: 'Paneer', amount: '100 g' }]);
    const cheese = out.ingredients.find((i) => i.name === 'Paneer')!;
    expect(cheese).toMatchObject({ amount: 100, unit: 'g' });
    expect(cheese.foodId).toBeUndefined();
    expect(out.ingredients.some((i) => i.name.startsWith('Cheddar'))).toBe(false);
    expect(applySwaps(r, [])).toBe(r);
  });
});
