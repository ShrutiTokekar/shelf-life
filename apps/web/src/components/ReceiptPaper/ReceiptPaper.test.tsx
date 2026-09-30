import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { savedReceipt, scanDraft } from '../../test/receiptFixtures';
import { ReceiptPaper } from './ReceiptPaper';

describe('ReceiptPaper (HIS-4)', () => {
  it('shows each raw line → its result chip', async () => {
    const { receipt } = savedReceipt({}, scanDraft(undefined, 0.55));
    const { container } = render(
      <ReceiptPaper lines={receipt.lines} locationOf={() => 'cupboard'} initialCount={20} />,
    );
    const rows = screen.getAllByTestId('receipt-line');
    expect(rows).toHaveLength(receipt.lines.length);
    const toor = rows.find((r) => r.textContent?.includes('TOOR DAL'))!;
    expect(toor).toHaveTextContent('8.99');
    expect(within(toor).getByText('becomes')).toHaveClass('sr-only');
    expect(toor).toHaveTextContent(/Toor dal · (Cupboard|check this)/);
    const tax = rows.find((r) => r.textContent?.includes('TAX'))!;
    expect(tax).toHaveTextContent('Skipped, tax');
    const towels = rows.find((r) => r.textContent?.includes('PAPER TOWELS'))!;
    expect(towels).toHaveTextContent('Skipped, not food');
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('marks added, unsure and not-added lines differently', () => {
    const { receipt } = savedReceipt();
    const lines = receipt.lines.map((l, i) =>
      l.kind !== 'item'
        ? l
        : i === 1
          ? { ...l, pantryItemId: null }
          : i === 2
            ? { ...l, confirmed: false }
            : l,
    );
    render(<ReceiptPaper lines={lines} locationOf={() => 'fridge'} initialCount={20} />);
    expect(screen.getAllByText(/· Fridge$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/· not added$|· check this$/).length).toBeGreaterThan(0);
  });

  it('collapses long receipts behind "+ N more lines"', async () => {
    const { receipt } = savedReceipt();
    render(<ReceiptPaper lines={receipt.lines} locationOf={() => null} initialCount={3} />);
    expect(screen.getAllByTestId('receipt-line')).toHaveLength(3);
    const more = screen.getByRole('button', { name: `+ ${receipt.lines.length - 3} more lines` });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(more);
    expect(screen.getAllByTestId('receipt-line')).toHaveLength(receipt.lines.length);
    await userEvent.click(screen.getByRole('button', { name: 'Show fewer lines' }));
    expect(screen.getAllByTestId('receipt-line')).toHaveLength(3);
  });
});
