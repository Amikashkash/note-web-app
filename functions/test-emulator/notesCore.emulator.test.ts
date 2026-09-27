/**
 * `UserScope` מול ה-emulator: בעלות, שיתוף ורגישות (mcp-plan §3.2, §3.4).
 *
 * הנתונים נבנים פעם אחת, עם מזהים ייחודיים להרצה, כדי שלא יתערבבו עם
 * קובצי emulator אחרים שכותבים לאותו מסד. כל בדיקה מסתכלת מנקודת המבט
 * של משתמש אחד (A או B).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { NotFoundError } from '../src/notesCore/errors';
import { mintVerifiedIdentity } from '../src/notesCore/identity';
import { UserScope } from '../src/notesCore/store';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run through `npm run test:functions:emulator` - FIRESTORE_EMULATOR_HOST is not set');
}

const app = initializeApp({ projectId: 'demo-notes-4-me' }, 'notescore-emulator-test');
const db = getFirestore(app);

const run = `${Date.now().toString(36)}`;
const A = `mcp-a-${run}`;
const B = `mcp-b-${run}`;
const id = (name: string) => `${name}-${run}`;

const AT = Timestamp.fromDate(new Date('2026-09-20T10:00:00Z'));

/** מילה שמופיעה בכותרת של כל פתק, כדי שחיפוש שלה יחזיר את כל מה שגלוי */
const EVERYWHERE = 'כולם';
/** מילה שמופיעה רק בתוכן של פתקים מוסתרים */
const SECRET_WORD = 'סיסמתהכספת';

const C = {
  aOpen: id('cat-a-open'),
  aSharedWithB: id('cat-a-shared'),
  aSensitive: id('cat-a-sensitive'),
  aFlaggedLater: id('cat-a-later'),
  bOpen: id('cat-b-open'),
  bSensitiveSharedWithA: id('cat-b-sensitive-shared'),
  deleted: id('cat-deleted'),
};

const N = {
  aPlain: id('note-a-plain'),
  aSharedWithB: id('note-a-shared'),
  aInSharedCategory: id('note-a-in-shared-cat'),
  aSensitive: id('note-a-sensitive'),
  aInSensitiveCategory: id('note-a-in-sensitive-cat'),
  aInFlaggedLater: id('note-a-in-later-cat'),
  aOrphan: id('note-a-orphan'),
  aNoCategory: id('note-a-no-cat'),
  aArchived: id('note-a-archived'),
  aArchivedSensitive: id('note-a-archived-sensitive'),
  aPinned: id('note-a-pinned'),
  bOwn: id('note-b-own'),
  bInSensitiveSharedCategory: id('note-b-in-sensitive-shared-cat'),
  missing: id('note-missing'),
};

const category = (userId: string, extra: DocumentData = {}): DocumentData => ({
  name: 'קטגוריה',
  color: '#3B82F6',
  icon: null,
  order: 0,
  userId,
  sharedWith: [],
  isSensitive: false,
  createdAt: AT,
  updatedAt: AT,
  ...extra,
});

const note = (userId: string, categoryId: string, extra: DocumentData = {}): DocumentData => ({
  title: `פתק של ${EVERYWHERE}`,
  content: 'תוכן רגיל',
  categoryId,
  templateType: 'plain',
  tags: [],
  color: null,
  order: 0,
  userId,
  sharedWith: [],
  isPinned: false,
  isArchived: false,
  isSensitive: false,
  createdAt: AT,
  updatedAt: AT,
  updatedBy: userId,
  ...extra,
});

const secret = { content: `הקוד: ${SECRET_WORD}` };

const scopeOf = (uid: string) => UserScope.for(mintVerifiedIdentity(uid), db);

