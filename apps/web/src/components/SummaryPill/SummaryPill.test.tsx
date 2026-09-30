import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SummaryPill, type SummaryTone } from './SummaryPill';

describe('SummaryPill (REV-2)', () => {
  it.each<SummaryTone>(['matched', 'look', 'skipped', 'ai'])(
    'A11Y-2 %s is icon + words, never color alone',
    (tone) => {
      const { container } = render(<SummaryPill tone={tone}>2 things</SummaryPill>);
      expect(screen.getByText('2 things')).toHaveAttribute('data-tone', tone);
      expect(container.querySelector('svg')).not.toBeNull();
    },
  );
});
