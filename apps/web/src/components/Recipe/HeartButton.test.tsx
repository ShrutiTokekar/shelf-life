import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { HeartButton } from './HeartButton';

describe('HeartButton (SAV-2)', () => {
  it('is a labeled toggle button, 44 px, pressed when saved', async () => {
    const onToggle = vi.fn();
    const { container, rerender } = render(
      <HeartButton title="Palak paneer" saved={false} onToggle={onToggle} />,
    );
    const button = screen.getByRole('button', { name: 'Save Palak paneer' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveClass('size-11');
    await userEvent.keyboard('{Tab}{Enter}');
    expect(onToggle).toHaveBeenCalledOnce();
    rerender(<HeartButton title="Palak paneer" saved onToggle={onToggle} />);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button.querySelector('svg')).toHaveAttribute('fill', 'currentColor');
    expect(await seriousViolations(container)).toEqual([]);
  });
});