beforeAll(async () => {
  const batch = db.batch();
  const put = (path: string, data: DocumentData) => batch.set(db.doc(path), data);

  put(`categories/${C.aOpen}`, category(A, { order: 2 }));
  put(`categories/${C.aSharedWithB}`, category(A, { sharedWith: [B], order: 1 }));
  put(`categories/${C.aSensitive}`, category(A, { isSensitive: true }));
  put(`categories/${C.aFlaggedLater}`, category(A));
  put(`categories/${C.bOpen}`, category(B));
  put(`categories/${C.bSensitiveSharedWithA}`, category(B, { sharedWith: [A], isSensitive: true }));

  put(`notes/${N.aPlain}`, note(A, C.aOpen, { order: 1 }));
  put(`notes/${N.aPinned}`, note(A, C.aOpen, { order: 5, isPinned: true }));
  // משותף עם B, אבל הקטגוריה של A לא משותפת איתו
  put(`notes/${N.aSharedWithB}`, note(A, C.aOpen, { sharedWith: [B], content: 'רשימה משותפת' }));
  put(`notes/${N.aInSharedCategory}`, note(A, C.aSharedWithB, { sharedWith: [B] }));
  put(`notes/${N.aSensitive}`, note(A, C.aOpen, { isSensitive: true, sharedWith: [B], ...secret }));
  put(`notes/${N.aInSensitiveCategory}`, note(A, C.aSensitive, { sharedWith: [B], ...secret }));
  put(`notes/${N.aInFlaggedLater}`, note(A, C.aFlaggedLater));
  put(`notes/${N.aOrphan}`, note(A, C.deleted, secret));
  put(`notes/${N.aNoCategory}`, note(A, '', secret));
  put(`notes/${N.aArchived}`, note(A, C.aOpen, { isArchived: true, archivedAt: AT, sharedWith: [B] }));
  put(`notes/${N.aArchivedSensitive}`, note(A, C.aOpen, { isArchived: true, isSensitive: true, ...secret }));
  put(`notes/${N.bOwn}`, note(B, C.bOpen, secret));
  put(`notes/${N.bInSensitiveSharedCategory}`, note(B, C.bSensitiveSharedWithA, { sharedWith: [A], ...secret }));

  for (const noteId of [N.aPlain, N.aSensitive, N.bOwn]) {
    put(`notes/${noteId}/versions/v1`, {
      title: 'גרסה ישנה',
      content: SECRET_WORD,
      templateType: 'plain',
      tags: [],
      color: null,
      categoryId: C.aOpen,
      isArchived: false,
      authoredBy: A,
      authoredAt: AT,
      replacedBy: A,
      reason: 'time',
      capturedAt: AT,
    });
  }

  await batch.commit();
});

afterAll(async () => {
  await deleteApp(app);
});

const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe('UserScope: user A (owner)', () => {
  it('lists own and shared-with-me categories, without sensitive ones, by order', async () => {
    const categories = await scopeOf(A).listAccessibleCategories();
    // order: 0, 1, 2
    expect(ids(categories)).toEqual([C.aFlaggedLater, C.aSharedWithB, C.aOpen]);
    expect(categories.every((category) => category.access === 'owner')).toBe(true);
    expect(categories[0]).not.toHaveProperty('isSensitive');
  });

  it('lists active visible notes, pinned first, and never the hidden ones', async () => {
    const notes = await scopeOf(A).listAccessibleNotes();
    expect(new Set(ids(notes))).toEqual(
      new Set([N.aPlain, N.aPinned, N.aSharedWithB, N.aInSharedCategory, N.aInFlaggedLater])
    );
    expect(notes[0].id).toBe(N.aPinned);
    expect(notes.every((item) => item.access === 'owner')).toBe(true);
    expect(notes[0]).not.toHaveProperty('isSensitive');
  });

  it('lists archived notes only when asked, without the sensitive ones', async () => {
    expect(ids(await scopeOf(A).listAccessibleNotes({ archived: true }))).toEqual([N.aArchived]);
  });

  it('loads its own note with every need, including an archived one', async () => {
    const scope = scopeOf(A);
    await expect(scope.loadNoteForUser(N.aPlain, 'owner')).resolves.toMatchObject({
      id: N.aPlain,
      access: 'owner',
      createdAt: '2026-09-20T10:00:00.000Z',
    });
    await expect(scope.loadNoteForUser(N.aArchived, 'owner')).resolves.toMatchObject({ isArchived: true });
  });

  it('reads the versions of a visible note, newest first', async () => {
    const versions = await scopeOf(A).listVersionsForNote(N.aPlain);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ id: 'v1', reason: 'time', capturedAt: '2026-09-20T10:00:00.000Z' });
  });

  it('hides a note once its category is flagged sensitive, at read time', async () => {
    const scope = scopeOf(A);
    await expect(scope.loadNoteForUser(N.aInFlaggedLater)).resolves.toBeTruthy();

    await db.doc(`categories/${C.aFlaggedLater}`).update({ isSensitive: true });
    await expect(scope.loadNoteForUser(N.aInFlaggedLater)).rejects.toThrow(NotFoundError);
    expect(ids(await scope.listAccessibleNotes())).not.toContain(N.aInFlaggedLater);
    expect(ids(await scope.listAccessibleCategories())).not.toContain(C.aFlaggedLater);

    // ובחזרה, כדי שסדר הבדיקות לא ישנה את התוצאות של האחרות
    await db.doc(`categories/${C.aFlaggedLater}`).update({ isSensitive: false });
  });

  it('search finds words in visible notes and nothing from hidden ones', async () => {
    const scope = scopeOf(A);
    expect(await scope.searchNotes(SECRET_WORD)).toEqual([]);
    expect(await scope.searchNotes(SECRET_WORD, { includeArchived: true })).toEqual([]);

    const hits = await scope.searchNotes('משותפת');
    expect(hits.map((hit) => [hit.note.id, hit.matchedIn])).toEqual([[N.aSharedWithB, ['content']]]);
  });

  it('search includes own archived notes only when asked', async () => {
    const scope = scopeOf(A);
    expect(ids((await scope.searchNotes(EVERYWHERE)).map((hit) => hit.note))).not.toContain(N.aArchived);
    expect(ids((await scope.searchNotes(EVERYWHERE, { includeArchived: true })).map((hit) => hit.note))).toContain(
      N.aArchived
    );
  });
});

