/**
 * עריכות של Claude (שלב 2ב-lite): איך השינוי מוחל על הגרסה העדכנית. בלי Firestore.
 */

import { describe, expect, it } from 'vitest';
import {
  buildAppendEdit,
  buildChecklistItemEdit,
  buildChecklistItemsEdit,
  type ChecklistItemChange,
} from '../src/mcp/editNote';
import { InvalidError } from '../src/notesCore/errors';
import type { NoteRecord } from '../src/notesCore/model';

// 1 באוקטובר 2026, 12:00 בישראל
const NOW = new Date('2026-10-01T09:00:00Z');

const note = (content: unknown, templateType = 'checklist'): NoteRecord => ({
  id: 'n1',
  title: 'משימות',
  content: typeof content === 'string' ? content : JSON.stringify(content),
  categoryId: 'c1',
  templateType,
  tags: [],
  color: null,
  order: 0,
  userId: 'u1',
  sharedWith: [],
  isPinned: false,
  isArchived: false,
  isSensitive: false,
  isReadOnly: false,
  createdVia: null,
  revision: 3,
  createdAt: null,
  updatedAt: null,
  archivedAt: null,
  updatedBy: null,
});

const apply = (change: ChecklistItemChange, content: unknown) => buildChecklistItemEdit(change, NOW).apply(note(content));
const rowsOf = (outcome: ReturnType<typeof apply>) => JSON.parse(outcome!.content ?? '');

const list = [
  { id: 'a', text: 'לקנות חלב', completed: false, priority: 2 },
  { id: 'b', text: 'לשלם חשמל', completed: false, dueDate: '2026-10-05', dueTime: '09:30', repeat: 'monthly' },
];

