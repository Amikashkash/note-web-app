/**
 * בדיקות `firestore.rules` - מתעדות את ההתנהגות הנוכחית
 *
 * המטרה בשלב הזה היא לקבע את המצב הקיים, לא לתקן אותו. לכן יש כאן
 * שני סוגי בדיקות:
 *
 * - התנהגות רצויה שחייבת להישמר (בעלים קורא, זר נחסם, וכו').
 * - "חורים ידועים" מ-`thinking/architecture-review.md`. כל אחד מהם
 *   בודק את ההתנהגות **הנוכחית**, השגויה, ומסומן בצעד שאמור לתקן אותו.
 *   כשהתיקון ייכנס, הבדיקה תיכשל - וזה הסימן להפוך אותה (assertSucceeds
 *   ↔ assertFails) ולהעביר אותה לקבוצת ההתנהגות הרצויה.
 */

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';

const OWNER = 'owner-uid';
const SHARED = 'shared-uid';
const STRANGER = 'stranger-uid';

let env: RulesTestEnvironment;

// ה-context מחזיר את הטיפוס של ה-compat SDK. בזמן ריצה הוא עובד עם
// הפונקציות המודולריות, ורק הטיפוסים לא תואמים - לכן ההמרה.
const as = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;
const anonymous = () => env.unauthenticatedContext().firestore() as unknown as Firestore;

const baseNote = {
  title: 'רשימת קניות',
  content: '[]',
  categoryId: 'cat-1',
  templateType: 'checklist',
  tags: [],
  color: null,
  order: 0,
  userId: OWNER,
  sharedWith: [SHARED],
  isPinned: false,
  isArchived: false,
};

const baseCategory = {
  name: 'בית',
  color: '#3B82F6',
  icon: null,
  order: 0,
  userId: OWNER,
  sharedWith: [SHARED],
};

/**
 * "חור ידוע": בודק את ההתנהגות הנוכחית, שאמורה להשתנות בצעד `step`.
 * כשהצעד ייושם הבדיקה תיכשל, ואז יש להפוך אותה.
 */
const knownHole = (step: string, name: string, fn: () => Promise<unknown>) =>
  it(`KNOWN HOLE, expected to flip in ${step}: ${name}`, fn);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-notes-4-me',
    // `RULES_FILE` מאפשר להריץ את אותן בדיקות מול קובץ כללים אחר, למשל
    // כדי לוודא שהבדיקות אכן נכשלות מול כללים מתירניים
    firestore: { rules: readFileSync(process.env.RULES_FILE ?? 'firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'notes/note-1'), baseNote);
    await setDoc(doc(db, 'notes/private-1'), { ...baseNote, sharedWith: [] });
    await setDoc(doc(db, 'categories/cat-1'), baseCategory);
    await setDoc(doc(db, 'reminders/note-1__item-1'), { userId: OWNER, noteId: 'note-1', sent: false });
    await setDoc(doc(db, `users/${OWNER}`), { uid: OWNER, email: 'owner@example.com' });
    await setDoc(doc(db, `users/${OWNER}/fcmTokens/t1`), { token: 't1' });
    await setDoc(doc(db, `users/${OWNER}/products/p1`), { name: 'חלב' });
    await setDoc(doc(db, `userLookup/${OWNER}`), { email: 'owner@example.com', displayName: 'Owner' });
    await setDoc(doc(db, `userLookup/${SHARED}`), { email: 'shared@example.com', displayName: 'Shared' });
  });
});

// ---------------------------------------------------------------------------
// notes
// ---------------------------------------------------------------------------

