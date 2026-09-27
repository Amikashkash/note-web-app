/**
 * `create_note`: ולידציה, תוכן שנבנה, תזכורות ו-fingerprint. בלי Firestore.
 */

import { describe, expect, it } from 'vitest';
import { buildNote, type CreateNoteInput } from '../src/mcp/createNote';
import { InvalidError } from '../src/notesCore/errors';

// 1 באוקטובר 2026, 12:00 בישראל (UTC+3)
const NOW = new Date('2026-10-01T09:00:00Z');

const checklist = (items: CreateNoteInput['items']): CreateNoteInput => ({
  categoryId: 'c1',
  title: 'משימות',
  type: 'checklist',
  items,
});

const error = (input: CreateNoteInput): string => {
  try {
    buildNote(input, NOW);
  } catch (caught) {
    expect(caught).toBeInstanceOf(InvalidError);
    return (caught as Error).message;
  }
  throw new Error('expected an InvalidError');
};

describe('content in the app format', () => {
  it('a text note keeps its text', () => {
    const { draft } = buildNote({ categoryId: 'c1', title: '  רעיון  ', type: 'text', text: 'שורה\nשנייה' }, NOW);
    expect(draft).toMatchObject({ title: 'רעיון', templateType: 'plain', content: 'שורה\nשנייה' });
  });

  it('a checklist becomes the JSON the app reads, with only the fields given', () => {
    const { draft } = buildNote(
      checklist([{ text: 'לקנות חלב' }, { text: 'לשלם חשמל', dueDate: '2026-10-05', dueTime: '09:30' }]),
      NOW
    );
    expect(draft.templateType).toBe('checklist');
    expect(JSON.parse(draft.content)).toEqual([
      { id: `${NOW.getTime()}-0`, text: 'לקנות חלב', completed: false },
      { id: `${NOW.getTime()}-1`, text: 'לשלם חשמל', completed: false, dueDate: '2026-10-05', dueTime: '09:30' },
    ]);
  });

  it('a shopping list uses name, quantity and checked', () => {
    const { draft } = buildNote(
      { categoryId: 'c1', title: 'קניות', type: 'shopping', items: [{ text: 'עגבניות', quantity: '1 ק"ג' }, { text: 'לחם' }] },
      NOW
    );
    expect(JSON.parse(draft.content)).toEqual([
      { id: `${NOW.getTime()}-0`, name: 'עגבניות', quantity: '1 ק"ג', checked: false },
      { id: `${NOW.getTime()}-1`, name: 'לחם', quantity: '', checked: false },
    ]);
  });
});

describe('reminders (Israel time)', () => {
  it('a date and a time give a reminder at that Israel time', () => {
    const { reminders, draft } = buildNote(checklist([{ text: 'לשלם', dueDate: '2026-10-05', dueTime: '09:30' }]), NOW);
    expect(reminders).toHaveLength(1);
    // 09:30 בישראל ב-5 באוקטובר (שעון קיץ, UTC+3)
    expect(reminders[0].firstAt.toISOString()).toBe('2026-10-05T06:30:00.000Z');
    expect(draft.summary.reminderCount).toBe(1);
  });

  it('uses winter time after the clock change', () => {
    const { reminders } = buildNote(checklist([{ text: 'x', dueDate: '2026-12-01', dueTime: '09:30' }]), NOW);
    expect(reminders[0].firstAt.toISOString()).toBe('2026-12-01T07:30:00.000Z');
  });

  it('a date without a time is a due date with no reminder', () => {
    const { reminders } = buildNote(checklist([{ text: 'x', dueDate: '2026-10-05' }]), NOW);
    expect(reminders).toEqual([]);
  });

  it('a repeating task whose first date has passed rolls forward to the next occurrence', () => {
    const { reminders } = buildNote(
      checklist([{ text: 'תרופה', dueDate: '2026-09-01', dueTime: '20:00', repeat: 'daily' }]),
      NOW
    );
    expect(reminders[0].firstAt.toISOString()).toBe('2026-10-01T17:00:00.000Z');
  });
});