describe('update_checklist_item', () => {
  it('marks one task done and leaves every other task and unknown field as it was', () => {
    const outcome = apply({ itemId: 'a', completed: true }, list);
    expect(rowsOf(outcome)).toEqual([{ ...list[0], completed: true }, list[1]]);
    expect(outcome?.before).toEqual(list[0]);
    expect(outcome?.after).toEqual({ ...list[0], completed: true });
    expect(outcome?.description).toContain('סומנה כבוצעה');
  });

  it('changes the date and time of a task', () => {
    const outcome = apply({ itemId: 'b', dueDate: '2026-10-07', dueTime: '18:00' }, list);
    expect(rowsOf(outcome)[1]).toMatchObject({ dueDate: '2026-10-07', dueTime: '18:00', repeat: 'monthly' });
    expect(outcome?.description).toContain('מועד: 2026-10-07 18:00');
  });

  it('removing the date removes the time and the repeat too', () => {
    const row = rowsOf(apply({ itemId: 'b', dueDate: null }, list))[1];
    expect(row).not.toHaveProperty('dueDate');
    expect(row).not.toHaveProperty('dueTime');
    expect(row).not.toHaveProperty('repeat');
  });

  it('removing the time keeps the date and drops the repeat', () => {
    const row = rowsOf(apply({ itemId: 'b', dueTime: null }, list))[1];
    expect(row).toMatchObject({ dueDate: '2026-10-05' });
    expect(row).not.toHaveProperty('dueTime');
    expect(row).not.toHaveProperty('repeat');
  });

  it('sets and stops a repeat', () => {
    expect(rowsOf(apply({ itemId: 'b', repeat: 'weekly' }, list))[1].repeat).toBe('weekly');
    expect(rowsOf(apply({ itemId: 'b', repeat: null }, list))[1]).not.toHaveProperty('repeat');
  });

  it('refuses a new time that already passed, but marking done ignores the time', () => {
    expect(() => apply({ itemId: 'a', dueDate: '2026-09-30', dueTime: '09:00' }, list)).toThrow('has already passed');
    const past = [{ id: 'p', text: 'x', completed: false, dueDate: '2026-09-01', dueTime: '09:00' }];
    expect(rowsOf(apply({ itemId: 'p', completed: true }, past))[0].completed).toBe(true);
  });

  it('a new date, or stopping the repeat, drops repeatBase; other changes keep it', () => {
    const clamped = [{ id: 'r', text: 'שכר דירה', completed: false, dueDate: '2026-11-30', dueTime: '09:00', repeat: 'monthly', repeatBase: '2026-10-31' }];
    expect(rowsOf(apply({ itemId: 'r', dueDate: '2026-12-10' }, clamped))[0]).not.toHaveProperty('repeatBase');
    expect(rowsOf(apply({ itemId: 'r', repeat: null }, clamped))[0]).not.toHaveProperty('repeatBase');
    expect(rowsOf(apply({ itemId: 'r', text: 'שכירות' }, clamped))[0].repeatBase).toBe('2026-10-31');
  });

  it('sets and clears a priority; normal and null both clear it', () => {
    const urgent = apply({ itemId: 'b', priority: 'urgent' }, list);
    expect(rowsOf(urgent)[1].priority).toBe('urgent');
    expect(urgent?.description).toContain('עדיפות: דחוף');
    const marked = [list[0], { ...list[1], priority: 'urgent' }];
    expect(rowsOf(apply({ itemId: 'b', priority: 'normal' }, marked))[1]).not.toHaveProperty('priority');
    expect(rowsOf(apply({ itemId: 'b', priority: null }, marked))[1]).not.toHaveProperty('priority');
    // כבר רגילה: אין מה לכתוב
    expect(apply({ itemId: 'b', priority: 'normal' }, list)).toBeNull();
  });

  it('a change to values the task already has writes nothing', () => {
    expect(apply({ itemId: 'a', completed: false }, list)).toBeNull();
  });

  it('old tasks without ids: shows item-<n>, and saves those ids with the first edit', () => {
    const old = [{ text: 'ישן 1', completed: false }, { text: 'ישן 2', completed: false, legacy: true }];
    const rows = rowsOf(apply({ itemId: 'item-1', completed: true }, old));
    expect(rows).toEqual([
      { text: 'ישן 1', completed: false, id: 'item-0' },
      { text: 'ישן 2', completed: true, legacy: true, id: 'item-1' },
    ]);
  });

  it.each([
    ['an unknown item id', { itemId: 'zzz', completed: true }, list, 'Call get_note to see the current item ids'],
    ['two items with the same id', { itemId: 'a', completed: true }, [list[0], { ...list[1], id: 'a' }], 'several items share'],
    ['a note that is not a checklist', { itemId: 'a', completed: true }, 'plain text', 'not a checklist'],
    ['an empty text', { itemId: 'a', text: '  ' }, list, 'text is empty'],
    ['no change at all', { itemId: 'a' }, list, 'nothing to change'],
    ['a time without a date', { itemId: 'a', dueTime: '10:00' }, list, 'dueTime needs a dueDate'],
  ])('refuses %s with a message Claude can act on', (_label, change, content, message) => {
    const run = () =>
      buildChecklistItemEdit(change as ChecklistItemChange, NOW).apply(
        note(content, typeof content === 'string' ? 'plain' : 'checklist')
      );
    expect(run).toThrow(InvalidError);
    expect(run).toThrow(message);
  });
});

