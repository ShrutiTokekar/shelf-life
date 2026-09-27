import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  it('is hidden when the count is 0', () => {
    const { container } = render(<Badge count={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the count visually but hides it from assistive tech (parent label announces it)', () => {
    render(<Badge count={4} />);
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveTextContent('4');
    expect(badge).toHaveAttribute('aria-hidden', 'true');
  });

  it('caps large counts', () => {
    render(<Badge count={250} />);
    expect(screen.getByTestId('badge')).toHaveTextContent('99+');
  });
});
