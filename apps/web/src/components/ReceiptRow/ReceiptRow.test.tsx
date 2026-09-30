import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { savedReceipt, scanDraft } from '../../test/receiptFixtures';
import { renderWithRouter } from '../../test/render';
import { ReceiptRow, ReceiptStatusChip } from './ReceiptRow';

const scanner = { name: 'Maya', initial: 'M', tone: 'sage' as const };

describe('ReceiptRow (HIS-3)', () => {
  it('shows store, total, date, item count, scanner and a status chip; the store is the link', async () => {
    const { receipt } = savedReceipt();
    const { container } = renderWithRouter(
      <ReceiptRow
        receipt={receipt}
        dateText="Sep 27"
        scanner={scanner}
        scannerName="Maya"
        href={`/profile/receipts/${receipt.id}`}
        selected
      />,
    );
    const link = screen.getByRole('link', { name: 'Patel Brothers' });
    expect(link).toHaveAttribute('href', `/profile/receipts/${receipt.id}`);
    expect(link).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('$25.99')).toBeInTheDocument();
    expect(screen.getByText('3 items')).toBeInTheDocument();
    expect(screen.getByText('Maya')).toBeInTheDocument();
    expect(screen.getAllByText('All added').length).toBeGreaterThan(0);
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('HIS-2 a needs-review row carries its own action', () => {
    const { receipt } = savedReceipt({}, scanDraft(undefined, 0.55));
    renderWithRouter(
      <ReceiptRow
        receipt={receipt}
        dateText="Today"
        scanner={null}
        scannerName="You"
        href="/x"
        action={<button type="button">Review 1 line</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Review 1 line' })).toBeInTheDocument();
    expect(screen.getByTestId('receipt-row')).toHaveClass('border-terra');
  });
});

describe('ReceiptStatusChip (HIS-3)', () => {
  it.each([
    ['clean', {}, 'All added'],
    ['edited', { reviewState: 'edited' as const }, '0 edited'],
  ])('%s', (_, over, text) => {
    const { receipt } = savedReceipt(over);
    renderWithRouter(<ReceiptStatusChip receipt={receipt} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('counts lines to check', () => {
    const { receipt } = savedReceipt({}, scanDraft(undefined, 0.55));
    renderWithRouter(<ReceiptStatusChip receipt={receipt} />);
    expect(screen.getByText(/lines? to check/)).toHaveTextContent(/^\d+ lines? to check$/);
  });
});
