import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { LeafIcon } from '../icons';
import { Shelf } from './Shelf';

const jars = Array.from({ length: 7 }, (_, i) => <li key={i}>Jar {i + 1}</li>);

describe('Shelf', () => {
  it('PAN-5 header: title (h2 with count for screen readers) and helper text', () => {
    render(
      <Shelf
        tone="fresh"
        icon={<LeafIcon />}
        title="Good for now"
        helper="No rush on these"
        count={7}
      >
        {jars}
      </Shelf>,
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Good for now, 7 items' }),
    ).toBeInTheDocument();
    expect(screen.getByText('No rush on these')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Good for now/ })).toBeInTheDocument();
  });

  it('PAN-6 limit shows the first 4 plus "+N more", which expands and collapses', async () => {
    render(
      <Shelf
        tone="fresh"
        icon={<LeafIcon />}
        title="Good for now"
        helper="No rush on these"
        count={7}
        limit={4}
      >
        {jars}
      </Shelf>,
    );
    expect(screen.getAllByText(/^Jar/)).toHaveLength(4);
    const more = screen.getByRole('button', { name: 'Show all 7 items on Good for now' });
    expect(more).toHaveTextContent('+3 more');
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(more);
    expect(screen.getAllByText(/^Jar/)).toHaveLength(7);
    await userEvent.click(screen.getByRole('button', { name: 'Show fewer' }));
    expect(screen.getAllByText(/^Jar/)).toHaveLength(4);
  });

  it('an empty shelf says so', () => {
    render(
      <Shelf
        tone="today"
        icon={<LeafIcon />}
        title="Use today"
        helper="Expires before tomorrow"
        count={0}
      >
        {[]}
      </Shelf>,
    );
    expect(screen.getByText('Nothing here right now.')).toBeInTheDocument();
  });

  it('has no serious axe violations', async () => {
    const { container } = render(
      <Shelf
        tone="soon"
        icon={<LeafIcon />}
        title="Use this week"
        helper="Plan meals around these"
        count={7}
        limit={4}
      >
        {jars}
      </Shelf>,
    );
    expect(await seriousViolations(container)).toEqual([]);
  });
});
