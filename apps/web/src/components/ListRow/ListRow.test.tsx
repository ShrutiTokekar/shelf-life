import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { listItem } from '../../test/listFixtures';
import { ClaimPill } from '../ClaimPill/ClaimPill';
import { PlusIcon } from '../icons';
import { ListRow, quantityText } from './ListRow';

const maya = { name: 'Maya Rao', initial: 'M', tone: 'sage' as const, isYou: false };
const reason = { icon: <PlusIcon size={15} />, text: 'Added by Maya' };

function renderRow(props: Partial<Parameters<typeof ListRow>[0]> = {}) {
  const handlers = { onCheck: vi.fn(), onClaim: vi.fn(), onEdit: vi.fn() };
  const utils = render(
    <ul>
      <ListRow item={listItem()} claimer={null} reason={reason} canEdit {...handlers} {...props} />
    </ul>,
  );
  return { ...utils, ...handlers };
}

describe('ListRow (LST-4, LST-5)', () => {
  it('the checkbox is labeled by the item name; the reason describes it', async () => {
    const { container, onCheck } = renderRow();
    const box = screen.getByRole('checkbox', { name: 'Eggs' });
    expect(box).toHaveAccessibleDescription('Added by Maya');
    await userEvent.click(box);
    expect(onCheck).toHaveBeenCalledOnce();
    expect(screen.getByText('× 12')).toBeInTheDocument();
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('LST-5 unclaimed: warning + words and an "I\'ll get it" button', async () => {
    const { onClaim, onEdit } = renderRow();
    expect(screen.getByText('Nobody’s getting this yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'I’ll get it: Eggs' }));
    expect(onClaim).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Eggs' }));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('LST-5 claimed: avatar and "{name} is getting it", no claim button', () => {
    renderRow({ claimer: maya });
    expect(screen.getByText('Maya Rao is getting it')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /I’ll get it/ })).toBeNull();
  });

  it('SHR-5 view-only: disabled checkbox, no claim or edit', () => {
    renderRow({ canEdit: false });
    expect(screen.getByRole('checkbox', { name: 'Eggs' })).toBeDisabled();
    expect(screen.queryAllByRole('button')).toEqual([]);
  });

  it('web layout shows the short claim pill and a text button', () => {
    renderRow({ wide: true });
    expect(screen.getByText('Nobody yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I’ll get it: Eggs' })).toHaveTextContent(
      'I’ll get it',
    );
  });

  it('LST-9 large rows: big checkbox, no controls; checked items are struck through', () => {
    renderRow({ large: true, item: listItem({ checked: true }) });
    expect(screen.getByRole('checkbox', { name: 'Eggs' })).toHaveClass('size-11');
    expect(screen.getByText('Eggs')).toHaveClass('line-through');
    expect(screen.queryAllByRole('button')).toEqual([]);
  });

  it('quantity text', () => {
    expect(quantityText({ quantity: 20, unit: 'lb' })).toBe('20 lb');
    expect(quantityText({ quantity: 2, unit: '' })).toBe('× 2');
    expect(quantityText({ quantity: null, unit: 'bunch' })).toBe('bunch');
  });
});

describe('ClaimPill', () => {
  it('says "You’re getting it" for you', () => {
    render(<ClaimPill claimer={{ ...maya, isYou: true }} />);
    expect(screen.getByText('You’re getting it')).toBeInTheDocument();
  });
});