describe('validation errors Claude can act on', () => {
  it.each([
    ['an empty title', { categoryId: 'c1', title: '   ', type: 'text', text: 'x' }, 'title is empty'],
    ['a long title', { categoryId: 'c1', title: 'א'.repeat(51), type: 'text', text: 'x' }, 'limit is 50'],
    ['a text note without text', { categoryId: 'c1', title: 't', type: 'text' }, 'text is empty'],
    ['items on a text note', { categoryId: 'c1', title: 't', type: 'text', text: 'x', items: [] }, 'For a text note use text'],
    ['a checklist without items', checklist([]), 'at least one item'],
    ['text on a checklist', { ...checklist([{ text: 'a' }]), text: 'x' }, 'use items'],
    ['too many items', checklist(Array.from({ length: 101 }, () => ({ text: 'a' }))), 'limit is 100'],
    ['an empty item', checklist([{ text: 'a' }, { text: '  ' }]), 'item 2 is empty'],
  ] as const)('%s', (_label, input, message) => {
    expect(error(input as CreateNoteInput)).toContain(message);
  });

  it.each([
    ['a date that does not exist', { dueDate: '2026-02-30' }, 'not a valid date'],
    ['a date in another format', { dueDate: '05/10/2026' }, 'Use YYYY-MM-DD'],
    ['an hour that does not exist', { dueDate: '2026-10-05', dueTime: '24:00' }, 'not a valid time'],
    ['a 12-hour time', { dueDate: '2026-10-05', dueTime: '9:30' }, 'HH:MM'],
    ['a time without a date', { dueTime: '09:30' }, 'dueTime needs a dueDate'],
    ['an unknown repeat', { dueDate: '2026-10-05', dueTime: '09:30', repeat: 'hourly' }, 'daily, weekly, monthly, yearly'],
    ['a repeat without a time', { dueDate: '2026-10-05', repeat: 'daily' }, 'repeat needs both'],
    ['a time that already passed', { dueDate: '2026-10-01', dueTime: '11:00' }, 'has already passed'],
    ['a year far ahead', { dueDate: '2036-01-01', dueTime: '09:00' }, 'Check the year'],
  ] as const)('%s', (_label, timing, message) => {
    expect(error(checklist([{ text: 'x', ...timing }]))).toContain(message);
  });

  it('says which item is wrong', () => {
    expect(error(checklist([{ text: 'a' }, { text: 'b', dueDate: 'tomorrow' }]))).toMatch(/^item 2:/);
  });

  it('dates and quantities stay on their own list types', () => {
    expect(
      error({ categoryId: 'c1', title: 't', type: 'shopping', items: [{ text: 'a', dueDate: '2026-10-05' }] })
    ).toContain('A shopping list has none');
    expect(error(checklist([{ text: 'a', quantity: '2' }]))).toContain('quantity is for shopping lists');
  });
});

describe('fingerprint (duplicate detection)', () => {
  const input = checklist([{ text: 'לקנות חלב', dueDate: '2026-10-05', dueTime: '09:30' }]);

  it('is the same for the same request at another moment (new ids, same note)', () => {
    const later = new Date(NOW.getTime() + 60_000);
    expect(buildNote(input, later).draft.fingerprint).toBe(buildNote(input, NOW).draft.fingerprint);
  });

  it('ignores whitespace differences in the title', () => {
    expect(buildNote({ ...input, title: '  משימות ' }, NOW).draft.fingerprint).toBe(buildNote(input, NOW).draft.fingerprint);
  });

  it.each([
    ['another title', { title: 'משימות 2' }],
    ['another category', { categoryId: 'c2' }],
    ['another item', { items: [{ text: 'לקנות לחם', dueDate: '2026-10-05', dueTime: '09:30' }] }],
    ['another time', { items: [{ text: 'לקנות חלב', dueDate: '2026-10-05', dueTime: '10:30' }] }],
  ])('differs for %s', (_label, change) => {
    expect(buildNote({ ...input, ...change } as CreateNoteInput, NOW).draft.fingerprint).not.toBe(
      buildNote(input, NOW).draft.fingerprint
    );
  });
});
