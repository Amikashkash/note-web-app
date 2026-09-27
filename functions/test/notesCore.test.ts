/**
 * החלקים הטהורים של notesCore: זהות, הרשאות, רגישות, חיפוש ונרמול.
 * הגישה ל-Firestore (`UserScope`) נבדקת מול ה-emulator ב-`test-emulator`.
 */

import { describe, expect, it } from 'vitest';
import { InvalidError } from '../src/notesCore/errors';
import { isVerifiedIdentity, mintVerifiedIdentity, type VerifiedIdentity } from '../src/notesCore/identity';
import { toCategoryRecord, toNoteRecord } from '../src/notesCore/mappers';
import { NOTE_PATCH_FIELDS, accessOf, sanitizeNotePatch, satisfies } from '../src/notesCore/permissions';
import { matchNote, searchNotes } from '../src/notesCore/search';
import { UserScope } from '../src/notesCore/store';
import { isVisibleToMcp } from '../src/notesCore/visibility';

describe('identity', () => {
  it('only an identity from mintVerifiedIdentity counts as verified', () => {
    expect(isVerifiedIdentity(mintVerifiedIdentity('user-a'))).toBe(true);
    expect(isVerifiedIdentity({ uid: 'user-a' })).toBe(false);
    expect(isVerifiedIdentity(Object.freeze({ uid: 'user-a' }))).toBe(false);
  });

  it('UserScope refuses an identity that was not minted, even when cast', () => {
    const forged = { uid: 'user-a' } as unknown as VerifiedIdentity;
    // ה-Firestore לא נגיע אליו: הבדיקה נכשלת לפני כן
    expect(() => UserScope.for(forged, {} as never)).toThrow('verified identity');
  });

  it('a minted identity cannot be changed to another uid', () => {
    const identity = mintVerifiedIdentity('user-a');
    expect(() => {
      (identity as { uid: string }).uid = 'user-b';
    }).toThrow();
  });

  it.each(['', 'a/b', 'x'.repeat(129)])('rejects the uid %j', (uid) => {
    expect(() => mintVerifiedIdentity(uid)).toThrow(InvalidError);
  });
});

describe('permissions', () => {
  const doc = { userId: 'owner', sharedWith: ['friend'] };

  it('derives access from ownership and sharing only', () => {
    expect(accessOf(doc, 'owner')).toBe('owner');
    expect(accessOf(doc, 'friend')).toBe('shared');
    expect(accessOf(doc, 'stranger')).toBeNull();
  });

  it('a shared user can read and write, but not act as owner', () => {
    expect(satisfies('shared', 'read')).toBe(true);
    expect(satisfies('shared', 'write')).toBe(true);
    expect(satisfies('shared', 'owner')).toBe(false);
    expect(satisfies('owner', 'owner')).toBe(true);
  });

  it('never allows ownership, sensitivity or server-set fields', () => {
    const allowed = Object.keys(NOTE_PATCH_FIELDS);
    for (const field of ['userId', 'sharedWith', 'isSensitive', 'updatedBy', 'updatedAt', 'archivedAt', 'templateType']) {
      expect(allowed).not.toContain(field);
    }
  });

  describe('sanitizeNotePatch', () => {
    it('passes allowed fields for a shared user', () => {
      expect(sanitizeNotePatch({ title: 'ח', content: 'x', isPinned: true }, 'shared')).toEqual({
        title: 'ח',
        content: 'x',
        isPinned: true,
      });
    });

    it('drops undefined values instead of writing them', () => {
      expect(sanitizeNotePatch({ title: 'ח', content: undefined }, 'owner')).toEqual({ title: 'ח' });
    });

    it.each([
      ['isArchived', { isArchived: true }],
      ['categoryId', { categoryId: 'other' }],
    ])('refuses %s from a shared user', (_field, patch) => {
      expect(() => sanitizeNotePatch(patch, 'shared')).toThrow(InvalidError);
    });

    it('lets the owner archive and move', () => {
      expect(sanitizeNotePatch({ isArchived: true, categoryId: 'c2' }, 'owner')).toEqual({
        isArchived: true,
        categoryId: 'c2',
      });
    });

    it.each(['userId', 'sharedWith', 'isSensitive', 'updatedBy', 'templateType', 'somethingNew', '__proto__'])(
      'refuses %s even from the owner, and says so',
      (field) => {
        const patch = JSON.parse(`{"title":"ok","${field}":"x"}`);
        expect(() => sanitizeNotePatch(patch, 'owner')).toThrow(`Fields not allowed: ${field}`);
      }
    );

    it.each([
      ['a long title', { title: 'x'.repeat(51) }],
      ['a title that is not text', { title: 5 }],
      ['content over 100KB', { content: 'x'.repeat(100 * 1024 + 1) }],
      ['a pin that is not boolean', { isPinned: 'yes' }],
      ['an empty category', { categoryId: '' }],
      ['a category path', { categoryId: 'a/b' }],
      ['an empty patch', {}],
      ['an array', []],
      ['null', null],
    ])('refuses %s', (_label, patch) => {
      expect(() => sanitizeNotePatch(patch, 'owner')).toThrow(InvalidError);
    });
  });
});

