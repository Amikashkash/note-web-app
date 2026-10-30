/**
 * מיזוג לפי שדה (צעד 3 בסבב 2): `mergeItem` לכל צירוף של שדות, ומקרי
 * המשימה החוזרת מול הטריגר בשרת. המיזוג ברמת הרשימה (פריטים שונים, סדר,
 * מחיקה) - ב-`noteSync.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { mergeItem, mergeNote, REPORTABLE_FIELDS } from './noteMerge';

type Row = Record<string, unknown>;

/**
 * לכל שדה: ערך בבסיס, ושני ערכים חדשים שונים זה מזה ומהבסיס. `undefined` =
 * השדה חסר (או נמחק). `completed` בוליאני: יש לו רק ערך חדש אחד.
 */
interface FieldSpec {
  base: unknown;
  a: unknown;
  b?: unknown;
}

const CHECKLIST: Record<string, FieldSpec> = {
  text: { base: 'חלב', a: 'חלב סויה', b: 'חלב 3%' },
  completed: { base: false, a: true },
  dueDate: { base: '2026-11-01', a: '2026-11-02', b: undefined },
  dueTime: { base: '09:00', a: '10:00', b: undefined },
  repeat: { base: undefined, a: 'weekly', b: 'monthly' },
  repeatBase: { base: undefined, a: '2026-01-31', b: '2026-03-31' },
  priority: { base: undefined, a: 'urgent', b: 'low' },
};

/** אותם שדות, כשהמשימה חוזרת כבר בבסיס */
const RECURRING: Record<string, FieldSpec> = {
  ...CHECKLIST,
  repeat: { base: 'daily', a: 'weekly', b: undefined },
  repeatBase: { base: '2026-01-31', a: undefined, b: '2026-03-31' },
};

const SHOPPING: Record<string, FieldSpec> = {
  name: { base: 'חלב', a: 'חלב סויה', b: 'חלב 3%' },
  quantity: { base: '1', a: '2', b: '' },
  checked: { base: false, a: true },
};

const WORKPLAN: Record<string, FieldSpec> = {
  header: { base: 'שלב א', a: 'שלב 1', b: 'הכנה' },
  content: { base: 'לקנות', a: 'לקנות היום', b: 'להזמין' },
};

const ACCOUNTING: Record<string, FieldSpec> = {
  description: { base: 'חשמל', a: 'חשמל נובמבר', b: 'חברת החשמל' },
  amount: { base: 120, a: 130, b: 0 },
  date: { base: '2026-11-01', a: '2026-11-02', b: '' },
};

const SCHEDULE = new Set(['dueDate', 'dueTime', 'repeat', 'repeatBase']);

const rowOf = (specs: Record<string, FieldSpec>, changes: Record<string, unknown> = {}): Row => {
  const row: Row = { id: 'x' };
  for (const [field, spec] of Object.entries(specs)) {
    const value = field in changes ? changes[field] : spec.base;
    if (value !== undefined) row[field] = value;
  }
  return row;
};

/** היחידה של שדה, לפי הכלל שבתיעוד של `mergeItem` - כתוב כאן בנפרד, כמפרט */
const unitOf = (field: string, recurring: boolean) =>
  SCHEDULE.has(field) || (field === 'completed' && recurring) ? 'schedule' : field;

const strip = (row: Row) => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));

describe.each([
  ['checklist, one-off task', CHECKLIST],
  ['checklist, recurring task', RECURRING],
  ['shopping', SHOPPING],
  ['workplan', WORKPLAN],
  ['accounting', ACCOUNTING],
])('mergeItem: every pair of fields - %s', (_name, specs) => {
  const fields = Object.keys(specs);
  const pairs = fields.flatMap((local) => fields.map((remote) => [local, remote] as const));

  it.each(pairs)('local changed %s, remote changed %s', (localField, remoteField) => {
    const base = rowOf(specs);
    const local = rowOf(specs, { [localField]: specs[localField].a });
    // אותו שדה: הערך השני (`b`), אם יש. `b: undefined` = הצד השני מחק את השדה
    const remoteValue = localField === remoteField && 'b' in specs[remoteField] ? specs[remoteField].b : specs[remoteField].a;
    const remote = rowOf(specs, { [remoteField]: remoteValue });
    const recurring = [base, local, remote].some((row) => typeof row.repeat === 'string');

    const result = mergeItem(base, local, remote);
    const sameValue = localField === remoteField && !('b' in specs[localField]);

    if (localField === remoteField && !sameValue) {
      // אותו שדה, ערכים שונים: בחירה, כמו היום
      expect(result).toEqual({
        conflict: {
          reason: unitOf(localField, recurring) === 'schedule' ? 'schedule' : 'same-field',
          fields: [localField],
        },
      });
    } else if (localField !== remoteField && unitOf(localField, recurring) === unitOf(remoteField, recurring)) {
      // שדות שונים באותה יחידה תלויה: בחירה
      expect(result).toEqual({ conflict: { reason: 'schedule', fields: [localField, remoteField] } });
    } else {
      // שדות עצמאיים (או אותו ערך בשני הצדדים): שניהם נשמרים
      expect(result).toEqual({
        item: strip({ ...base, [remoteField]: remoteValue, [localField]: specs[localField].a }),
      });
    }
  });
});

