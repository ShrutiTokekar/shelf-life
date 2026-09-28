import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { Chip } from './Chip';

describe('Chip', () => {
  it('SRS 7 toggle chips use aria-pressed and show the count', async () => {
    const onToggle = vi.fn();
    const { container } = render(
      <Chip selected={false} onToggle={onToggle} count={9}>
        Produce
      </Chip>,
    );
    const chip = screen.getByRole('button', { name: 'Produce 9' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(chip.className).toContain('min-h-11');
    await userEvent.click(chip);
    expect(onToggle).toHaveBeenCalled();
    expect(await seriousViolations(container)).toEqual([]);
  });
});
