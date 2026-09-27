import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { Badge } from '../Badge/Badge';
import { BellIcon } from '../icons';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('SRS 4.4 label becomes the accessible name', () => {
    render(<IconButton icon={<BellIcon />} label="Reminders" />);
    expect(screen.getByRole('button', { name: 'Reminders' })).toBeInTheDocument();
  });

  it('A11Y-3 is at least 44×44 px', () => {
    render(<IconButton icon={<BellIcon />} label="Reminders" />);
    expect(screen.getByRole('button').className).toMatch(/min-h-11/);
    expect(screen.getByRole('button').className).toMatch(/min-w-11/);
  });

  it('hides adornments from assistive tech; counts belong in the label', () => {
    render(
      <IconButton
        icon={<BellIcon />}
        label="Reminders, 2 unread"
        adornment={<Badge count={2} />}
      />,
    );
    expect(screen.getByRole('button', { name: 'Reminders, 2 unread' })).toBeInTheDocument();
  });

  it('has no serious axe violations', async () => {
    const { container } = render(<IconButton icon={<BellIcon />} label="Reminders" />);
    expect(await seriousViolations(container)).toEqual([]);
  });
});
