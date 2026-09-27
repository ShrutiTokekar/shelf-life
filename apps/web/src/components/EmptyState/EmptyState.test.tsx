import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('shows a heading, message and one action', () => {
    render(
      <EmptyState
        title="Your shelves are empty"
        body="Scan a receipt."
        action={<button type="button">Scan</button>}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Your shelves are empty' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Scan a receipt.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scan' })).toBeInTheDocument();
  });
});
