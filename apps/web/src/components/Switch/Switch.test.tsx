import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { Switch } from './Switch';

describe('Switch (A11Y)', () => {
  it('is a labeled, described switch that toggles with the keyboard', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <Switch
        label="Reduce motion"
        hint="Turns off animations"
        checked={false}
        onChange={onChange}
      />,
    );
    const sw = screen.getByRole('switch', { name: 'Reduce motion' });
    expect(sw).toHaveAccessibleDescription('Turns off animations');
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await userEvent.keyboard('{Tab}{Enter}');
    expect(onChange).toHaveBeenCalledWith(true);
    expect(await seriousViolations(container)).toEqual([]);
  });
});
