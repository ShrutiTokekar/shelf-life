import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PantryLabel } from './PantryLabel';

describe('PantryLabel', () => {
  it('PAN-7 the dot is decorative; the list name carries the meaning', () => {
    const { container } = render(<PantryLabel listName="Diwali party" color="amber" />);
    expect(container).toHaveTextContent('Diwali party');
    const dot = container.querySelector('[aria-hidden="true"]')!;
    expect(dot.className).toContain('bg-list-amber');
  });
});
