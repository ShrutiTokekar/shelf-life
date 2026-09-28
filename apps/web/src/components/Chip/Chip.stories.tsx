import type { Category } from '@shelf-life/shared';
import { useState } from 'react';
import { CategoryChips } from '../CategoryChips/CategoryChips';
import { ListFilterChips } from '../ListFilterChips/ListFilterChips';
import { SearchField } from '../SearchField/SearchField';
import { SegmentedControl } from '../SegmentedControl/SegmentedControl';
import { StatusTag } from '../StatusTag/StatusTag';

export const PantryControls = () => {
  const [list, setList] = useState<string | null>(null);
  const [cat, setCat] = useState<Category | null>(null);
  const [sort, setSort] = useState<'expiry' | 'category' | 'location' | 'az'>('expiry');
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <SearchField
        label="Search pantry"
        placeholder="e.g. yogurt"
        clearLabel="Clear search"
        onSearch={() => undefined}
      />
      <ListFilterChips
        lists={[
          { id: 'a', name: 'Apartment 4B', color: 'navy' },
          { id: 'f', name: 'Family groceries', color: 'olive' },
          { id: 'd', name: 'Diwali party', color: 'amber' },
        ]}
        value={list}
        onChange={setList}
        counts={{ all: 42, a: 30, f: 6, d: 4 }}
      />
      <SegmentedControl
        label="Sort"
        value={sort}
        onChange={setSort}
        options={[
          { value: 'expiry', label: 'Expiry' },
          { value: 'category', label: 'Category' },
          { value: 'location', label: 'Location' },
          { value: 'az', label: 'A to Z' },
        ]}
      />
      <CategoryChips
        value={cat}
        onChange={setCat}
        counts={{
          all: 42,
          produce: 9,
          dairy_eggs: 6,
          grains_dals: 8,
          spices_oils: 10,
          frozen: 6,
          other: 3,
        }}
      />
      <div className="flex flex-wrap gap-2">
        <StatusTag status="today" text="Expires today" />
        <StatusTag status="soon" text="2 days left" />
        <StatusTag status="fresh" text="3 weeks" />
        <StatusTag status="out" text="Ran out today" />
        <StatusTag status="ai" text="AI, confirmed" />
        <StatusTag status="skipped" text="Skipped, not food" />
      </div>
    </div>
  );
};
