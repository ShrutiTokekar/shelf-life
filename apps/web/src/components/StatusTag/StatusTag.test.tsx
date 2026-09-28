import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusTag, type StatusTagStatus } from './StatusTag';

describe('StatusTag', () => {
  it.each<[StatusTagStatus, string]>([
    ['today', 'Expires today'],
    ['soon', '2 days left'],
    ['fresh', '3 weeks'],
    ['out', 'Ran out today'],
    ['ai', 'AI, confirmed'],
    ['skipped', 'Skipped, not food'],
  ])('A11Y-2 %s is icon + words, never color alone', (status, text) => {
    const { container } = render(<StatusTag status={status} text={text} />);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('StatusTag suffix', () => {
  it('SRS 8.3 shows a short visible note and a full spoken one', () => {
    const { container } = render(
      <StatusTag
        status="soon"
        text="3 days left"
        suffix={{ visible: '· est.', spoken: ', estimated' }}
      />,
    );
    expect(container.firstChild).toHaveTextContent('3 days left· est., estimated');
    expect(screen.getByText('· est.')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText(', estimated')).toHaveClass('sr-only');
  });
});
