import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TextSize } from '@shelf-life/shared';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { TextSizeControl } from './TextSizeControl';

function Harness({ initial = 'default' as TextSize }) {
  const [value, setValue] = useState<TextSize>(initial);
  return <TextSizeControl value={value} onChange={setValue} />;
}

describe('TextSizeControl', () => {
  it('A11Y-6 is a labeled radio group with three sizes', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Text size' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Default text size' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('A11Y-4 arrow keys move the selection and focus (roving tabindex)', async () => {
    render(<Harness />);
    await userEvent.tab();
    expect(screen.getByRole('radio', { name: 'Default text size' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    const large = screen.getByRole('radio', { name: 'Large text size' });
    expect(large).toHaveFocus();
    expect(large).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Largest text size' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('only the selected option is in the tab order', () => {
    render(<Harness initial="large" />);
    const tabbable = screen.getAllByRole('radio').filter((r) => r.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveAccessibleName('Large text size');
  });

  it('has no serious axe violations', async () => {
    const { container } = render(<Harness />);
    expect(await seriousViolations(container)).toEqual([]);
  });
});