describe('UserScope: user B (shared with)', () => {
  it('sees the shared category of A, and not A’s others', async () => {
    const categories = await scopeOf(B).listAccessibleCategories();
    expect(new Set(ids(categories))).toEqual(new Set([C.aSharedWithB, C.bOpen]));
    expect(categories.find((item) => item.id === C.aSharedWithB)?.access).toBe('shared');
  });

  it('sees notes shared with them, even when A’s category is not shared', async () => {
    const notes = await scopeOf(B).listAccessibleNotes();
    expect(new Set(ids(notes))).toEqual(new Set([N.aSharedWithB, N.aInSharedCategory, N.bOwn]));
    expect(notes.find((item) => item.id === N.aSharedWithB)?.access).toBe('shared');
  });

  it('does not see A’s archived note in the lists (like the app)', async () => {
    const scope = scopeOf(B);
    expect(ids(await scope.listAccessibleNotes())).not.toContain(N.aArchived);
    expect(ids(await scope.listAccessibleNotes({ archived: true }))).not.toContain(N.aArchived);
  });

  it('can still load an archived shared note by id, since the rules let them read it', async () => {
    await expect(scopeOf(B).loadNoteForUser(N.aArchived)).resolves.toMatchObject({ access: 'shared' });
  });

  it('reads and writes a shared note, but may not act as owner on it', async () => {
    const scope = scopeOf(B);
    await expect(scope.loadNoteForUser(N.aSharedWithB, 'read')).resolves.toBeTruthy();
    await expect(scope.loadNoteForUser(N.aSharedWithB, 'write')).resolves.toBeTruthy();
    await expect(scope.loadNoteForUser(N.aSharedWithB, 'owner')).rejects.toMatchObject({ code: 'forbidden' });
    await expect(scope.loadCategoryForUser(C.aSharedWithB, 'owner')).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('the owner’s sensitive flags apply to them too', async () => {
    const scope = scopeOf(B);
    await expect(scope.loadNoteForUser(N.aSensitive)).rejects.toThrow(NotFoundError);
    await expect(scope.loadNoteForUser(N.aInSensitiveCategory)).rejects.toThrow(NotFoundError);
    expect(await scope.searchNotes(SECRET_WORD)).toEqual(
      // הפתק של B עצמו מכיל את המילה ואינו רגיש
      [{ note: expect.objectContaining({ id: N.bOwn }), matchedIn: ['content'] }]
    );
  });
});

// ---------------------------------------------------------------------------
// הבדיקה הגנרית (mcp-plan §3.2.8, §3.4): כל פונקציית קריאה של UserScope,
// מול כל סוג של מסמך מוסתר, מנקודת המבט של A. תוצאה אחת: אותו NotFound,
// או היעדרות מהרשימה.
// ---------------------------------------------------------------------------

type Read = (scope: UserScope, targetId: string) => Promise<unknown>;

/** פונקציות שמקבלות מזהה פתק */
const BY_NOTE_ID: Record<string, Read> = {
  'loadNoteForUser(read)': (scope, noteId) => scope.loadNoteForUser(noteId, 'read'),
  'loadNoteForUser(write)': (scope, noteId) => scope.loadNoteForUser(noteId, 'write'),
  'loadNoteForUser(owner)': (scope, noteId) => scope.loadNoteForUser(noteId, 'owner'),
  listVersionsForNote: (scope, noteId) => scope.listVersionsForNote(noteId),
};

/** פונקציות שמקבלות מזהה קטגוריה */
const BY_CATEGORY_ID: Record<string, Read> = {
  'loadCategoryForUser(read)': (scope, categoryId) => scope.loadCategoryForUser(categoryId, 'read'),
  'loadCategoryForUser(write)': (scope, categoryId) => scope.loadCategoryForUser(categoryId, 'write'),
  'loadCategoryForUser(owner)': (scope, categoryId) => scope.loadCategoryForUser(categoryId, 'owner'),
};

/** פונקציות שמחזירות רשימה - המסמך המוסתר פשוט לא מופיע */
const LISTS: Record<string, (scope: UserScope) => Promise<{ id: string }[]>> = {
  listAccessibleNotes: (scope) => scope.listAccessibleNotes(),
  'listAccessibleNotes(archived)': (scope) => scope.listAccessibleNotes({ archived: true }),
  listAccessibleCategories: (scope) => scope.listAccessibleCategories(),
  searchNotes: async (scope) => (await scope.searchNotes(EVERYWHERE)).map((hit) => hit.note),
  'searchNotes(includeArchived)': async (scope) =>
    (await scope.searchNotes(EVERYWHERE, { includeArchived: true })).map((hit) => hit.note),
  'searchNotes(secret word)': async (scope) =>
    (await scope.searchNotes(SECRET_WORD, { includeArchived: true })).map((hit) => hit.note),
};

const HIDDEN_NOTES: Record<string, string> = {
  'a foreign note': N.bOwn,
  'a sensitive note': N.aSensitive,
  'a note in a sensitive category': N.aInSensitiveCategory,
  'a shared note in the owner’s sensitive category': N.bInSensitiveSharedCategory,
  'a note whose category was deleted': N.aOrphan,
  'a note with no category': N.aNoCategory,
  'an archived sensitive note': N.aArchivedSensitive,
  'a note that does not exist': N.missing,
  'an id that is not a document id': 'a/b',
  'an empty id': '',
};

const HIDDEN_CATEGORIES: Record<string, string> = {
  'a foreign category': C.bOpen,
  'a sensitive category': C.aSensitive,
  'a sensitive category shared with me': C.bSensitiveSharedWithA,
  'a deleted category': C.deleted,
  'an id that is not a document id': 'a/b',
};

/** הצורה המלאה של השגיאה: מחלקה, הודעה, קוד, ושום שדה נוסף */
const shapeOf = (error: unknown) => ({
  isNotFound: error instanceof NotFoundError,
  name: (error as Error).name,
  message: (error as Error).message,
  keys: Object.keys(error as object).sort(),
});

const caught = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected the read to fail');
};

describe('every read function hides what the user may not see', () => {
  it('covers every public method of UserScope', () => {
    const methods = Object.getOwnPropertyNames(UserScope.prototype).filter((name) => name !== 'constructor');
    const covered = new Set(
      [...Object.keys(BY_NOTE_ID), ...Object.keys(BY_CATEGORY_ID), ...Object.keys(LISTS)].map(
        (name) => name.split('(')[0]
      )
    );
    // מתודה חדשה ב-UserScope חייבת להיכנס לאחת הטבלאות למעלה
    expect(methods.filter((name) => !covered.has(name))).toEqual([]);
  });

  const reference = new NotFoundError();

  describe.each(Object.entries(BY_NOTE_ID))('%s', (_name, read) => {
    it.each(Object.entries(HIDDEN_NOTES))('%s → the same NotFound', async (_label, noteId) => {
      expect(shapeOf(await caught(read(scopeOf(A), noteId)))).toEqual(shapeOf(reference));
    });
  });

  describe.each(Object.entries(BY_CATEGORY_ID))('%s', (_name, read) => {
    it.each(Object.entries(HIDDEN_CATEGORIES))('%s → the same NotFound', async (_label, categoryId) => {
      expect(shapeOf(await caught(read(scopeOf(A), categoryId)))).toEqual(shapeOf(reference));
    });
  });

  describe.each(Object.entries(LISTS))('%s', (_name, list) => {
    it('never includes a hidden note or category', async () => {
      const listed = new Set(ids(await list(scopeOf(A))));
      for (const hidden of [...Object.values(HIDDEN_NOTES), ...Object.values(HIDDEN_CATEGORIES)]) {
        expect(listed.has(hidden)).toBe(false);
      }
    });
  });

  it('versions of a sensitive note stay hidden even though they are stored', async () => {
    const stored = await db.collection(`notes/${N.aSensitive}/versions`).get();
    expect(stored.size).toBe(1);
    await expect(scopeOf(A).listVersionsForNote(N.aSensitive)).rejects.toThrow(NotFoundError);
    await expect(scopeOf(B).listVersionsForNote(N.aSensitive)).rejects.toThrow(NotFoundError);
  });
});
