import { addDays, todayIso } from '@shelf-life/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { getDoc, pantryDocName } from '../../lib/sync/docs';
import { applyReview, readItems, readReceipts } from '@shelf-life/docs';
import { formatMonth } from '../../lib/format';
import { useReviewDraft } from '../../stores/reviewDraft';
import { seriousViolations } from '../../test/axe';
import { returningUserMe, seededMe } from '../../test/fixtures';
import { resetMedia, setDesktop } from '../../test/media';
import { PANTRY, savedReceipt, scanDraft } from '../../test/receiptFixtures';
import { renderApp } from '../../test/renderApp';

afterEach(() => {
  resetMedia();
  useReviewDraft.getState().clear();
});

// Dates relative to today, so "This month" and the month headings hold on any day.
const TODAY = todayIso();
const EARLIER = addDays(TODAY, -60);

async function seed() {
  const handle = getDoc(pantryDocName(PANTRY));
  await handle.ready;
  const clean = savedReceipt({ purchasedOn: TODAY });
  const costco = savedReceipt(
    { storeName: 'Costco', purchasedOn: EARLIER, scannedBy: 'u2', total: 96.12 },
    scanDraft(),
  );
  const review = savedReceipt(
    { storeName: 'Trader Joe’s', purchasedOn: TODAY },
    scanDraft(undefined, 0.55),
  );
  for (const c of [clean, costco, review]) applyReview(handle.doc, c);
  return { doc: handle.doc, clean, costco, review };
}

describe('ReceiptsPage mobile (SRS 6.12, Figma 13–14)', () => {
  it('shows an empty state before any scan', async () => {
    renderApp('/profile/receipts', returningUserMe);
    expect(await screen.findByRole('heading', { name: 'No receipts yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Scan a receipt' })).toHaveAttribute('href', '/scan');
  });

  it('HIS-1 HIS-2 HIS-3 title, privacy line, needs-review first, then months', async () => {
    await seed();
    const { container } = renderApp('/profile/receipts', seededMe);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Receipt history' }),
    ).toBeInTheDocument();
    expect(screen.getByText('3 receipts · photos never leave your device')).toBeInTheDocument();
    const sections = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(sections).toEqual([
      'Needs your review · 1',
      formatMonth(TODAY.slice(0, 7), TODAY),
      formatMonth(EARLIER.slice(0, 7), TODAY),
    ]);
    const review = screen.getAllByTestId('receipt-row')[0]!;
    expect(within(review).getByRole('link', { name: 'Trader Joe’s' })).toBeInTheDocument();
    expect(within(review).getByRole('link', { name: /Review \d+ lines?/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/scan\/review\?receipt=/),
    );
    const costco = screen.getAllByTestId('receipt-row')[2]!;
    expect(costco).toHaveTextContent('$96.12');
    expect(costco).toHaveTextContent('Arjun Patel');
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('HIS-1 filters and search', async () => {
    await seed();
    renderApp('/profile/receipts', seededMe);
    const control = await screen.findByRole('radiogroup', { name: 'Show' });
    await userEvent.click(within(control).getByRole('radio', { name: 'Needs review 1' }));
    expect(screen.getAllByTestId('receipt-row')).toHaveLength(1);
    await userEvent.click(within(control).getByRole('radio', { name: 'This month 2' }));
    expect(screen.getAllByTestId('receipt-row')).toHaveLength(2);
    await userEvent.click(within(control).getByRole('radio', { name: 'All 3' }));
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search by store or item' }),
      'cost',
    );
    await waitFor(() => expect(screen.getAllByTestId('receipt-row')).toHaveLength(1));
    await userEvent.type(screen.getByRole('searchbox'), 'zzz');
    expect(await screen.findByRole('heading', { name: 'No receipts match' })).toBeInTheDocument();
  });

  it('HIS-4 HIS-6 detail shows the receipt text and results', async () => {
    const { clean } = await seed();
    const { container } = renderApp(`/profile/receipts/${clean.receipt.id}`, seededMe);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Patel Brothers' }),
    ).toBeInTheDocument();
    expect(screen.getByText('$25.99')).toBeInTheDocument();
    expect(screen.getByText('3 added to pantry')).toBeInTheDocument();
    expect(screen.getByText('6 lines skipped')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Receipt lines' })).toBeInTheDocument();
    expect(
      screen.getByText('The photo was deleted after scanning. Only this text was saved.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit items' })).toHaveAttribute(
      'href',
      `/scan/review?receipt=${clean.receipt.id}`,
    );
    expect(screen.getByRole('link', { name: 'Back to receipts' })).toHaveAttribute(
      'href',
      '/profile/receipts',
    );
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('HIS-5 delete asks first, removes the record only, and can be undone', async () => {
    const { doc, clean } = await seed();
    const { router } = renderApp(`/profile/receipts/${clean.receipt.id}`, seededMe);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete receipt' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete this receipt?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep it' }));
    expect(readReceipts(doc)).toHaveLength(3);

    await userEvent.click(screen.getByRole('button', { name: 'Delete receipt' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete receipt' }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/profile/receipts'));
    expect(readReceipts(doc).map((r) => r.id)).not.toContain(clean.receipt.id);
    expect(readItems(doc)).toHaveLength(9); // pantry items stay
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(readReceipts(doc)).toHaveLength(3);
  });

  it('a missing receipt id says so', async () => {
    renderApp('/profile/receipts/nope', returningUserMe);
    expect(
      await screen.findByText('This receipt isn’t on this device any more.'),
    ).toBeInTheDocument();
  });

  it('HIS-7 pages 20 at a time', async () => {
    const handle = getDoc(pantryDocName(PANTRY));
    await handle.ready;
    for (let i = 0; i < 23; i++) {
      const day = String((i % 27) + 1).padStart(2, '0');
      applyReview(handle.doc, savedReceipt({ purchasedOn: `2026-09-${day}` }));
    }
    renderApp('/profile/receipts', returningUserMe);
    await screen.findAllByTestId('receipt-row');
    expect(screen.getAllByTestId('receipt-row')).toHaveLength(20);
    await userEvent.click(screen.getByRole('button', { name: 'Show 3 older receipts' }));
    expect(screen.getAllByTestId('receipt-row')).toHaveLength(23);
  });
});

