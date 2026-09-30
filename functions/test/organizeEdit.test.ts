/**
 * ארכיון, העברה, והוספה/הסרה של משימות: איך כל עריכה מוחלת. בלי Firestore.
 */

import { describe, expect, it } from 'vitest';
import {
  buildAddChecklistItemsEdit,
  buildArchiveEdit,
  buildMoveEdit,
  buildRemoveChecklistItemEdit,
  buildUnarchiveEdit,
} from '../src/mcp/editNote';
import { InvalidError, ReadOnlyError } from '../src/notesCore/errors';
import type { CategoryRecord, NoteRecord } from '../src/notesCore/model';
import { TargetCategoryNotFoundError } from '../src/notesCore/store';

const NOW = new Date('2026-10-01T09:00:00Z');

const note = (overrides: Partial<NoteRecord> = {}): NoteRecord => ({
  id: 'n1',
  title: 'משימות',
  content: JSON.stringify([
    { id: 'a', text: 'חלב', completed: false },
    { id: 'b', text: 'לחם', completed: false, dueDate: '2026-10-05', dueTime: '09:00' },
  ]),
  categoryId: 'home',
  templateType: 'checklist',
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
  revision: 1,
  createdAt: null,
  updatedAt: null,
  archivedAt: null,
  updatedBy: null,
  ...overrides,
});

const category = (overrides: Partial<CategoryRecord> = {}): CategoryRecord => ({
  id: 'work',
  name: 'עבודה',
  color: '#000',
  icon: null,
  order: 0,
  userId: 'u1',
  sharedWith: [],
  isSensitive: false,
  isReadOnly: false,
  createdAt: null,
  updatedAt: null,
  ...overrides,
});

describe('archive and unarchive', () => {
  it('archiving sets the flag and cancels every reminder of the note', () => {
    expect(buildArchiveEdit().apply(note())).toMatchObject({
      fields: { isArchived: true },
      reminders: { kind: 'deleteAll' },
    });
  });

  it('archiving an archived note, or restoring an active one, changes nothing', () => {
    expect(buildArchiveEdit().apply(note({ isArchived: true }))).toBeNull();
    expect(buildUnarchiveEdit().apply(note())).toBeNull();
  });

  it('restoring clears the flag and leaves the reminders to the trigger', () => {
    const outcome = buildUnarchiveEdit().apply(note({ isArchived: true }));
    expect(outcome).toMatchObject({ fields: { isArchived: false } });
    expect(outcome?.reminders).toBeUndefined();
  });

  it('both work on archived notes (the others refuse them)', () => {
    expect(buildArchiveEdit().archived).toBe('any');
    expect(buildUnarchiveEdit().archived).toBe('any');
  });
});

describe('move_note_to_category', () => {
  const move = (target: CategoryRecord | null, id = 'work') => buildMoveEdit(id).apply(note(), { targetCategory: target });

  it("moves to one of the user's categories, and points the reminders there", () => {
    expect(move(category())).toMatchObject({
      fields: { categoryId: 'work' },
      reminders: { kind: 'setCategory', categoryId: 'work' },
      after: { categoryId: 'work', categoryName: 'עבודה' },
    });
  });

  it.each([
    ['a category that does not exist', null],
    ["another user's category", category({ userId: 'someone-else' })],
    ['a sensitive category', category({ isSensitive: true })],
  ])('%s is the same "not found"', (_label, target) => {
    expect(() => move(target)).toThrow(TargetCategoryNotFoundError);
  });

  it('a read-only category refuses with a read-only message', () => {
    expect(() => move(category({ isReadOnly: true }))).toThrow(ReadOnlyError);
  });

  it('the same category changes nothing', () => {
    expect(move(category({ id: 'home' }), 'home')).toBeNull();
  });
});

describe('add_checklist_items', () => {
  const rows = (outcome: { content?: string } | null) => JSON.parse(outcome!.content ?? '');

  it('adds at the end, with dates, times and repeat', () => {
    const outcome = buildAddChecklistItemsEdit(
      [{ text: 'ביצים' }, { text: 'לשלם', dueDate: '2026-10-07', dueTime: '10:00', repeat: 'monthly' }],
      undefined,
      NOW
    ).apply(note());
    expect(rows(outcome).map((row: { text: string }) => row.text)).toEqual(['חלב', 'לחם', 'ביצים', 'לשלם']);
    expect(rows(outcome)[3]).toMatchObject({ completed: false, dueDate: '2026-10-07', dueTime: '10:00', repeat: 'monthly' });
  });

  it('adds right after a given item', () => {
    const outcome = buildAddChecklistItemsEdit([{ text: 'ביצים' }], 'a', NOW).apply(note());
    expect(rows(outcome).map((row: { text: string }) => row.text)).toEqual(['חלב', 'ביצים', 'לחם']);
  });

  it('validates like create_note, and says which task', () => {
    expect(() => buildAddChecklistItemsEdit([{ text: 'x' }, { text: 'y', dueDate: '2026-09-30', dueTime: '09:00' }], undefined, NOW)).toThrow(
      'task 2: 2026-09-30 09:00 Israel time has already passed'
    );
    expect(() => buildAddChecklistItemsEdit([], undefined, NOW)).toThrow('at least one task');
    expect(() => buildAddChecklistItemsEdit([{ text: ' ' }], undefined, NOW)).toThrow('task 1 is empty');
  });

  it('the same tasks give the same fingerprint (retry), different tasks a different one', () => {
    const first = buildAddChecklistItemsEdit([{ text: 'ביצים' }], undefined, NOW);
    const later = buildAddChecklistItemsEdit([{ text: 'ביצים' }], undefined, new Date(NOW.getTime() + 60_000));
    expect(later.fingerprint).toBe(first.fingerprint);
    expect(buildAddChecklistItemsEdit([{ text: 'גבינה' }], undefined, NOW).fingerprint).not.toBe(first.fingerprint);
  });

  it('refuses an unknown item id and a note that is not a checklist', () => {
    expect(() => buildAddChecklistItemsEdit([{ text: 'x' }], 'zzz', NOW).apply(note())).toThrow(InvalidError);
    expect(() => buildAddChecklistItemsEdit([{ text: 'x' }], undefined, NOW).apply(note({ templateType: 'plain', content: 'x' }))).toThrow(
      'not a checklist'
    );
  });
});

describe('remove_checklist_item', () => {
  it("removes that task and cancels its reminder", () => {
    const outcome = buildRemoveChecklistItemEdit('b').apply(note());
    expect(JSON.parse(outcome!.content ?? '')).toEqual([{ id: 'a', text: 'חלב', completed: false }]);
    expect(outcome?.reminders).toEqual({ kind: 'deleteItems', itemIds: ['b'] });
    expect(outcome?.before).toMatchObject({ id: 'b', text: 'לחם' });
  });

  it('refuses an unknown id with a pointer to get_note', () => {
    expect(() => buildRemoveChecklistItemEdit('zzz').apply(note())).toThrow('Call get_note');
  });
});
