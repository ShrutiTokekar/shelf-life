import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { listItem } from '../../test/listFixtures';
import { pantryItem } from '../../test/pantryFixtures';
import { AddItemSheet, type AddItemSheetProps } from './AddItemSheet';

const members = [
  { userId: 'u1', name: 'Ananya Mehta', initial: 'A', tone: 'periwinkle' as const, isYou: true },
  { userId: 'u2', name: 'Maya Rao', initial: 'M', tone: 'sage' as const, isYou: false },
];

function renderSheet(props: Partial<AddItemSheetProps> = {}) {
  const handlers = {
    onAdd: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onRanOut: vi.fn(),
    onClose: vi.fn(),
  };
  render(
    <AddItemSheet
      open
      listName="Apartment 4B"
      isPrivate={false}
      members={members}
      ranOut={[pantryItem({ name: 'Butter', status: 'out', outAt: '2026-09-27' })]}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe('AddItemSheet (SRS 6.7)', () => {
  it('ADD-1 ADD-4 focuses the field, says who will see it, and passes axe', async () => {
    renderSheet();
    expect(screen.getByRole('dialog', { name: 'Add to grocery list' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Item' })).toHaveFocus();
    expect(
      screen.getByText('Everyone on Apartment 4B will see it right away.'),
    ).toBeInTheDocument();
    expect(await seriousViolations(document.body)).toEqual([]);
  });

  it('ADD-2 one item: quantity, unit, who and note', async () => {
    const { onAdd } = renderSheet();
    await userEvent.type(screen.getByRole('textbox', { name: 'Item' }), 'Oat milk');
    await userEvent.click(screen.getByRole('button', { name: 'More Oat milk' }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Unit' }));
    await userEvent.click(await screen.findByRole('option', { name: 'cartons' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Maya' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Note' }), 'unsweetened');
    await userEvent.click(screen.getByRole('button', { name: 'Add to shared list' }));
    expect(onAdd).toHaveBeenCalledWith([
      { name: 'Oat milk', quantity: 2, unit: 'cartons', note: 'unsweetened', claimedBy: 'u2' },
    ]);
  });

  it('LST-2 several at once, each with its own quantity', async () => {
    const { onAdd } = renderSheet();
    await userEvent.type(screen.getByRole('textbox', { name: 'Item' }), '2 onions and eggs');
    await userEvent.click(screen.getByRole('button', { name: 'Add to shared list' }));
    expect(
      onAdd.mock.calls[0]![0].map((e: { name: string; quantity: number | null }) => [
        e.name,
        e.quantity,
      ]),
    ).toEqual([
      ['Onions', 2],
      ['Eggs', null],
    ]);
  });

  it('asks for a name', async () => {
    const { onAdd } = renderSheet();
    await userEvent.click(screen.getByRole('button', { name: 'Add to shared list' }));
    expect(screen.getByText('Type what you need.')).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('ADD-3 ran-out chips add at once', async () => {
    const { onRanOut } = renderSheet();
    await userEvent.click(screen.getByRole('button', { name: 'Add Butter' }));
    expect(onRanOut).toHaveBeenCalledWith(expect.objectContaining({ name: 'Butter' }));
  });

  it('edits and removes a row; private lists hide "who"', async () => {
    const { onSave, onDelete } = renderSheet({
      item: listItem({ name: 'Atta', quantity: 20, unit: 'lb' }),
      isPrivate: true,
    });
    expect(screen.getByRole('dialog', { name: 'Edit Atta' })).toBeInTheDocument();
    expect(screen.queryByRole('radio')).toBeNull();
    const name = screen.getByRole('textbox', { name: 'Item' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Chakki atta');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Chakki atta', quantity: 20, unit: 'lb' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove from list' }));
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
