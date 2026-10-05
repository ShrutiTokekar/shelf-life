import { afterEach, describe, expect, it } from 'vitest';
import { clock, remaining, useTimers } from './timers';

afterEach(() => useTimers.setState({ timers: {} }));

const base = { recipeId: 'r', recipeTitle: 'R', step: 0, stepTitle: 'Simmer', durationMs: 120_000 };

describe('step timers (SRS 8.10)', () => {
  it('keep time by end time, pause and resume', () => {
    const s = useTimers.getState();
    s.start(base, 1_000);
    let t = useTimers.getState().timers['r:0']!;
    expect(remaining(t, 31_000)).toBe(90_000);
    s.pause('r:0', 31_000);
    t = useTimers.getState().timers['r:0']!;
    expect(remaining(t, 999_999)).toBe(90_000);
    s.resume('r:0', 100_000);
    t = useTimers.getState().timers['r:0']!;
    expect(remaining(t, 160_000)).toBe(30_000);
    s.finish('r:0');
    expect(remaining(useTimers.getState().timers['r:0']!, 0)).toBe(0);
  });

  it('formats clocks', () => {
    expect([60_000, 125_000, 3_725_000, 500].map(clock)).toEqual([
      '1:00',
      '2:05',
      '1:02:05',
      '0:01',
    ]);
  });
});
