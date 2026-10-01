import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressDots } from './ProgressDots';

describe('ProgressDots (TOD-2)', () => {
  it('announces "X of N done" and checks the finished circles', () => {
    const { container } = render(<ProgressDots total={3} done={1} />);
    expect(screen.getByRole('status')).toHaveTextContent('1 of 3 done');
    const dots = container.querySelectorAll('li');
    expect(dots).toHaveLength(3);
    expect(dots[0]!.querySelector('svg')).not.toBeNull();
    expect(dots[1]).toHaveTextContent('2');
  });
});
