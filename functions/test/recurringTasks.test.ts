/**
 * משימות חוזרות שסומנו כבוצעו: המועד הבא, ומה מאופס. בלי Firestore.
 * מקצה לקצה (טריגר, תזכורות, MCP): `test-emulator/recurringTasks.emulator.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { isClampedOccurrence } from '../src/recurrence';
import { nextDueAfterDone, resetRecurringTasks, seriesBase } from '../src/recurringTasks';
import { localDateTimeToDate } from '../src/timezone';

const task = (fields: Record<string, unknown>) => ({ id: 't', text: 'משימה', completed: true, dueTime: '09:00', ...fields });
const next = (fields: Record<string, unknown>, now: string) => nextDueAfterDone(task(fields), new Date(now));

describe('nextDueAfterDone', () => {
  it('daily, done after the time: tomorrow at the same local time', () => {
    expect(next({ dueDate: '2026-05-10', repeat: 'daily' }, '2026-05-10T07:00:00Z')).toMatchObject({
      dueDate: '2026-05-11',
      repeatBase: undefined,
    });
  });

  it('done early: moves past the current due date, not onto it', () => {
    expect(next({ dueDate: '2026-05-12', repeat: 'daily' }, '2026-05-10T07:00:00Z')?.dueDate).toBe('2026-05-13');
    expect(next({ dueDate: '2026-05-12', repeat: 'weekly' }, '2026-05-10T07:00:00Z')?.dueDate).toBe('2026-05-19');
  });

  it('done late: skips what was missed, to the next one still ahead', () => {
    // 08:00 בישראל: היום ב-09:00 עוד לפנינו
    expect(next({ dueDate: '2026-05-01', repeat: 'daily' }, '2026-05-10T05:00:00Z')?.dueDate).toBe('2026-05-10');
    expect(next({ dueDate: '2026-05-01', repeat: 'daily' }, '2026-05-10T07:00:00Z')?.dueDate).toBe('2026-05-11');
  });

  it('DST ends (Oct 25 2026): 09:00 stays 09:00 local, one hour later in UTC', () => {
    const due = next({ dueDate: '2026-10-24', repeat: 'daily' }, '2026-10-24T07:30:00Z');
    expect(due?.dueDate).toBe('2026-10-25');
    expect(due?.at.toISOString()).toBe('2026-10-25T07:00:00.000Z');
  });

  it('DST starts (Mar 27 2026): 09:00 stays 09:00 local, one hour earlier in UTC', () => {
    const due = next({ dueDate: '2026-03-24', repeat: 'weekly' }, '2026-03-24T08:00:00Z');
    expect(due?.dueDate).toBe('2026-03-31');
    expect(due?.at.toISOString()).toBe('2026-03-31T06:00:00.000Z');
  });

  it('a time that does not exist on the spring-forward day still gives that day', () => {
    const due = next({ dueDate: '2026-03-26', dueTime: '02:30', repeat: 'daily' }, '2026-03-26T01:00:00Z');
    expect(due?.dueDate).toBe('2026-03-27');
    expect(due?.at.toISOString()).toBe(localDateTimeToDate('2026-03-27', '02:30')?.toISOString());
  });

  it('monthly on the 31st: clamped to Feb 28 keeps the base, and comes back to the 31st', () => {
    const feb = next({ dueDate: '2026-01-31', repeat: 'monthly' }, '2026-01-31T08:00:00Z');
    expect(feb).toMatchObject({ dueDate: '2026-02-28', repeatBase: '2026-01-31' });
    const mar = next({ dueDate: '2026-02-28', repeatBase: '2026-01-31', repeat: 'monthly' }, '2026-02-28T08:00:00Z');
    expect(mar).toMatchObject({ dueDate: '2026-03-31', repeatBase: undefined });
  });

  it('yearly on Feb 29: Feb 28 in a common year, with the base kept', () => {
    expect(next({ dueDate: '2028-02-29', repeat: 'yearly' }, '2028-02-29T08:00:00Z')).toMatchObject({
      dueDate: '2029-02-28',
      repeatBase: '2028-02-29',
    });
  });

  it('a base that no longer matches the due date (changed by hand) is ignored', () => {
    const row = task({ dueDate: '2026-02-20', repeatBase: '2026-01-31', repeat: 'monthly' });
    expect(seriesBase(row)).toBe('2026-02-20');
    expect(nextDueAfterDone(row, new Date('2026-02-20T08:00:00Z'))?.dueDate).toBe('2026-03-20');
  });

  it.each([
    ['no repeat', { dueDate: '2026-05-10' }],
    ['no time', { dueDate: '2026-05-10', dueTime: undefined, repeat: 'daily' }],
    ['no date', { repeat: 'daily' }],
    ['an unknown rule', { dueDate: '2026-05-10', repeat: 'hourly' }],
  ])('a task with %s does not repeat', (_label, fields) => {
    expect(next(fields, '2026-05-10T07:00:00Z')).toBeNull();
  });
});

describe('isClampedOccurrence', () => {
  it.each([
    ['2026-01-31', '2026-02-28', 'monthly', true],
    ['2026-01-31', '2026-04-30', 'monthly', true],
    ['2026-01-31', '2026-03-31', 'monthly', true],
    ['2026-01-31', '2026-02-20', 'monthly', false],
    ['2026-01-31', '2025-12-31', 'monthly', false],
    ['2028-02-29', '2029-02-28', 'yearly', true],
    ['2028-02-29', '2029-03-28', 'yearly', false],
    ['2026-01-31', '2026-02-28', 'daily', false],
  ] as const)('base %s, date %s, %s: %s', (base, date, rule, expected) => {
    expect(isClampedOccurrence(base, date, rule)).toBe(expected);
  });
});

describe('resetRecurringTasks', () => {
  const NOW = new Date('2026-05-10T07:00:00Z');
  const rows = (...items: Record<string, unknown>[]) => JSON.stringify(items);
  const daily = { id: 'd', text: 'תרופה', completed: false, dueDate: '2026-05-10', dueTime: '09:00', repeat: 'daily', note: 'שדה לא מוכר' };
  const once = { id: 'o', text: 'חד-פעמית', completed: false, dueDate: '2026-05-10', dueTime: '09:00' };

  it('resets only the repeating task that was just marked done, keeping its other fields', () => {
    const before = rows(daily, once);
    const after = rows({ ...daily, completed: true }, { ...once, completed: true });
    const reset = resetRecurringTasks(before, after, after, NOW);
    expect(reset?.resets).toEqual([{ itemId: 'd', dueDate: '2026-05-11' }]);
    expect(JSON.parse(reset!.content)).toEqual([{ ...daily, dueDate: '2026-05-11' }, { ...once, completed: true }]);
  });

  it('does nothing when nothing was marked done in this write', () => {
    const doneLongAgo = { ...daily, completed: true };
    const before = rows(doneLongAgo, once);
    const after = rows(doneLongAgo, { ...once, text: 'נערך' });
    expect(resetRecurringTasks(before, after, after, NOW)).toBeNull();
  });

  it('a repeating task added already done stays done', () => {
    expect(resetRecurringTasks(rows(once), rows(once, { ...daily, completed: true }), rows(once, { ...daily, completed: true }), NOW)).toBeNull();
  });

  it('the user wins: unchecked again, or a new date, in the newest version - no reset', () => {
    const before = rows(daily);
    const after = rows({ ...daily, completed: true });
    expect(resetRecurringTasks(before, after, rows(daily), NOW)).toBeNull();
    expect(resetRecurringTasks(before, after, rows({ ...daily, completed: true, dueDate: '2026-06-01' }), NOW)).toBeNull();
  });

  it('works on the newest version: a later edit to another task is kept', () => {
    const before = rows(daily, once);
    const after = rows({ ...daily, completed: true }, once);
    const current = rows({ ...daily, completed: true }, { ...once, text: 'נערך אחר כך' });
    expect(JSON.parse(resetRecurringTasks(before, after, current, NOW)!.content)[1].text).toBe('נערך אחר כך');
  });

  it('old tasks without ids are matched by position, like everywhere else', () => {
    const { id: _id, ...noId } = daily;
    const reset = resetRecurringTasks(rows(noId), rows({ ...noId, completed: true }), rows({ ...noId, completed: true }), NOW);
    expect(reset?.resets).toEqual([{ itemId: 'item-0', dueDate: '2026-05-11' }]);
    expect(JSON.parse(reset!.content)[0]).not.toHaveProperty('id');
  });

  it('the reset write itself does not reset again (no loop)', () => {
    const after = rows({ ...daily, completed: true });
    const reset = resetRecurringTasks(rows(daily), after, after, NOW)!;
    expect(resetRecurringTasks(after, reset.content, reset.content, NOW)).toBeNull();
  });
});
