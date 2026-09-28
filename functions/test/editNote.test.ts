/**
 * עריכות של Claude (שלב 2ב-lite): איך השינוי מוחל על הגרסה העדכנית. בלי Firestore.
 */

import { describe, expect, it } from 'vitest';
import { buildAppendEdit, buildChecklistItemEdit, type ChecklistItemChange } from '../src/mcp/editNote';
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
const rowsOf = (outcome: ReturnType<typeof apply>) => JSON.parse(outcome!.content);

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

describe('append_to_text_note', () => {
  const append = (text: string, content: string, templateType = 'plain') =>
    buildAppendEdit(text).apply(note(content, templateType));

  it('adds the text on a new line at the end, and changes nothing before it', () => {
    const outcome = append('שורה חדשה', 'שורה ראשונה');
    expect(outcome?.content).toBe('שורה ראשונה\nשורה חדשה');
    expect(outcome?.after).toEqual({ contentLength: outcome!.content.length, appended: 'שורה חדשה' });
  });

  it('does not add a second newline, and fills an empty note', () => {
    expect(append('ב', 'א\n')?.content).toBe('א\nב');
    expect(append('ב', '')?.content).toBe('ב');
  });

  it('keeps the existing text byte for byte, including trailing spaces', () => {
    expect(append('ב', 'א  ')?.content).toBe('א  \nב');
  });

  it('refuses a note that is not a text note', () => {
    expect(() => append('x', '[]', 'checklist')).toThrow('not a text note');
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
