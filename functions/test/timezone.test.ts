import { describe, expect, it } from 'vitest';
import { APP_TIME_ZONE, localDateTimeToDate } from '../src/timezone';

const utc = (date: Date | null) => date?.toISOString();

describe('localDateTimeToDate (Asia/Jerusalem)', () => {
  it('uses the fixed app time zone', () => {
    expect(APP_TIME_ZONE).toBe('Asia/Jerusalem');
  });

  it('converts summer time (UTC+3)', () => {
    expect(utc(localDateTimeToDate('2026-07-20', '20:50'))).toBe('2026-07-20T17:50:00.000Z');
  });

  it('converts winter time (UTC+2)', () => {
    expect(utc(localDateTimeToDate('2026-01-15', '09:00'))).toBe('2026-01-15T07:00:00.000Z');
  });

  it('handles the days around the spring change (2026-03-27)', () => {
    expect(utc(localDateTimeToDate('2026-03-26', '09:00'))).toBe('2026-03-26T07:00:00.000Z');
    expect(utc(localDateTimeToDate('2026-03-27', '09:00'))).toBe('2026-03-27T06:00:00.000Z');
  });

  it('handles the days around the autumn change (2026-10-25)', () => {
    expect(utc(localDateTimeToDate('2026-10-24', '09:00'))).toBe('2026-10-24T06:00:00.000Z');
    expect(utc(localDateTimeToDate('2026-10-25', '09:00'))).toBe('2026-10-25T07:00:00.000Z');
  });

  it('moves a time inside the spring gap forward instead of failing', () => {
    // 02:30 does not exist on 2026-03-27: clocks jump from 02:00 to 03:00
    expect(utc(localDateTimeToDate('2026-03-27', '02:30'))).toBe('2026-03-27T00:30:00.000Z');
  });

  it('resolves the repeated autumn hour to one of its two instants', () => {
    const result = utc(localDateTimeToDate('2026-10-25', '01:30'));
    expect(['2026-10-24T22:30:00.000Z', '2026-10-24T23:30:00.000Z']).toContain(result);
  });

  it('works across midnight UTC', () => {
    expect(utc(localDateTimeToDate('2026-07-21', '01:00'))).toBe('2026-07-20T22:00:00.000Z');
  });

  it.each([
    ['2026-7-20', '20:50'],
    ['20-07-2026', '20:50'],
    ['2026-07-20', '8:50'],
    ['2026-07-20', '20:50:00'],
    ['', ''],
    ['2026-13-01', '10:00'],
  ])('rejects malformed input %s %s', (date, time) => {
    expect(localDateTimeToDate(date, time)).toBeNull();
  });
});
