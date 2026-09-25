import { describe, expect, it } from 'vitest';
import { isRepeatRule, nextOccurrence } from '../src/recurrence';

const at = (iso: string) => new Date(iso);
const utc = (date: Date | null) => date?.toISOString();

describe('isRepeatRule', () => {
  it.each(['daily', 'weekly', 'monthly', 'yearly'])('accepts %s', (rule) => {
    expect(isRepeatRule(rule)).toBe(true);
  });

  it.each(['hourly', '', null, undefined, 1])('rejects %s', (value) => {
    expect(isRepeatRule(value)).toBe(false);
  });
});

describe('nextOccurrence', () => {
  it('returns the base itself when it is still in the future', () => {
    expect(utc(nextOccurrence('2026-10-01', '09:00', 'daily', at('2026-09-25T08:00:00Z')))).toBe(
      '2026-10-01T06:00:00.000Z'
    );
  });

  it('daily: later today when the time has not passed yet', () => {
    // now = 08:00 local
    expect(utc(nextOccurrence('2026-09-20', '09:00', 'daily', at('2026-09-25T05:00:00Z')))).toBe(
      '2026-09-25T06:00:00.000Z'
    );
  });

  it('daily: tomorrow when the time already passed today', () => {
    // now = 11:00 local
    expect(utc(nextOccurrence('2026-09-20', '09:00', 'daily', at('2026-09-25T08:00:00Z')))).toBe(
      '2026-09-26T06:00:00.000Z'
    );
  });

  it('daily: stays at 09:00 local across the autumn clock change', () => {
    expect(utc(nextOccurrence('2026-10-20', '09:00', 'daily', at('2026-10-25T07:30:00Z')))).toBe(
      '2026-10-26T07:00:00.000Z'
    );
  });

  it('weekly: next matching weekday', () => {
    // base is Monday 2026-09-21; now is Friday 2026-09-25
    expect(utc(nextOccurrence('2026-09-21', '09:00', 'weekly', at('2026-09-25T08:00:00Z')))).toBe(
      '2026-09-28T06:00:00.000Z'
    );
  });

  it('monthly on the 31st: clamps to February 28 without drifting', () => {
    expect(utc(nextOccurrence('2026-01-31', '09:00', 'monthly', at('2026-02-10T00:00:00Z')))).toBe(
      '2026-02-28T07:00:00.000Z'
    );
  });

  it('monthly on the 31st: returns to the 31st after a short month', () => {
    // right after the February 28 occurrence; March 31 is already summer time
    expect(utc(nextOccurrence('2026-01-31', '09:00', 'monthly', at('2026-02-28T08:00:00Z')))).toBe(
      '2026-03-31T06:00:00.000Z'
    );
  });

  it('yearly on February 29: clamps in common years and returns in leap years', () => {
    expect(utc(nextOccurrence('2024-02-29', '09:00', 'yearly', at('2026-01-01T00:00:00Z')))).toBe(
      '2026-02-28T07:00:00.000Z'
    );
    expect(utc(nextOccurrence('2024-02-29', '09:00', 'yearly', at('2027-03-01T00:00:00Z')))).toBe(
      '2028-02-29T07:00:00.000Z'
    );
  });

  it('finds the next occurrence of a base far in the past', () => {
    expect(utc(nextOccurrence('2000-01-01', '09:00', 'daily', at('2026-09-25T08:00:00Z')))).toBe(
      '2026-09-26T06:00:00.000Z'
    );
    expect(utc(nextOccurrence('1990-05-15', '09:00', 'monthly', at('2026-09-25T08:00:00Z')))).toBe(
      '2026-10-15T06:00:00.000Z'
    );
  });

  it('is strictly after now, never equal', () => {
    expect(utc(nextOccurrence('2026-09-25', '09:00', 'daily', at('2026-09-25T06:00:00Z')))).toBe(
      '2026-09-26T06:00:00.000Z'
    );
  });

  it.each([
    ['2026-9-25', '09:00'],
    ['2026-09-25', '9:00'],
  ])('returns null for malformed input %s %s', (date, time) => {
    expect(nextOccurrence(date, time, 'daily')).toBeNull();
  });
});
