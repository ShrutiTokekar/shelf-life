import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  estimateFoodExpiry,
  foodById,
  foodByName,
  FOODS,
  LOCATIONS,
  shelfLifeFor,
} from '../src';

describe('food dictionary (SRS 8.2, 8.3, 10)', () => {
  it('has unique ids and no alias shared by two foods', () => {
    expect(new Set(FOODS.map((f) => f.foodId)).size).toBe(FOODS.length);
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const f of FOODS) {
      for (const n of f.names) {
        const prev = owner.get(n);
        if (prev && prev !== f.foodId) clashes.push(`${n}: ${prev} / ${f.foodId}`);
        owner.set(n, f.foodId);
      }
    }
    expect(clashes).toEqual([]);
  });

  it('covers every category and uses valid locations', () => {
    expect(new Set(FOODS.map((f) => f.category))).toEqual(new Set(CATEGORIES));
    for (const f of FOODS) expect(LOCATIONS).toContain(f.defaultLocation);
  });

  it('includes South Asian staples named in SRS 8.2', () => {
    for (const name of ['atta', 'toor dal', 'paneer', 'ghee', 'curry leaves'])
      expect(foodByName(name)).toBeDefined();
  });

  it('every entry cites its source', () => {
    for (const f of FOODS) expect(f.source).toMatch(/fk:\d|srs:\d|curated/);
  });

  it('every food keeps somewhere it has a shelf life, including its default location', () => {
    const missing = FOODS.filter(
      (f) =>
        f.shelfLifeDays[f.defaultLocation] === null &&
        Object.values(f.shelfLifeDays).some((d) => d !== null),
    );
    expect(missing.map((f) => f.foodId)).toEqual([]);
  });

  it.each([
    ['spinach', 'fridge', 5],
    ['cilantro', 'fridge', 7],
    ['yogurt', 'fridge', 14],
    ['milk', 'fridge', 7],
    ['eggs', 'fridge', 21],
    ['paneer', 'fridge', 7],
    ['toor-dal', 'cupboard', 365],
    ['flour', 'cupboard', 180],
    ['frozen-vegetables', 'freezer', 240],
  ] as const)('SRS 8.3 example: %s in the %s keeps %i days', (id, location, days) => {
    expect(shelfLifeFor(foodById(id)!, location)).toEqual({ days, source: 'dictionary' });
  });

  it('falls back to the category default where the dictionary has no value', () => {
    expect(shelfLifeFor(foodById('milk')!, 'cupboard')).toEqual({
      days: 3,
      source: 'category_default',
    });
  });

  it('things that keep indefinitely (salt) get a year', () => {
    expect(shelfLifeFor(foodById('salt')!, 'cupboard').days).toBe(365);
  });

  it('estimateFoodExpiry adds the shelf life to the purchase date', () => {
    expect(estimateFoodExpiry(foodById('paneer')!, 'fridge', '2026-09-27')).toEqual({
      expiresOn: '2026-10-04',
      source: 'dictionary',
    });
  });
});
