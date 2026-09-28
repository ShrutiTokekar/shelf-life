import { addDays, todayIso, type PantryItem } from '@shelf-life/shared';
import { JarCard } from './JarCard';

const today = todayIso();
const base: PantryItem = {
  id: 'x',
  pantryId: 'p',
  listId: 'l',
  foodId: null,
  name: 'Spinach',
  category: 'produce',
  location: 'fridge',
  quantity: 1,
  unit: 'bag',
  note: '',
  purchasedOn: today,
  expiresOn: today,
  expiryIsEstimate: false,
  expirySource: 'user',
  status: 'active',
  outAt: null,
  addedBy: 'u',
  receiptLineId: null,
  updatedAt: '',
};
const noop = () => undefined;
const common = {
  today,
  list: { name: 'Apartment 4B', color: 'navy' as const },
  addedBy: { name: 'Shruti', initial: 'S', tone: 'periwinkle' as const },
  onUsed: noop,
  onEdit: noop,
  onAddToList: noop,
};

export const AllStates = () => (
  <ul className="flex flex-wrap items-end gap-3">
    <JarCard {...common} item={base} status="today" />
    <JarCard
      {...common}
      item={{ ...base, name: 'Cilantro', unit: 'bunch', expiresOn: addDays(today, 2) }}
      status="soon"
    />
    <JarCard
      {...common}
      item={{
        ...base,
        name: 'Rice',
        quantity: 5,
        unit: 'lb',
        location: 'cupboard',
        expiresOn: addDays(today, 95),
      }}
      status="fresh"
      list={{ name: 'Family groceries', color: 'olive' }}
    />
    <JarCard
      {...common}
      item={{ ...base, name: 'Eggs', quantity: 0, status: 'out', outAt: today }}
      status="out"
    />
    <JarCard
      {...common}
      item={{
        ...base,
        name: 'Onions',
        quantity: 0,
        status: 'out',
        outAt: addDays(today, -2),
        location: 'cupboard',
      }}
      status="out"
      onList={{ claimedBy: 'Arjun' }}
    />
  </ul>
);