describe('ReceiptsPage desktop (web 16)', () => {
  it('shows the list with the first receipt open beside it, and a Scanned by filter', async () => {
    setDesktop(true);
    const { review } = await seed();
    const { container } = renderApp('/profile/receipts', seededMe);
    const detail = await screen.findByTestId('receipt-detail');
    expect(
      within(detail).getByRole('heading', { level: 2, name: 'Trader Joe’s' }),
    ).toBeInTheDocument();
    expect(
      within(screen.getAllByTestId('receipt-row')[0]!).getByRole('link', { name: 'Trader Joe’s' }),
    ).toHaveAttribute('aria-current', 'true');
    expect(within(detail).getByRole('button', { name: 'Re-run matching' })).toBeInTheDocument();
    expect(review.receipt.reviewState).toBe('needs_review');

    await userEvent.click(screen.getByRole('combobox', { name: 'Scanned by' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Arjun Patel' }));
    expect(screen.getAllByTestId('receipt-row')).toHaveLength(1);
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('HIS-5 Re-run matching says when nothing changed', async () => {
    setDesktop(true);
    const { clean } = await seed();
    renderApp(`/profile/receipts/${clean.receipt.id}`, seededMe);
    const detail = await screen.findByTestId('receipt-detail');
    await userEvent.click(within(detail).getByRole('button', { name: 'Re-run matching' }));
    expect(await screen.findByText('Matching found nothing new.')).toBeInTheDocument();
  });

  it('HIS-5 Re-run matching opens the review when a line now matches', async () => {
    setDesktop(true);
    const base = savedReceipt();
    // A line matched to nothing earlier (say, before the dictionary knew the word).
    const add = base.add.map((i) =>
      i.name === 'Paneer' ? { ...i, foodId: null, name: 'Panir 400g' } : i,
    );
    const handle = getDoc(pantryDocName(PANTRY));
    await handle.ready;
    applyReview(handle.doc, { ...base, add });
    const { router } = renderApp(`/profile/receipts/${base.receipt.id}`, returningUserMe);
    const detail = await screen.findByTestId('receipt-detail');
    await userEvent.click(within(detail).getByRole('button', { name: 'Re-run matching' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/scan/review'));
    expect(await screen.findByText('1 line matched better. Review and save.')).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: 'Add Paneer to pantry' })).toBeChecked();
  });
});
