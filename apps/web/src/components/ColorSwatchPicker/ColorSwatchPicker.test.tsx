import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ListColor } from '@shelf-life/shared';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { ColorSwatchPicker } from './ColorSwatchPicker';

function Harness() {
  const [value, setValue] = useState<ListColor>('navy');
  return (
    <>
      <span id="lbl">Color label</span>
      <ColorSwatchPicker value={value} onChange={setValue} labelledBy="lbl" />
    </>
  );
}

describe('ColorSwatchPicker', () => {
  it('WEL-4 announces color names, not just colors', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Color label' })).toBeInTheDocument();
    for (const name of ['Navy', 'Olive', 'Amber', 'Terracotta', 'Gray']) {
      expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('radio', { name: 'Navy' })).toHaveAttribute('aria-checked', 'true');
  });

  it('A11Y-4 arrow keys change the selection', async () => {
    render(<Harness />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Olive' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Olive' })).toHaveFocus();
  });

  it('clicking selects', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('radio', { name: 'Amber' }));
    expect(screen.getByRole('radio', { name: 'Amber' })).toHaveAttribute('aria-checked', 'true');
  });

  it('has no serious axe violations', async () => {
    const { container } = render(<Harness />);
    expect(await seriousViolations(container)).toEqual([]);
  });
});
