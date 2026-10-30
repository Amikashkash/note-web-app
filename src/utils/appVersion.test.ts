import { describe, expect, it } from 'vitest';
import { describeMinVersionStatus, isBelowMinimum } from './appVersion';

describe('isBelowMinimum (minClientVersion)', () => {
  it.each([
    ['1.32.0', '1.33.0', true],
    ['1.32.9', '1.33.0', true],
    ['1.9.0', '1.10.0', true],
    ['0.99.99', '1.0.0', true],
    ['1.33.0', '1.33.0', false],
    ['1.33.1', '1.33.0', false],
    ['1.10.0', '1.9.0', false],
    ['2.0.0', '1.99.0', false],
  ])('running %s, minimum %s: %s', (running, minimum, expected) => {
    expect(isBelowMinimum(running, minimum)).toBe(expected);
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['a number', 1.33],
    ['two parts', '1.33'],
    ['text', 'latest'],
    ['a pre-release tag', '1.33.0-beta'],
    ['empty', ''],
  ])('a minimum that cannot be read (%s) never blocks', (_label, minimum) => {
    expect(isBelowMinimum('1.0.0', minimum)).toBe(false);
  });

  it('spaces around a valid minimum are tolerated', () => {
    expect(isBelowMinimum('1.32.0', ' 1.33.0 ')).toBe(true);
  });

  it('a running version that cannot be read never blocks', () => {
    expect(isBelowMinimum('dev', '1.33.0')).toBe(false);
  });
});

describe('describeMinVersionStatus (the diagnostic line)', () => {
  const base = { running: '1.33.2', blocked: false, lastCheck: null, formatTime: () => '14:03:00' };

  it.each([
    [undefined, false, 'מינימום: אין'],
    ['1.33.1', false, 'מינימום: 1.33.1 ·'],
    ['1.34.0', true, 'מינימום: 1.34.0 (חוסם)'],
    // מה שהבעלים עלול להקליד במסוף - מוצג כמו שהוא, כדי שיראה למה לא חסם
    ['"1.33.1"', false, 'מינימום: "\\"1.33.1\\"" (לא תקין, לא חוסם)'],
    [1.34, false, 'מינימום: 1.34 (לא תקין, לא חוסם)'],
  ])('minimum %j', (raw, blocked, expected) => {
    expect(describeMinVersionStatus({ ...base, raw, blocked })).toContain(expected);
  });

  it('says whether and when the server was read', () => {
    expect(describeMinVersionStatus({ ...base, raw: undefined })).toContain('עוד לא נבדק מהשרת');
    expect(describeMinVersionStatus({ ...base, raw: undefined, lastCheck: { ok: true, at: 1 } })).toContain(
      'נבדק מהשרת ב-14:03:00'
    );
    expect(describeMinVersionStatus({ ...base, raw: undefined, lastCheck: { ok: false, at: 1 } })).toContain(
      'בדיקה נכשלה ב-14:03:00'
    );
  });
});
