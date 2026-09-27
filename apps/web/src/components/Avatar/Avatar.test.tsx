import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('is decorative when next to a visible name', () => {
    const { container } = render(<Avatar initial="a" />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.firstChild).toHaveTextContent('A');
  });

  it('has an accessible name when it stands alone', () => {
    render(<Avatar initial="S" label="Shruti" />);
    expect(screen.getByRole('img', { name: 'Shruti' })).toBeInTheDocument();
  });

  it('clamps size to 18–96 px', () => {
    const { container } = render(<Avatar initial="S" size={200} />);
    expect((container.firstChild as HTMLElement).style.width).toBe('6rem');
  });
});