describe('mergeItem: details', () => {
  it('both sides made the same change: merged, no conflict', () => {
    const base = { id: 'x', text: 'חלב', completed: false };
    const both = { id: 'x', text: 'חלב סויה', completed: false };
    expect(mergeItem(base, both, { ...both })).toEqual({ item: both });
  });

  it('a field removed on one side stays removed while the other side changes another field', () => {
    const base = { id: 'x', text: 'חלב', completed: false, priority: 'urgent' };
    const local = { id: 'x', text: 'חלב', completed: false };
    const remote = { id: 'x', text: 'חלב סויה', completed: false, priority: 'urgent' };
    expect(mergeItem(base, local, remote)).toEqual({ item: { id: 'x', text: 'חלב סויה', completed: false } });
  });

  it('removed on one side and changed on the other is the same field: a conflict', () => {
    const base = { id: 'x', text: 'חלב', completed: false, priority: 'urgent' };
    const local = { id: 'x', text: 'חלב', completed: false };
    const remote = { id: 'x', text: 'חלב', completed: false, priority: 'low' };
    expect(mergeItem(base, local, remote)).toEqual({ conflict: { reason: 'same-field', fields: ['priority'] } });
  });

  it('keeps the server key order, then fields new on the local side', () => {
    const base = { id: 'x', completed: false, text: 'חלב' };
    const local = { id: 'x', completed: true, text: 'חלב', priority: 'urgent' };
    const remote = { text: 'חלב סויה', id: 'x', completed: false };
    const result = mergeItem(base, local, remote);
    expect('item' in result && Object.keys(result.item)).toEqual(['text', 'id', 'completed', 'priority']);
  });

  it('an unknown field merges like any independent field, and is reported only as "other"', () => {
    const base = { id: 'x', text: 'חלב', futureField: 1 };
    expect(mergeItem(base, { ...base, futureField: 2 }, { ...base, text: 'לחם' })).toEqual({
      item: { id: 'x', text: 'לחם', futureField: 2 },
    });
    expect(mergeItem(base, { ...base, futureField: 2 }, { ...base, futureField: 3 })).toEqual({
      conflict: { reason: 'same-field', fields: ['other'] },
    });
  });

  it('every field name a conflict can report is in the closed list the rules accept', () => {
    for (const specs of [CHECKLIST, SHOPPING, WORKPLAN, ACCOUNTING]) {
      for (const field of Object.keys(specs)) expect(REPORTABLE_FIELDS).toContain(field);
    }
  });
});

// ---------------------------------------------------------------------------
// מקרים מהחיים, דרך `mergeNote`
// ---------------------------------------------------------------------------

const note = (items: Row[]) => ({ title: 'משימות', content: JSON.stringify(items) });
const merge = (base: Row[], local: Row[], remote: Row[]) => mergeNote(note(base), note(local), note(remote), 'checklist');
const items = (result: ReturnType<typeof merge>) => ('merged' in result ? JSON.parse(result.merged.content) : null);

const task = { id: 't', text: 'לשלם חשמל', completed: false, dueDate: '2026-11-01', dueTime: '09:00' };
const daily = { ...task, repeat: 'daily' };

