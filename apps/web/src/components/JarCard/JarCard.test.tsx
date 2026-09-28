import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { pantryItem, TODAY } from '../../test/pantryFixtures';
import { JarCard, type JarCardProps } from './JarCard';

function renderJar(over: Partial<JarCardProps> = {}) {
  const props: JarCardProps = {
    item: pantryItem({ name: 'Spinach', expiresOn: TODAY }),
    status: 'today',
    today: TODAY,
    list: { name: 'Apartment 4B', color: 'navy' },
    addedBy: { name: 'Arjun Patel', initial: 'A', tone: 'sage' },
    onUsed: vi.fn(),
    onEdit: vi.fn(),
    onAddToList: vi.fn(),
    ...over,
  };
  const utils = render(
    <ul>
      <JarCard {...props} />
    </ul>,
  );
  return { ...utils, props };
}

describe('JarCard', () => {
  it('PAN-7 shows name, quantity · location, pantry label, status words and who added it', () => {
    renderJar();
    const jar = screen.getByRole('article', { name: 'Spinach' });
    expect(within(jar).getByText('1 bag · Fridge')).toBeInTheDocument();
    expect(within(jar).getByText('Apartment 4B')).toBeInTheDocument();
    expect(within(jar).getByText('Expires today')).toBeInTheDocument();
    expect(within(jar).getByRole('img', { name: 'Added by Arjun Patel' })).toBeInTheDocument();
  });

  it('PAN-8 actions: "Used it" and Edit are labeled with the item name', async () => {
    const { props } = renderJar();
    await userEvent.click(screen.getByRole('button', { name: 'Used it: Spinach' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit Spinach' }));
    expect(props.onUsed).toHaveBeenCalledOnce();
    expect(props.onEdit).toHaveBeenCalledOnce();
  });

  it('SRS 7 the card itself is not a button', () => {
    renderJar();
    expect(screen.getByRole('article', { name: 'Spinach' }).tagName).toBe('ARTICLE');
  });

  it('PAN-9 ran-out jar offers "Add to list" for its own list', async () => {
    const { props } = renderJar({
      item: pantryItem({ name: 'Eggs', status: 'out', quantity: 0, outAt: TODAY, unit: '' }),
      status: 'out',
    });
    expect(screen.getByText('0 left · Fridge')).toBeInTheDocument();
    expect(screen.getByText('Ran out today')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add Eggs to Apartment 4B' }));
    expect(props.onAddToList).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /Used it/ })).toBeNull();
  });

  it('PAN-9 ran-out jar already on a list shows who is getting it', () => {
    renderJar({
      item: pantryItem({ name: 'Onions', status: 'out', quantity: 0, outAt: '2026-09-26' }),
      status: 'out',
      onList: { claimedBy: 'Arjun' },
    });
    expect(screen.getByText('On the list · Arjun')).toBeInTheDocument();
    expect(screen.getByText('Ran out 2 days ago')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add Onions/ })).toBeNull();
  });

  it('A11Y-3 action targets are at least 44 px', () => {
    renderJar();
    for (const b of screen.getAllByRole('button'))
      expect(b.className).toMatch(/min-h-\[2\.875rem\]|size-11|min-h-11/);
  });

  it('SRS 8.3 marks estimated dates on the jar', () => {
    renderJar({
      item: pantryItem({ name: 'Mangoes', expiresOn: '2026-10-01', expiryIsEstimate: true }),
      status: 'soon',
    });
    const tag = screen.getByText('3 days left').closest('[data-status]')!;
    expect(tag).toHaveTextContent('· est.');
    expect(tag).toHaveTextContent(', estimated');
  });

  it('does not mark dates the user set', () => {
    renderJar({ item: pantryItem({ name: 'Mangoes', expiresOn: '2026-10-01' }), status: 'soon' });
    expect(screen.queryByText('· est.')).toBeNull();
  });

  it('has no serious axe violations', async () => {
    const { container } = renderJar();
    expect(await seriousViolations(container)).toEqual([]);
  });
});
