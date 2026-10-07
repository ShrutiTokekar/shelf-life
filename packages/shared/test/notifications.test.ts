import { describe, expect, it } from 'vitest';
import { inQuietHours, localTime } from '../src';

describe('RMD-5 local time and quiet hours', () => {
  it('reads the local date, weekday and hour in a time zone', () => {
    // 2026-10-05 03:30 UTC is Sunday Oct 4, 8:30 PM in Los Angeles; Monday 9 AM in Kolkata.
    const at = new Date('2026-10-05T03:30:00Z');
    expect(localTime(at, 'America/Los_Angeles')).toEqual({
      date: '2026-10-04',
      weekday: 0,
      hour: 20,
      minute: 30,
    });
    expect(localTime(at, 'Asia/Kolkata')).toMatchObject({
      date: '2026-10-05',
      weekday: 1,
      hour: 9,
    });
    expect(localTime(at, 'Not/AZone').hour).toBe(3);
  });

  it('quiet from 10 PM to 8 AM local', () => {
    expect(inQuietHours(new Date('2026-10-05T03:30:00Z'), 'America/Los_Angeles')).toBe(false);
    expect(inQuietHours(new Date('2026-10-05T06:00:00Z'), 'America/Los_Angeles')).toBe(true);
    expect(inQuietHours(new Date('2026-10-05T03:00:00Z'), 'Asia/Kolkata')).toBe(false); // 8:30 AM
    expect(inQuietHours(new Date('2026-10-05T01:00:00Z'), 'Asia/Kolkata')).toBe(true);
  });
});
