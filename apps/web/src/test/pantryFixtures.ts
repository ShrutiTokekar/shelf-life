import { addDays, type PantryItem } from '@shelf-life/shared';

export const TODAY = '2026-09-28';

let n = 0;
export function pantryItem(over: Partial<PantryItem> = {}): PantryItem {
  n++;
  return {
    id: `item-${n}`,
    pantryId: '0192f0c0-0000-7000-8000-000000000001',
    listId: '0192f0c0-0000-7000-8000-000000000002',
    foodId: null,
    name: `Item ${n}`,
    category: 'produce',
    location: 'fridge',
    quantity: 1,
    unit: 'bag',
    note: '',
    purchasedOn: addDays(TODAY, -3),
    expiresOn: addDays(TODAY, 10),
    expiryIsEstimate: false,
    expirySource: 'user',
    status: 'active',
    outAt: null,
    addedBy: 'u1',
    receiptLineId: null,
    updatedAt: '2026-09-28T00:00:00.000Z',
    ...over,
  };
}
