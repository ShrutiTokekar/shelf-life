import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { scanDraft } from '../../test/receiptFixtures';
import { ReviewItemCard } from './ReviewItemCard';

const TODAY = '2026-09-28';
const handlers = () => ({ onToggle: vi.fn(), onConfirm: vi.fn(), onEdit: vi.fn() });

function renderCard(confidence: number, over = {}) {
  const item = { ...scanDraft(undefined, confidence).items[0]!, ...over };
  const h = handlers();
  const utils = render(
    <ul>
      <ReviewItemCard item={item} today={TODAY} {...h} />
    </ul>,
  );
  return { ...utils, item, ...h };
}

describe('ReviewItemCard (REV-3, REV-4)', () => {
  it('REV-3 shows raw text, a ticked checkbox, the name and qty · location · expiry', async () => {
    const { container, onToggle, onEdit } = renderCard(0.95);
    expect(screen.getByText('TOOR DAL 4LB')).toBeInTheDocument();
    const box = screen.getByRole('checkbox', { name: 'Add Toor dal to pantry' });
    expect(box).toBeChecked();
    expect(box).toHaveAccessibleDescription(/4 lb · Cupboard · ~\d+ months?/);
    await userEvent.click(box);
    expect(onToggle).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Toor dal' }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(screen.queryByText(/not sure/)).toBeNull();
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('REV-4 an unsure match is tinted, gets a "?" and a confirm note', async () => {
    const { container, onConfirm } = renderCard(0.55);
    const card = screen.getByTestId('review-item');
    expect(card).toHaveAttribute('data-unsure', 'true');
    expect(card).toHaveTextContent('Toor dal?');
    expect(screen.getByText(', not sure yet')).toHaveClass('sr-only');
    await userEvent.click(
      screen.getByRole('button', {
        name: /We’re not sure about “TOOR DAL 4LB”. Tap to confirm./,
      }),
    );
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('a confirmed or unticked item drops the note', () => {
    renderCard(0.55, { confirmed: true, included: false });
    expect(screen.queryByTestId('review-item')).not.toHaveAttribute('data-unsure');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('focuses the edit button when asked (restored line, REV-5)', () => {
    const item = scanDraft().items[0]!;
    render(
      <ul>
        <ReviewItemCard item={item} today={TODAY} autoFocusEdit {...handlers()} />
      </ul>,
    );
    expect(screen.getByRole('button', { name: 'Edit Toor dal' })).toHaveFocus();
  });
});