describe('real cases: one-off tasks', () => {
  it('one side marks done, the other moves the due date: both kept (the example from the task)', () => {
    expect(items(merge([task], [{ ...task, completed: true }], [{ ...task, dueDate: '2026-11-05' }]))).toEqual([
      { ...task, completed: true, dueDate: '2026-11-05' },
    ]);
  });

  it('one side marks done, the other edits the text', () => {
    expect(items(merge([task], [{ ...task, text: 'לשלם חשמל ומים' }], [{ ...task, completed: true }]))).toEqual([
      { ...task, text: 'לשלם חשמל ומים', completed: true },
    ]);
  });

  it('one side sets priority, the other the due time', () => {
    expect(items(merge([task], [{ ...task, priority: 'urgent' }], [{ ...task, dueTime: '18:00' }]))).toEqual([
      { ...task, dueTime: '18:00', priority: 'urgent' },
    ]);
  });

  it('both edit the text differently: the choice panel, as today', () => {
    expect(merge([task], [{ ...task, text: 'א' }], [{ ...task, text: 'ב' }])).toEqual({
      conflict: { reason: 'same-field', fields: ['text'] },
    });
  });

  it('one side moves the date, the other clears the time (the editor clears repeat with it): a choice', () => {
    expect(merge([task], [{ ...task, dueDate: '2026-11-05' }], [{ ...task, dueTime: undefined }])).toEqual({
      conflict: { reason: 'schedule', fields: ['dueDate', 'dueTime'] },
    });
  });

  it('one side turns on repeat, the other moves the date: a choice (no mixed schedule)', () => {
    expect(merge([task], [{ ...task, repeat: 'weekly' }], [{ ...task, dueDate: '2026-11-05' }])).toEqual({
      conflict: { reason: 'schedule', fields: ['repeat', 'dueDate'] },
    });
  });

  it('one item merged by field and another in real conflict: the whole note goes to the choice', () => {
    const other = { id: 'o', text: 'לחם', completed: false };
    expect(
      merge([task, other], [{ ...task, completed: true }, { ...other, text: 'א' }], [{ ...task, text: 'ב' }, { ...other, text: 'ב' }])
    ).toEqual({ conflict: { reason: 'same-field', fields: ['text'] } });
  });
});

describe('real cases: recurring tasks and the server reset', () => {
  /** מה הטריגר כותב אחרי סימון: לא בוצעה, והמועד הבא */
  const reset = { ...daily, completed: false, dueDate: '2026-11-02' };

  it('the user edits the text while the other device marked done and the server reset it: merged', () => {
    expect(items(merge([daily], [{ ...daily, text: 'לשלם חשמל ומים' }], [reset]))).toEqual([
      { ...reset, text: 'לשלם חשמל ומים' },
    ]);
  });

  it('our own mark was reset by the server while we kept editing the text: merged, not a conflict', () => {
    // הבסיס: הכתיבה שלנו שאושרה (בוצעה). השרת: האיפוס שלה. מקומית: המשך עריכת טקסט
    const marked = { ...daily, completed: true };
    expect(items(merge([marked], [{ ...marked, text: 'חדש' }], [reset]))).toEqual([{ ...reset, text: 'חדש' }]);
  });

  it('both devices marked the same occurrence done: a choice, never a second advance', () => {
    // מיזוג לפי שדה היה כותב completed: true עם 2026-11-02, והטריגר היה מקדם ל-11-03
    expect(merge([daily], [{ ...daily, completed: true }], [reset])).toEqual({
      conflict: { reason: 'schedule', fields: ['completed', 'dueDate'] },
    });
  });

  it('marked done on one side, the date moved by hand on the other: a choice', () => {
    expect(merge([daily], [{ ...daily, completed: true }], [{ ...daily, dueDate: '2026-11-10' }])).toEqual({
      conflict: { reason: 'schedule', fields: ['completed', 'dueDate'] },
    });
  });

  it('marked done on one side, priority on the other: merged, and the server resets as usual after', () => {
    expect(items(merge([daily], [{ ...daily, completed: true }], [{ ...daily, priority: 'urgent' }]))).toEqual([
      { ...daily, completed: true, priority: 'urgent' },
    ]);
  });

  it('marked done on one side, repeat turned off on the other: a choice', () => {
    expect(merge([daily], [{ ...daily, completed: true }], [{ ...daily, repeat: undefined }])).toEqual({
      conflict: { reason: 'schedule', fields: ['completed', 'repeat'] },
    });
  });

  it('a reset that also set repeatBase merges with a text edit, keeping the base', () => {
    const monthly = { ...task, dueDate: '2026-01-31', repeat: 'monthly' };
    const clamped = { ...monthly, dueDate: '2026-02-28', repeatBase: '2026-01-31' };
    expect(items(merge([monthly], [{ ...monthly, text: 'שכר דירה' }], [clamped]))).toEqual([
      { ...clamped, text: 'שכר דירה' },
    ]);
  });

  it('one side turned a one-off task into a recurring one, the other marked it done: a choice', () => {
    expect(merge([task], [{ ...task, repeat: 'daily' }], [{ ...task, completed: true }])).toEqual({
      conflict: { reason: 'schedule', fields: ['repeat', 'completed'] },
    });
  });
});

describe('mergeNote: conflict reasons outside items', () => {
  it('title changed differently on both sides', () => {
    expect(mergeNote({ title: 'א', content: '' }, { title: 'ב', content: '' }, { title: 'ג', content: '' }, 'plain')).toEqual({
      conflict: { reason: 'title', fields: [] },
    });
  });

  it('free text edited on both sides', () => {
    expect(mergeNote({ title: 't', content: 'א' }, { title: 't', content: 'אב' }, { title: 't', content: 'אג' }, 'plain')).toEqual({
      conflict: { reason: 'text', fields: [] },
    });
  });
});
