import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { getDoc, pantryDocName } from '../../lib/sync/docs';
import { applyReview, readActivity, readItems, readReceipts } from '@shelf-life/docs';
import { useReviewDraft } from '../../stores/reviewDraft';
import { seriousViolations } from '../../test/axe';
import { returningUserMe, seededMe } from '../../test/fixtures';
import { PANTRY, savedReceipt, scanDraft } from '../../test/receiptFixtures';
import { renderApp } from '../../test/renderApp';

afterEach(() => useReviewDraft.getState().clear());

async function pantryDoc() {
  const handle = getDoc(pantryDocName(PANTRY));
  await handle.ready;
  return handle.doc;
}

function openReview(confidence = 0.95, me = returningUserMe) {
  useReviewDraft.getState().set(scanDraft(undefined, confidence));
  return renderApp('/scan/review', me);
}

describe('ReviewPage (SRS 6.5)', () => {
  it('shows an empty state when nothing was scanned', async () => {
    renderApp('/scan/review', returningUserMe);
    expect(await screen.findByRole('heading', { name: 'Nothing scanned yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Scan a receipt' })).toHaveAttribute('href', '/scan');
  });

  it('REV-1 REV-2 header with editable store, date, counts and summary pills', async () => {
    const { container } = openReview();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Review items' }),
    ).toBeInTheDocument();
    const store = screen.getByRole('textbox', { name: 'Store name' });
    expect(store).toHaveValue('Patel Brothers');
    await userEvent.clear(store);
    await userEvent.type(store, 'Patel Bros Devon');
    expect(useReviewDraft.getState().draft!.storeName).toBe('Patel Bros Devon');
    expect(screen.getByText(/Sep 27 · 9 lines read · 3 groceries found/)).toBeInTheDocument();
    expect(screen.getByText('3 matched')).toBeInTheDocument();
    expect(screen.getByText('0 need a look')).toBeInTheDocument();
    expect(screen.getByText('6 skipped')).toBeInTheDocument();
    expect(screen.getAllByTestId('review-item')).toHaveLength(3);
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('REV-4 unsure items need a look until confirmed', async () => {
    openReview(0.55);
    await screen.findAllByTestId('review-item');
    const before = Number(/(\d+) need a look/.exec(document.body.textContent!)![1]);
    expect(before).toBeGreaterThan(0);
    await userEvent.click(screen.getAllByRole('button', { name: /Tap to confirm/ })[0]!);
    expect(screen.getByText(`${before - 1} need a look`)).toBeInTheDocument();
  });

  it('REV-3 + REV-6 the button counts ticked items; unticking all asks for one', async () => {
    openReview();
    const add = await screen.findByRole('button', { name: 'Add 3 items to pantry' });
    for (const box of screen.getAllByRole('checkbox')) await userEvent.click(box);
    expect(screen.getByRole('button', { name: 'Add 0 items to pantry' })).toBe(add);
    await userEvent.click(add);
    expect(screen.getByRole('alert')).toHaveTextContent('Tick at least one item');
    expect(readItems(await pantryDoc())).toEqual([]);
  });

  it('REV-5 skipped lines collapse into one row and can be restored', async () => {
    openReview();
    const row = await screen.findByRole('button', {
      name: /6 lines skipped: totals, tax, store info/,
    });
    expect(row).toHaveAttribute('aria-expanded', 'false');
    for (const l of screen.getAllByTestId('skipped-line')) expect(l).not.toBeVisible();
    await userEvent.click(row);
    expect(screen.getAllByTestId('skipped-line')).toHaveLength(6);
    await userEvent.click(screen.getByRole('button', { name: 'Add as item: “PAPER TOWELS”' }));
    expect(screen.getAllByTestId('review-item')).toHaveLength(4);
    expect(screen.getByText('5 skipped')).toBeInTheDocument();
    expect(await screen.findByText(/Added “PAPER TOWELS”/)).toBeInTheDocument();
  });

  it('edits an item in the sheet (no per-item label: the receipt has one)', async () => {
    openReview();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Paneer' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByText('Pantry label')).toBeNull();
    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Malai paneer');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByRole('checkbox', { name: 'Add Malai paneer to pantry' }),
    ).toBeChecked();
  });

  it('REV-7 adds items, saves the receipt, clears the draft and highlights the jars', async () => {
    openReview(0.95, seededMe);
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Add Toor dal to pantry' }));
    // REV-6 the label picker defaults to the home list and can be changed.
    const picker = screen.getByRole('combobox', { name: 'Goes to' });
    expect(picker).toHaveTextContent('Apartment 4B');
    await userEvent.click(picker);
    await userEvent.click(await screen.findByRole('option', { name: 'Diwali party' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add 2 items to pantry' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your pantry' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('2 items added to your pantry')).toBeInTheDocument();
    const jars = await screen.findAllByRole('article');
    expect(jars.filter((j) => j.hasAttribute('data-highlighted'))).toHaveLength(2);
    expect(screen.getAllByText('New')).toHaveLength(2);

    const doc = await pantryDoc();
    const items = readItems(doc);
    expect(items.map((i) => i.name).sort()).toEqual(['Milk', 'Paneer']);
    expect(items.every((i) => i.listId === seededMe.lists[2]!.id)).toBe(true);
    const [receipt] = readReceipts(doc);
    expect(receipt).toMatchObject({ storeName: 'Patel Brothers', total: 25.99, itemsAdded: 2 });
    expect(readActivity(doc).map((a) => a.type)).toEqual(['scanned']);
    expect(useReviewDraft.getState().draft).toBeNull();
  });

  it('HIS-5 edit mode loads a saved receipt and saves back to it', async () => {
    const commit = savedReceipt();
    const doc = await pantryDoc();
    applyReview(doc, commit);
    const { router } = renderApp(`/scan/review?receipt=${commit.receipt.id}`, returningUserMe);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Edit receipt items' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Add Paneer to pantry' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/profile/receipts/${commit.receipt.id}`),
    );
    expect(readItems(doc).map((i) => i.name)).not.toContain('Paneer');
    expect(readReceipts(doc)[0]).toMatchObject({ id: commit.receipt.id, reviewState: 'edited' });
    expect(readActivity(doc)).toEqual([]);
  });

  it('HIS-5 a receipt that is gone says so', async () => {
    renderApp('/scan/review?receipt=nope', returningUserMe);
    expect(
      await screen.findByText('This receipt isn’t on this device any more.'),
    ).toBeInTheDocument();
  });
});
