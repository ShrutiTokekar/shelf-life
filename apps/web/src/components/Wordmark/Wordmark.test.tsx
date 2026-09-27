import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LogoStacked, Wordmark } from './Wordmark';

describe('Wordmark', () => {
  it('SRS 7 is labeled "Shelf Life"', () => {
    render(<Wordmark />);
    expect(screen.getByRole('img', { name: 'Shelf Life' })).toBeInTheDocument();
  });

  it('WEL-1 stacked logo has alt text', () => {
    render(<LogoStacked />);
    expect(screen.getByRole('img', { name: 'Shelf Life' })).toBeInTheDocument();
  });
});