describe('notes', () => {
  it('owner reads, updates and deletes their note', async () => {
    const db = as(OWNER);
    await assertSucceeds(getDoc(doc(db, 'notes/note-1')));
    await assertSucceeds(updateDoc(doc(db, 'notes/note-1'), { title: 'חדש' }));
    await assertSucceeds(deleteDoc(doc(db, 'notes/note-1')));
  });

  it('a user the note is shared with can read it and edit content', async () => {
    const db = as(SHARED);
    await assertSucceeds(getDoc(doc(db, 'notes/note-1')));
    await assertSucceeds(updateDoc(doc(db, 'notes/note-1'), { content: '[{"id":"1"}]', title: 'x' }));
  });

  it('a stranger cannot read or update, and an anonymous user cannot read', async () => {
    await assertFails(getDoc(doc(as(STRANGER), 'notes/note-1')));
    await assertFails(updateDoc(doc(as(STRANGER), 'notes/note-1'), { title: 'x' }));
    await assertFails(getDoc(doc(anonymous(), 'notes/note-1')));
  });

  it('a shared user cannot read a note that is not shared with them', async () => {
    await assertFails(getDoc(doc(as(SHARED), 'notes/private-1')));
  });

  it('a shared user cannot take ownership or change who it is shared with', async () => {
    const db = as(SHARED);
    await assertFails(updateDoc(doc(db, 'notes/note-1'), { userId: SHARED }));
    await assertFails(updateDoc(doc(db, 'notes/note-1'), { sharedWith: arrayUnion(STRANGER) }));
  });

  it('a shared user cannot delete the note', async () => {
    await assertFails(deleteDoc(doc(as(SHARED), 'notes/note-1')));
  });

  it('a note can only be created with the creator as owner', async () => {
    await assertSucceeds(setDoc(doc(as(STRANGER), 'notes/new-1'), { ...baseNote, userId: STRANGER, sharedWith: [] }));
    await assertFails(setDoc(doc(as(STRANGER), 'notes/new-2'), { ...baseNote, userId: OWNER }));
  });

  it('queries must be scoped to owned or shared notes', async () => {
    const db = as(SHARED);
    await assertSucceeds(getDocs(query(collection(db, 'notes'), where('userId', '==', SHARED))));
    await assertSucceeds(getDocs(query(collection(db, 'notes'), where('sharedWith', 'array-contains', SHARED))));
    await assertFails(getDocs(collection(db, 'notes')));
  });

  it('a note created before `sharedWith` existed is still readable by its owner', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'notes/legacy-1'), { title: 'ישן', userId: OWNER });
    });
    await assertSucceeds(getDoc(doc(as(OWNER), 'notes/legacy-1')));
    await assertFails(getDoc(doc(as(STRANGER), 'notes/legacy-1')));
  });
});

// ---------------------------------------------------------------------------
// categories
// ---------------------------------------------------------------------------

describe('categories', () => {
  it('owner manages the category, shared user reads it, stranger cannot', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), 'categories/cat-1'), { name: 'x' }));
    await assertSucceeds(getDoc(doc(as(SHARED), 'categories/cat-1')));
    await assertFails(getDoc(doc(as(STRANGER), 'categories/cat-1')));
  });

  it('only the owner can delete, and nobody can take ownership', async () => {
    await assertFails(deleteDoc(doc(as(SHARED), 'categories/cat-1')));
    await assertFails(updateDoc(doc(as(SHARED), 'categories/cat-1'), { userId: SHARED }));
    await assertSucceeds(deleteDoc(doc(as(OWNER), 'categories/cat-1')));
  });

  it('a category can only be created with the creator as owner', async () => {
    await assertFails(setDoc(doc(as(STRANGER), 'categories/c2'), { ...baseCategory, userId: OWNER }));
  });
});

// ---------------------------------------------------------------------------
// reminders, users, userLookup
// ---------------------------------------------------------------------------

describe('reminders (written only by the Cloud Function)', () => {
  it('owner can read, nobody can write, others cannot read', async () => {
    await assertSucceeds(getDoc(doc(as(OWNER), 'reminders/note-1__item-1')));
    await assertFails(updateDoc(doc(as(OWNER), 'reminders/note-1__item-1'), { sent: true }));
    await assertFails(setDoc(doc(as(OWNER), 'reminders/new'), { userId: OWNER }));
    await assertFails(getDoc(doc(as(SHARED), 'reminders/note-1__item-1')));
  });
});

