import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SkipLink } from './SkipLink';

describe('SkipLink', () => {
  it('SRS 5.1 is the first focusable element and visually hidden until focused', async () => {
    render(
      <>
        <SkipLink targetId="priorities" text="Skip to today's priorities" />
        <button type="button">Nav</button>
        <section id="priorities">Priorities</section>
      </>,
    );
    const link = screen.getByRole('link', { name: "Skip to today's priorities" });
    expect(link.className).toContain('sr-only');
    expect(link.className).toContain('focus:not-sr-only');
    await userEvent.tab();
    expect(link).toHaveFocus();
  });

  it('A11Y-4 moves focus to the target when activated', async () => {
    render(
      <>
        <SkipLink targetId="main" text="Skip to main content" />
        <button type="button">Nav</button>
        <main id="main">Content</main>
      </>,
    );
    Element.prototype.scrollIntoView = () => undefined;
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('main')).toHaveFocus();
  });
});
