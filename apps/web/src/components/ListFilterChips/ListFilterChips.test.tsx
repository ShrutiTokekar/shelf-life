import type { Category } from '@shelf-life/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { CategoryChips } from '../CategoryChips/CategoryChips';
import { ListFilterChips } from './ListFilterChips';

const lists = [
  { id: 'home', name: 'Apartment 4B', color: 'navy' as const },
  { id: 'diwali', name: 'Diwali party', color: 'amber' as const },
];

function Lists() {
  const [v, setV] = useState<string | null>(null);
  return (
    <ListFilterChips
      lists={lists}
      value={v}
      onChange={setV}
      counts={{ all: 34, home: 30, diwali: 4 }}
    />
  );
}

describe('ListFilterChips', () => {
  it('PAN-3 "All lists" first, then each list with its count; single-select', async () => {
    render(<Lists />);
    const group = screen.getByRole('group', { name: 'From list' });
    const chips = [...group.querySelectorAll('button')];
    expect(chips.map((c) => c.textContent)).toEqual([
      'All lists 34',
      'Apartment 4B 30',
      'Diwali party 4',
    ]);
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: /Diwali party/ }));
    expect(screen.getByRole('button', { name: /Diwali party/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /All lists/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    // Tapping the selected list again goes back to All lists.
    await userEvent.click(screen.getByRole('button', { name: /Diwali party/ }));
    expect(screen.getByRole('button', { name: /All lists/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('has no serious axe violations', async () => {
    const { container } = render(<Lists />);
    expect(await seriousViolations(container)).toEqual([]);
  });
});

describe('CategoryChips', () => {
  it('PAN-4 shows All plus six categories with icons and counts', async () => {
    function Harness() {
      const [v, setV] = useState<Category | null>(null);
      return (
        <CategoryChips
          value={v}
          onChange={setV}
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
      );
    }
    const { container } = render(<Harness />);
    const names = [
      ...screen.getByRole('group', { name: 'Category' }).querySelectorAll('button'),
    ].map((b) => b.textContent);
    expect(names).toEqual([
      'All 42',
      'Produce 9',
      'Dairy & eggs 6',
      'Grains & dals 8',
      'Spices & oils 10',
      'Frozen 6',
      'Other 3',
    ]);
    expect(container.querySelectorAll('button svg')).toHaveLength(7);
    await userEvent.click(screen.getByRole('button', { name: /Frozen/ }));
    expect(screen.getByRole('button', { name: /Frozen/ })).toHaveAttribute('aria-pressed', 'true');
    expect(await seriousViolations(container)).toEqual([]);
  });
});