describe('users and their subcollections', () => {
  it('are private to their owner', async () => {
    await assertSucceeds(getDoc(doc(as(OWNER), `users/${OWNER}`)));
    await assertSucceeds(setDoc(doc(as(OWNER), `users/${OWNER}/fcmTokens/t2`), { token: 't2' }));
    await assertSucceeds(getDoc(doc(as(OWNER), `users/${OWNER}/products/p1`)));
    await assertFails(getDoc(doc(as(STRANGER), `users/${OWNER}`)));
    await assertFails(getDoc(doc(as(STRANGER), `users/${OWNER}/fcmTokens/t1`)));
    await assertFails(getDoc(doc(as(STRANGER), `users/${OWNER}/products/p1`)));
  });
});

describe('userLookup', () => {
  it('a signed-in user can look up an entry by id; an anonymous user cannot', async () => {
    await assertSucceeds(getDoc(doc(as(STRANGER), `userLookup/${OWNER}`)));
    await assertFails(getDoc(doc(anonymous(), `userLookup/${OWNER}`)));
  });

  it('a user writes only their own entry, with only email and displayName', async () => {
    const db = as(STRANGER);
    await assertSucceeds(
      setDoc(doc(db, `userLookup/${STRANGER}`), { email: 'stranger@example.com', displayName: 'S' })
    );
    await assertFails(setDoc(doc(db, `userLookup/${OWNER}`), { email: 'x@example.com', displayName: 'x' }));
    await assertFails(
      setDoc(doc(db, `userLookup/${STRANGER}`), { email: 's@example.com', displayName: 'S', admin: true })
    );
  });
});

// ---------------------------------------------------------------------------
// חורים ידועים - ההתנהגות הנוכחית, שאמורה להשתנות
// ---------------------------------------------------------------------------

describe('known holes (current behavior, expected to change)', () => {
  knownHole('C1 (S-1)', 'any signed-in user can list every entry in userLookup', async () => {
    await assertSucceeds(getDocs(collection(as(STRANGER), 'userLookup')));
  });

  knownHole('C1 (S-1)', "a user can register someone else's email in their own lookup entry", async () => {
    await assertSucceeds(
      setDoc(doc(as(STRANGER), `userLookup/${STRANGER}`), {
        email: 'owner@example.com',
        displayName: 'Not the owner',
      })
    );
  });

  knownHole('C2 (SH-1)', 'a recipient cannot remove themselves from a shared note', async () => {
    await assertFails(updateDoc(doc(as(SHARED), 'notes/note-1'), { sharedWith: arrayRemove(SHARED) }));
  });

  knownHole('C6 (R-2 / SH-2)', "a shared user can move the owner's note to another category", async () => {
    await assertSucceeds(updateDoc(doc(as(SHARED), 'notes/note-1'), { categoryId: 'shared-users-own-category' }));
  });

  knownHole('E3 (R-2)', "a shared user can archive the owner's note", async () => {
    await assertSucceeds(updateDoc(doc(as(SHARED), 'notes/note-1'), { isArchived: true }));
  });

  knownHole('E3 (R-2)', "a shared user can rename the owner's category", async () => {
    await assertSucceeds(updateDoc(doc(as(SHARED), 'categories/cat-1'), { name: 'renamed by shared user' }));
  });

  knownHole('C2 / R-1 (SH-1)', "a new note can be pushed into a stranger's list via sharedWith", async () => {
    await assertSucceeds(
      setDoc(doc(as(OWNER), 'notes/unsolicited'), { ...baseNote, sharedWith: [STRANGER] })
    );
  });

  knownHole('R-3', 'the owner can hand the note to another user by changing userId', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), 'notes/note-1'), { userId: STRANGER }));
  });

  knownHole('R-1', 'there is no size or schema validation on notes', async () => {
    await assertSucceeds(
      updateDoc(doc(as(OWNER), 'notes/note-1'), { title: 'x'.repeat(5000), unexpectedField: true })
    );
  });
});
