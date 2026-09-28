import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ScanProgress } from '../../features/ocr/scanSession';
import { seriousViolations } from '../../test/axe';
import { ScanProgressSheet } from './ScanProgressSheet';

const progress: ScanProgress = {
  percent: 72,
  steps: { clean: 'done', read: 'done', match: 'active', expiry: 'todo' },
  lineCount: 14,
  preparing: false,
};

describe('ScanProgressSheet', () => {
  it('SCN-3 shows percent, a progress bar and four steps with their state', () => {
    render(
      <ScanProgressSheet
        progress={progress}
        onCancel={() => undefined}
        lockText="Processed on your phone. Nothing is uploaded."
      />,
    );
    expect(screen.getByRole('heading', { name: 'Reading your receipt…' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Reading progress' })).toHaveAttribute(
      'aria-valuenow',
      '72',
    );
    const steps = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(steps).toEqual([
      'Cleaned up the photo, done',
      'Found 14 lines of text, done',
      'Matching items to groceries, in progress',
      'Estimating expiry dates, to do',
    ]);
  });

  it('SRS 7 announces the current step once in a polite live region', () => {
    render(<ScanProgressSheet progress={progress} onCancel={() => undefined} lockText="x" />);
    const live = screen.getByRole('status');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent('Matching items to groceries');
  });

  it('SCN-6 lock note and SCN-4 Cancel', async () => {
    const onCancel = vi.fn();
    render(
      <ScanProgressSheet
        progress={progress}
        onCancel={onCancel}
        lockText="Processed on your phone. Nothing is uploaded."
      />,
    );
    expect(screen.getByText('Processed on your phone. Nothing is uploaded.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('explains the one-time download while the scanner gets ready', () => {
    render(
      <ScanProgressSheet
        progress={{ ...progress, preparing: true }}
        onCancel={() => undefined}
        lockText="x"
      />,
    );
    expect(screen.getByText(/Getting the scanner ready/)).toBeInTheDocument();
  });

  it('has no serious axe violations', async () => {
    const { container } = render(
      <ScanProgressSheet progress={progress} onCancel={() => undefined} lockText="x" />,
    );
    expect(await seriousViolations(container)).toEqual([]);
  });
});
