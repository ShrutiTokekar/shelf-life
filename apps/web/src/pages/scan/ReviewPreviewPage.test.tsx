import { parseReceipt } from '@shelf-life/shared';
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useScanResult } from '../../stores/scanResult';
import { seriousViolations } from '../../test/axe';
import { returningUserMe } from '../../test/fixtures';
import { renderApp } from '../../test/renderApp';

afterEach(() => useScanResult.getState().clear());

describe('ReviewPreviewPage (interim)', () => {
  it('shows an empty state before any scan', async () => {
    renderApp('/scan/review', returningUserMe);
    expect(await screen.findByRole('heading', { name: 'Nothing scanned yet' })).toBeInTheDocument();
  });

  it('lists what the scan found, with store, counts and match status', async () => {
    useScanResult.getState().set(
      parseReceipt(
        ['PATEL BROTHERS', '09/27/26', 'PANEER 400G  5.49', 'ZQXW BLORP  1.00', 'TOTAL  6.49'].map(
          (text) => ({ text, confidence: 0.95 }),
        ),
        '2026-09-28',
      ),
    );
    const { container } = renderApp('/scan/review', returningUserMe);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Review scan' }),
    ).toBeInTheDocument();
    expect(screen.getByText('5 lines read · 2 groceries found')).toBeInTheDocument();
    expect(screen.getByText(/^Patel Brothers ·/)).toBeInTheDocument();
    const items = screen.getAllByTestId('scanned-item');
    expect(items[0]).toHaveTextContent('Paneer');
    expect(items[0]).toHaveTextContent('Matched');
    expect(items[1]).toHaveTextContent('Needs a look');
    expect(await seriousViolations(container)).toEqual([]);
  });
});
