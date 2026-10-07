import { afterEach, describe, expect, it, vi } from 'vitest';
import { BROWSER_IDLE_MS, lastActive, markActive, watchIdle } from './sessionTimeout';

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

describe('SEC-9 browser idle sign-out', () => {
  it('signs out right away when the app comes back after 5 hours without use', () => {
    const now = 1_000_000_000_000;
    markActive(now - BROWSER_IDLE_MS - 1);
    const onIdle = vi.fn();
    const stop = watchIdle(onIdle, () => now);
    expect(onIdle).toHaveBeenCalledTimes(1);
    stop();
  });

  it('touching the app keeps it going; 5 hours of nothing signs out', () => {
    vi.useFakeTimers();
    let now = 1_000_000_000_000;
    const onIdle = vi.fn();
    const stop = watchIdle(onIdle, () => now);
    expect(lastActive()).toBe(now);
    now += 4 * 3600_000;
    window.dispatchEvent(new Event('keydown'));
    expect(lastActive()).toBe(now);
    now += 4 * 3600_000;
    vi.advanceTimersByTime(60_000);
    expect(onIdle).not.toHaveBeenCalled();
    now += 3600_000 + 1;
    vi.advanceTimersByTime(60_000);
    expect(onIdle).toHaveBeenCalled();
    stop();
  });
});
