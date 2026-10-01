import { addDays } from '@shelf-life/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { pantryItem, TODAY } from '../../test/pantryFixtures';
import { renderWithRouter } from '../../test/render';
import { ShelfLegend, ShelfTimeline } from './ShelfTimeline';

describe('ShelfTimeline (TOD-6, TOD-7)', () => {
  const items = [
    pantryItem({ name: 'Spinach', expiresOn: TODAY }),
    pantryItem({ name: 'Cilantro', expiresOn: addDays(TODAY, 2) }),
    pantryItem({ name: 'Yogurt', expiresOn: addDays(TODAY, 2) }),
    pantryItem({ name: 'Paneer', expiresOn: addDays(TODAY, 2) }),
    pantryItem({ name: 'Rice', expiresOn: addDays(TODAY, 95) }),
  ];

  it('puts chips in their columns, caps each at two with "+N more", and opens items', async () => {
    const onOpen = vi.fn();
    const { container } = renderWithRouter(
      <>
        <ShelfTimeline items={items} today={TODAY} onOpen={onOpen} />
        <ShelfLegend />
      </>,
    );
    const todayCol = screen.getByRole('list', { name: 'Today' });
    expect(within(todayCol).getByRole('button', { name: 'Spinach today' })).toBeInTheDocument();
    const in2 = screen.getByRole('list', { name: '2 days' });
    expect(within(in2).getAllByRole('button')).toHaveLength(2);
    expect(within(in2).getByRole('link', { name: '+ 1 more' })).toHaveAttribute('href', '/pantry');
    expect(
      within(screen.getByRole('list', { name: 'Later' })).getByRole('button'),
    ).toHaveTextContent('Rice 3 mo');
    await userEvent.click(within(todayCol).getByRole('button'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ name: 'Spinach' }));
    expect(screen.getByText('Use soon')).toBeInTheDocument();
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('arrow keys move between chips', async () => {
    renderWithRouter(<ShelfTimeline items={items} today={TODAY} onOpen={() => undefined} />);
    screen.getByRole('button', { name: 'Spinach today' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Cilantro 2 days' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('button', { name: 'Spinach today' })).toHaveFocus();
  });
});
