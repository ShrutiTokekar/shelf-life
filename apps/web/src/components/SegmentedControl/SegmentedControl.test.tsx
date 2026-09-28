import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { SegmentedControl } from './SegmentedControl';

function Harness() {
  const [v, setV] = useState<'expiry' | 'category' | 'location' | 'az'>('expiry');
  return (
    <SegmentedControl
      label="Sort"
      value={v}
      onChange={setV}
      options={[
        { value: 'expiry', label: 'Expiry' },
        { value: 'category', label: 'Category' },
        { value: 'location', label: 'Location' },
        { value: 'az', label: 'A to Z' },
      ]}
    />
  );
}

describe('SegmentedControl', () => {
  it('PAN-2 is a radio group with Expiry selected by default', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Sort' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Expiry' })).toHaveAttribute('aria-checked', 'true');
  });

  it('SRS 7 arrow keys move the selection', async () => {
    render(<Harness />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Location' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Location' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'A to Z' })).toHaveAttribute('aria-checked', 'true');
  });

  it('has no serious axe violations', async () => {
    const { container } = render(<Harness />);
    expect(await seriousViolations(container)).toEqual([]);
  });
});