describe('isVisibleToMcp', () => {
  const categories = new Map([
    ['open', { isSensitive: false }],
    ['secret', { isSensitive: true }],
  ]);

  it.each([
    ['a plain note in an open category', { isSensitive: false, categoryId: 'open' }, true],
    ['a note flagged sensitive', { isSensitive: true, categoryId: 'open' }, false],
    ['a note in a sensitive category', { isSensitive: false, categoryId: 'secret' }, false],
    ['a note whose category is gone', { isSensitive: false, categoryId: 'deleted' }, false],
    ['a note with no category', { isSensitive: false, categoryId: '' }, false],
  ])('%s', (_label, note, visible) => {
    expect(isVisibleToMcp(note, categories)).toBe(visible);
  });
});

describe('mappers', () => {
  const timestamp = (iso: string) => ({ toDate: () => new Date(iso) });

  it('normalises a note and turns timestamps into ISO strings', () => {
    const record = toNoteRecord('n1', {
      title: 'ת',
      userId: 'u',
      createdAt: timestamp('2026-09-01T10:00:00Z'),
      tags: ['a', 3],
    });
    expect(record).toMatchObject({
      id: 'n1',
      templateType: 'plain',
      tags: ['a'],
      sharedWith: [],
      isSensitive: false,
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
      archivedAt: null,
    });
  });

  it('leaves a missing date as null instead of inventing one', () => {
    expect(toNoteRecord('n1', {}).createdAt).toBeNull();
  });

  it.each([true, 'true', 1, null, {}])('treats isSensitive %j as sensitive (fail-closed)', (value) => {
    expect(toNoteRecord('n', { isSensitive: value }).isSensitive).toBe(true);
    expect(toCategoryRecord('c', { isSensitive: value }).isSensitive).toBe(true);
  });

  it('treats a missing or false isSensitive as not sensitive', () => {
    expect(toNoteRecord('n', {}).isSensitive).toBe(false);
    expect(toNoteRecord('n', { isSensitive: false }).isSensitive).toBe(false);
  });
});

describe('search', () => {
  const note = (overrides: Partial<{ title: string; content: string; templateType: string; tags: string[] }>) => ({
    title: '',
    content: '',
    templateType: 'plain',
    tags: [],
    ...overrides,
  });

  it('finds a word in the text of a checklist item, not in its JSON keys', () => {
    const checklist = note({
      templateType: 'checklist',
      content: JSON.stringify([{ id: 'x1', text: 'לקנות חלב', completed: false }]),
    });
    expect(matchNote(checklist, 'חלב')).toEqual(['content']);
    expect(matchNote(checklist, 'completed')).toEqual([]);
    expect(matchNote(checklist, 'x1')).toEqual([]);
  });

  it('reports every field that matched, case-insensitively', () => {
    expect(matchNote(note({ title: 'Shopping', content: 'shop', tags: ['SHOP'] }), 'SHOP')).toEqual([
      'title',
      'content',
      'tags',
    ]);
  });

  it('does not match what the renderer adds by itself', () => {
    expect(matchNote(note({ content: '' }), 'פתק')).toEqual([]);
    expect(matchNote(note({ templateType: 'aisummary', content: '{"a":1}' }), 'json')).toEqual([]);
    expect(matchNote(note({ templateType: 'aisummary', content: '{"a":1}' }), '"a"')).toEqual(['content']);
  });

  it('returns nothing for an empty query', () => {
    expect(searchNotes([note({ title: 'x' })], '   ')).toEqual([]);
  });
});
