import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { WarnIcon } from '../icons';
import { PriorityCard } from './PriorityCard';

describe('PriorityCard (TOD-3, TOD-4)', () => {
  it('is an article named by its h2 title, with the rank spoken and an icon + words tag', async () => {
    const { container } = render(
      <PriorityCard
        rank={1}
        tone="today"
        urgency={{ icon: <WarnIcon size={15} />, text: 'Expires today' }}
        title="Use your spinach today"
        reason="It expires today."
        actions={<button type="button">Used it</button>}
        size="hero"
      />,
    );
    const heading = screen.getByRole('heading', { level: 2, name: '1. Use your spinach today' });
    expect(screen.getByRole('article', { name: '1. Use your spinach today' })).toContainElement(
      heading,
    );
    expect(screen.getByText('Expires today').closest('span')!.querySelector('svg')).not.toBeNull();
    expect(screen.getByTestId('priority')).toHaveClass('border-terra');
    expect(await seriousViolations(container)).toEqual([]);
  });
});