describe('update_checklist_items', () => {
  const batch = (changes: ChecklistItemChange[], content: unknown = list) =>
    buildChecklistItemsEdit(changes, NOW).apply(note(content));

  it('applies every update in one edit, with each changed task before and after for the audit', () => {
    const outcome = batch([
      { itemId: 'a', completed: true },
      { itemId: 'b', dueDate: '2026-10-07', text: 'לשלם חשמל ומים' },
    ]);
    expect(rowsOf(outcome)).toEqual([
      { ...list[0], completed: true },
      { ...list[1], dueDate: '2026-10-07', text: 'לשלם חשמל ומים' },
    ]);
    expect(outcome?.before).toEqual(list);
    expect(outcome?.after).toEqual(rowsOf(outcome));
    expect(outcome?.description).toMatch(/^עודכנו 2 משימות: /);
  });

  it('each update does exactly what update_checklist_item does', () => {
    const changes: ChecklistItemChange[] = [
      { itemId: 'a', completed: true },
      { itemId: 'b', dueTime: null },
    ];
    const one = changes.reduce<unknown>((content, change) => rowsOf(apply(change, content)), list);
    expect(rowsOf(batch(changes))).toEqual(one);
  });

  it('sets priorities on several tasks at once', () => {
    const rows = rowsOf(batch([{ itemId: 'a', priority: 'low' }, { itemId: 'b', priority: 'urgent' }]));
    expect(rows.map((row: { priority?: string }) => row.priority)).toEqual(['low', 'urgent']);
  });

  it('updates that change nothing are left out; when none change, nothing is written', () => {
    const outcome = batch([
      { itemId: 'a', completed: false },
      { itemId: 'b', completed: true },
    ]);
    expect(outcome?.after).toEqual([{ ...list[1], completed: true }]);
    expect(outcome?.description).toContain('סומנה כבוצעה');
    expect(batch([{ itemId: 'a', completed: false }])).toBeNull();
  });

  it('old tasks without ids keep the ids get_note showed', () => {
    const old = [{ text: 'ישן 1', completed: false }, { text: 'ישן 2', completed: false }];
    expect(rowsOf(batch([{ itemId: 'item-0', completed: true }, { itemId: 'item-1', completed: true }], old))).toEqual([
      { text: 'ישן 1', completed: true, id: 'item-0' },
      { text: 'ישן 2', completed: true, id: 'item-1' },
    ]);
  });

  it('the activity description lists the first five changes and counts the rest', () => {
    const many = Array.from({ length: 8 }, (_, index) => ({ id: `t${index}`, text: `משימה ${index}`, completed: false }));
    const outcome = batch(many.map((row) => ({ itemId: row.id, completed: true })), many);
    expect(outcome?.description).toMatch(/^עודכנו 8 משימות: /);
    expect(outcome?.description).toContain('ועוד 3');
  });

  it.each([
    ['an unknown item id in the middle', [{ itemId: 'a', completed: true }, { itemId: 'zzz', completed: true }], 'update 2 (item "zzz"): there is no item'],
    ['a time that already passed', [{ itemId: 'a', dueDate: '2026-09-30', dueTime: '09:00' }], 'update 1 (item "a")'],
    ['an empty text', [{ itemId: 'b', completed: true }, { itemId: 'a', text: ' ' }], 'update 2 (item "a"): text is empty'],
    ['the same task twice', [{ itemId: 'a', completed: true }, { itemId: 'a', text: 'x' }], 'updates 1 and 2 are both for item "a"'],
    ['no updates', [], 'give at least one update'],
    ['too many updates', Array.from({ length: 51 }, (_, index) => ({ itemId: `x${index}`, completed: true })), 'the limit is 50'],
  ])('refuses the whole batch for %s', (_label, changes, message) => {
    const run = () => batch(changes as ChecklistItemChange[]);
    expect(run).toThrow(InvalidError);
    expect(run).toThrow(message);
  });

  it('refuses a note that is not a checklist', () => {
    expect(() => buildChecklistItemsEdit([{ itemId: 'a', completed: true }], NOW).apply(note('x', 'plain'))).toThrow(
      'not a checklist'
    );
  });
});

describe('append_to_text_note', () => {
  const append = (text: string, content: string, templateType = 'plain') =>
    buildAppendEdit(text).apply(note(content, templateType));

  it('adds the text on a new line at the end, and changes nothing before it', () => {
    const outcome = append('שורה חדשה', 'שורה ראשונה');
    expect(outcome?.content).toBe('שורה ראשונה\nשורה חדשה');
    expect(outcome?.after).toEqual({ contentLength: outcome!.content!.length, appended: 'שורה חדשה' });
  });

  it('does not add a second newline, and fills an empty note', () => {
    expect(append('ב', 'א\n')?.content).toBe('א\nב');
    expect(append('ב', '')?.content).toBe('ב');
  });

  it('keeps the existing text byte for byte, including trailing spaces', () => {
    expect(append('ב', 'א  ')?.content).toBe('א  \nב');
  });

  it('refuses a checklist (text notes and work plans only)', () => {
    expect(() => append('x', '[]', 'checklist')).toThrow('append_text works on text notes and work plans');
  });

  it('the same text gives the same fingerprint, so a retry is not added twice', () => {
    expect(buildAppendEdit('abc').fingerprint).toBe(buildAppendEdit('abc  ').fingerprint);
    expect(buildAppendEdit('abc').fingerprint).not.toBe(buildAppendEdit('abd').fingerprint);
  });

  it('refuses empty text, and text that is too long', () => {
    expect(() => buildAppendEdit('   ')).toThrow('text is empty');
    expect(() => buildAppendEdit('x'.repeat(10_001))).toThrow('the limit is 10000');
  });
});
