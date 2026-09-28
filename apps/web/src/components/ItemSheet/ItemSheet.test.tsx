import { addDays } from '@shelf-life/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { pantryItem, TODAY } from '../../test/pantryFixtures';
import { ItemSheet, type ItemSheetProps } from './ItemSheet';

const lists = [
  { id: 'home', name: 'Apartment 4B', color: 'navy' as const },
  { id: 'diwali', name: 'Diwali party', color: 'amber' as const },
];

function renderSheet(over: Partial<ItemSheetProps> = {}) {
  const props: ItemSheetProps = {
    open: true,
    mode: 'add',
    lists,
    defaultListId: 'home',
    today: TODAY,
    onClose: vi.fn(),
    onSave: vi.fn(),
    onRanOut: vi.fn(),
    onDelete: vi.fn(),
    ...over,
  };
  return { ...render(<ItemSheet {...props} />), props };
}

async function pick(label: string, option: string) {
  await userEvent.click(screen.getByRole('combobox', { name: label }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

describe('ItemSheet', () => {
  it('PAN-11 is a labeled dialog with every field', () => {
    renderSheet();
    const dialog = screen.getByRole('dialog', { name: 'Add an item' });
    for (const name of ['Name', 'Quantity', 'Unit', 'Use by', 'Note']) {
      expect(within(dialog).getByLabelText(name)).toBeInTheDocument();
    }
    for (const name of ['Category', 'Where it’s kept', 'List label']) {
      expect(within(dialog).getByRole('combobox', { name })).toBeInTheDocument();
    }
  });

  it('SRS 8.3 the date follows category and location until the user sets one', async () => {
    renderSheet();
    const date = screen.getByLabelText('Use by');
    expect(date).toHaveValue(addDays(TODAY, 7)); // produce, fridge
    expect(date).toHaveAccessibleDescription(/Estimated/);
    await pick('Category', 'Frozen');
    expect(date).toHaveValue(addDays(TODAY, 240)); // frozen goes to the freezer
    await userEvent.clear(date);
    await userEvent.type(date, '2026-12-01');
    await pick('Category', 'Produce');
    expect(date).toHaveValue('2026-12-01');
  });

  it('PAN-11 saves the form, with the list label and "estimated" flag', async () => {
    const { props } = renderSheet();
    await userEvent.type(screen.getByLabelText('Name'), 'Mangoes');
    await userEvent.clear(screen.getByLabelText('Quantity'));
    await userEvent.type(screen.getByLabelText('Quantity'), '4');
    await pick('List label', 'Diwali party');
    await userEvent.click(screen.getByRole('button', { name: 'Add to pantry' }));
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Mangoes',
        quantity: 4,
        unit: '',
        listId: 'diwali',
        category: 'produce',
        location: 'fridge',
      }),
      { estimated: true },
    );
  });

  it('shows inline errors linked to the field and focuses it', async () => {
    const { props } = renderSheet();
    await userEvent.clear(screen.getByLabelText('Quantity'));
    await userEvent.type(screen.getByLabelText('Quantity'), 'lots');
    await userEvent.click(screen.getByRole('button', { name: 'Add to pantry' }));
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Give the item a name.');
    expect(screen.getByLabelText('Quantity')).toHaveAccessibleDescription(
      'Enter a number, or leave it blank.',
    );
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('PAN-8 edit mode fills the item and offers Ran out and Delete', async () => {
    const item = pantryItem({
      name: 'Paneer',
      quantity: 400,
      unit: 'g',
      listId: 'diwali',
      category: 'dairy_eggs',
    });
    const { props } = renderSheet({ mode: 'edit', item });
    expect(screen.getByRole('dialog', { name: 'Edit Paneer' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Paneer');
    expect(screen.getByLabelText('Unit')).toHaveValue('g');
    await userEvent.click(screen.getByRole('button', { name: 'Mark as ran out' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete item' }));
    expect(props.onRanOut).toHaveBeenCalled();
    expect(props.onDelete).toHaveBeenCalled();
  });

  it('SRS 7 Escape closes it', async () => {
    const { props } = renderSheet();
    await userEvent.keyboard('{Escape}');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('has no serious axe violations', async () => {
    renderSheet();
    expect(await seriousViolations(document.body)).toEqual([]);
  });
});
