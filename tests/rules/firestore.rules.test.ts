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
import {
  NOTE_PATCH_FIELDS,
  sanitizeNotePatch,
  type NotePatchField,
} from '../../functions/src/notesCore/permissions';

const OWNER = 'owner-uid';
const SHARED = 'shared-uid';
const STRANGER = 'stranger-uid';

let env: RulesTestEnvironment;

// ה-context מחזיר את הטיפוס של ה-compat SDK. בזמן ריצה הוא עובד עם
// הפונקציות המודולריות, ורק הטיפוסים לא תואמים - לכן ההמרה.
const as = (uid: string) =>
  env
    .authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true })
    .firestore() as unknown as Firestore;

/** משתמש שנכנס עם אימייל וסיסמה ולא אימת את האימייל */
const asUnverified = (uid: string) =>
  env
    .authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: false })
    .firestore() as unknown as Firestore;
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
  updatedBy: OWNER,
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
    await setDoc(doc(db, 'notes/note-1/versions/v1'), { content: 'ישן', authoredBy: OWNER });
    await setDoc(doc(db, 'notes/private-1/versions/v1'), { content: 'ישן', authoredBy: OWNER });
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
    await assertSucceeds(updateDoc(doc(db, 'notes/note-1'), { title: 'חדש', updatedBy: OWNER }));
    await assertSucceeds(deleteDoc(doc(db, 'notes/note-1')));
  });

  it('a user the note is shared with can read it and edit content', async () => {
    const db = as(SHARED);
    await assertSucceeds(getDoc(doc(db, 'notes/note-1')));
    await assertSucceeds(updateDoc(doc(db, 'notes/note-1'), { content: '[{"id":"1"}]', title: 'x', updatedBy: SHARED }));
  });

  it('a stranger cannot read or update, and an anonymous user cannot read', async () => {
    await assertFails(getDoc(doc(as(STRANGER), 'notes/note-1')));
    await assertFails(updateDoc(doc(as(STRANGER), 'notes/note-1'), { title: 'x', updatedBy: STRANGER }));
    await assertFails(getDoc(doc(anonymous(), 'notes/note-1')));
  });

  it('a shared user cannot read a note that is not shared with them', async () => {
    await assertFails(getDoc(doc(as(SHARED), 'notes/private-1')));
  });

  it('a shared user cannot take ownership or change who it is shared with', async () => {
    const db = as(SHARED);
    await assertFails(updateDoc(doc(db, 'notes/note-1'), { userId: SHARED, updatedBy: SHARED }));
    await assertFails(updateDoc(doc(db, 'notes/note-1'), { sharedWith: arrayUnion(STRANGER), updatedBy: SHARED }));
  });

  it('a shared user cannot delete the note', async () => {
    await assertFails(deleteDoc(doc(as(SHARED), 'notes/note-1')));
  });

  it('a note can only be created with the creator as owner', async () => {
    await assertSucceeds(setDoc(doc(as(STRANGER), 'notes/new-1'), { ...baseNote, userId: STRANGER, sharedWith: [], updatedBy: STRANGER }));
    await assertFails(setDoc(doc(as(STRANGER), 'notes/new-2'), { ...baseNote, userId: OWNER, updatedBy: STRANGER }));
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
// updatedBy - שלב 1: אם נכתב, חייב להיות המשתמש המחובר
// ---------------------------------------------------------------------------

describe('notes: updatedBy, phase 1 (optional, but never someone else)', () => {
  it('create: absent is allowed, present and correct is allowed, present and wrong is denied', async () => {
    const { updatedBy: _omitted, ...withoutWriter } = baseNote;
    await assertSucceeds(setDoc(doc(as(OWNER), 'notes/n-absent'), withoutWriter));
    await assertSucceeds(setDoc(doc(as(OWNER), 'notes/n-correct'), baseNote));
    await assertFails(setDoc(doc(as(OWNER), 'notes/n-wrong'), { ...baseNote, updatedBy: SHARED }));
  });

  it('update: absent is allowed (an old client keeps saving)', async () => {
    await assertSucceeds(updateDoc(doc(as(SHARED), 'notes/note-1'), { content: 'from an old client' }));
  });

  it('update: present and correct is allowed', async () => {
    await assertSucceeds(updateDoc(doc(as(SHARED), 'notes/note-1'), { content: 'x', updatedBy: SHARED }));
  });

  it("update: present and wrong is denied - a shared user cannot write a third user's name", async () => {
    await assertFails(updateDoc(doc(as(SHARED), 'notes/note-1'), { content: 'x', updatedBy: STRANGER }));
  });

  it('update: after a shared user wrote, the owner cannot put the shared user back by hand', async () => {
    await assertSucceeds(updateDoc(doc(as(SHARED), 'notes/note-1'), { title: 'theirs', updatedBy: SHARED }));
    await assertFails(updateDoc(doc(as(OWNER), 'notes/note-1'), { title: 'mine', updatedBy: STRANGER }));
    await assertSucceeds(updateDoc(doc(as(OWNER), 'notes/note-1'), { title: 'mine', updatedBy: OWNER }));
  });

  it('update: a legacy note without updatedBy accepts the correct value, not a foreign one', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'notes/legacy-2'), { title: 'ישן', userId: OWNER });
    });
    await assertFails(updateDoc(doc(as(OWNER), 'notes/legacy-2'), { title: 'x', updatedBy: SHARED }));
    await assertSucceeds(updateDoc(doc(as(OWNER), 'notes/legacy-2'), { title: 'x', updatedBy: OWNER }));
  });
});

// ---------------------------------------------------------------------------
// updatedBy - שלב 2 (צעד B6b): שדה חובה. ההתנהגות הנוכחית, שתתהפך.
//
// כל אחת מהבדיקות כאן מתעדת מה שלב 1 עדיין מתיר. כשהכלל של שלב 2 ייכנס
// הן ייכשלו - וזה הסימן להפוך אותן ל-assertFails.
// ---------------------------------------------------------------------------

/** "שלב 2": ההתנהגות של שלב 1, שאמורה להשתנות כש-updatedBy יהפוך לחובה */
const phase2 = (name: string, fn: () => Promise<unknown>) =>
  knownHole('B6b (updatedBy required)', name, fn);

describe('notes: updatedBy, phase 2 (expected to flip)', () => {
  phase2('a note can be created without updatedBy', async () => {
    const { updatedBy: _omitted, ...withoutWriter } = baseNote;
    await assertSucceeds(setDoc(doc(as(OWNER), 'notes/n-phase2'), withoutWriter));
  });

  phase2("a shared user's change without updatedBy keeps the owner's name on it", async () => {
    await assertSucceeds(updateDoc(doc(as(SHARED), 'notes/note-1'), { content: 'x' }));
  });

  phase2("a shared user re-sending the owner's current name is indistinguishable from omitting it", async () => {
    await assertSucceeds(updateDoc(doc(as(SHARED), 'notes/note-1'), { content: 'x', updatedBy: OWNER }));
  });

  phase2('a legacy note can be edited without ever setting updatedBy', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'notes/legacy-3'), { title: 'ישן', userId: OWNER });
    });
    await assertSucceeds(updateDoc(doc(as(OWNER), 'notes/legacy-3'), { title: 'x' }));
  });
});

// ---------------------------------------------------------------------------
// notes/{noteId}/versions - נכתב רק ע"י הטריגר
// ---------------------------------------------------------------------------

describe('note versions', () => {
  it('can be read by whoever can read the note', async () => {
    await assertSucceeds(getDoc(doc(as(OWNER), 'notes/note-1/versions/v1')));
    await assertSucceeds(getDoc(doc(as(SHARED), 'notes/note-1/versions/v1')));
    await assertSucceeds(getDocs(collection(as(SHARED), 'notes/note-1/versions')));
  });

  it('cannot be read by someone who cannot read the note', async () => {
    await assertFails(getDoc(doc(as(STRANGER), 'notes/note-1/versions/v1')));
    await assertFails(getDocs(collection(as(STRANGER), 'notes/note-1/versions')));
    await assertFails(getDoc(doc(as(SHARED), 'notes/private-1/versions/v1')));
    await assertFails(getDoc(doc(anonymous(), 'notes/note-1/versions/v1')));
  });

  it('is no longer readable after the user is removed from the share', async () => {
    await updateDoc(doc(as(OWNER), 'notes/note-1'), { sharedWith: [], updatedBy: OWNER });
    await assertFails(getDoc(doc(as(SHARED), 'notes/note-1/versions/v1')));
  });

  it('can never be written by a client, not even the owner', async () => {
    for (const uid of [OWNER, SHARED]) {
      const db = as(uid);
      await assertFails(setDoc(doc(db, 'notes/note-1/versions/new'), { content: 'fake' }));
      await assertFails(updateDoc(doc(db, 'notes/note-1/versions/v1'), { content: 'changed' }));
      await assertFails(deleteDoc(doc(db, 'notes/note-1/versions/v1')));
    }
  });

  it('cannot be read once the note is deleted', async () => {
    await deleteDoc(doc(as(OWNER), 'notes/note-1'));
    await assertFails(getDoc(doc(as(OWNER), 'notes/note-1/versions/v1')));
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

describe('userLookup (C1 / S-1)', () => {
  it('a signed-in user can get an entry by id; an anonymous user cannot', async () => {
    await assertSucceeds(getDoc(doc(as(STRANGER), `userLookup/${OWNER}`)));
    await assertFails(getDoc(doc(anonymous(), `userLookup/${OWNER}`)));
  });

  // היה "known hole": כל משתמש מחובר יכול היה לשלוף את כל האימיילים
  it('no one can list the collection, not even with a filter', async () => {
    await assertFails(getDocs(collection(as(STRANGER), 'userLookup')));
    await assertFails(
      getDocs(query(collection(as(STRANGER), 'userLookup'), where('email', '==', 'owner@example.com')))
    );
  });

  it('a user writes their own entry with their own verified email', async () => {
    await assertSucceeds(
      setDoc(doc(as(STRANGER), `userLookup/${STRANGER}`), {
        email: `${STRANGER}@example.com`,
        displayName: 'S',
      })
    );
  });

  // היה "known hole": אפשר היה לרשום אימייל של מישהו אחר ולקבל את השיתופים שלו
  it("a user cannot register someone else's email", async () => {
    await assertFails(
      setDoc(doc(as(STRANGER), `userLookup/${STRANGER}`), {
        email: 'owner@example.com',
        displayName: 'Not the owner',
      })
    );
  });

  it('an unverified email cannot be registered, even your own', async () => {
    await assertFails(
      setDoc(doc(asUnverified(STRANGER), `userLookup/${STRANGER}`), {
        email: `${STRANGER}@example.com`,
        displayName: 'S',
      })
    );
  });

  it('the email is compared case-insensitively to the token', async () => {
    const upper = env
      .authenticatedContext(STRANGER, { email: 'Stranger-UID@Example.com', email_verified: true })
      .firestore() as unknown as Firestore;
    await assertSucceeds(
      setDoc(doc(upper, `userLookup/${STRANGER}`), { email: 'stranger-uid@example.com', displayName: 'S' })
    );
  });

  it("no one can write someone else's entry, or add fields", async () => {
    await assertFails(
      setDoc(doc(as(STRANGER), `userLookup/${OWNER}`), { email: `${STRANGER}@example.com`, displayName: 'x' })
    );
    await assertFails(
      setDoc(doc(as(STRANGER), `userLookup/${STRANGER}`), {
        email: `${STRANGER}@example.com`,
        displayName: 'S',
        admin: true,
      })
    );
  });

  it('a user can delete their own entry only', async () => {
    await assertFails(deleteDoc(doc(as(STRANGER), `userLookup/${OWNER}`)));
    await assertSucceeds(deleteDoc(doc(as(OWNER), `userLookup/${OWNER}`)));
  });
});

// ---------------------------------------------------------------------------
// נמען מסיר את עצמו משיתוף (C2 / SH-1)
// ---------------------------------------------------------------------------

describe('leaving a share (C2 / SH-1)', () => {
  const seedGroupShare = () =>
    env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'notes/group-1'), { ...baseNote, sharedWith: [SHARED, STRANGER] });
      await setDoc(doc(db, 'categories/group-cat'), { ...baseCategory, sharedWith: [SHARED, STRANGER] });
    });

  // היה "known hole": לנמען לא הייתה דרך להיפטר מפתק ששותף איתו
  it('a recipient can remove themselves from a shared note', async () => {
    await assertSucceeds(
      updateDoc(doc(as(SHARED), 'notes/note-1'), { sharedWith: arrayRemove(SHARED), updatedBy: SHARED })
    );
    await assertFails(getDoc(doc(as(SHARED), 'notes/note-1')));
  });

  it('a recipient can remove themselves from a shared category', async () => {
    await assertSucceeds(updateDoc(doc(as(SHARED), 'categories/cat-1'), { sharedWith: arrayRemove(SHARED) }));
    await assertFails(getDoc(doc(as(SHARED), 'categories/cat-1')));
  });

  it('removing yourself leaves the other recipients in place', async () => {
    await seedGroupShare();
    await assertSucceeds(
      updateDoc(doc(as(SHARED), 'notes/group-1'), { sharedWith: arrayRemove(SHARED), updatedBy: SHARED })
    );
    await assertSucceeds(getDoc(doc(as(STRANGER), 'notes/group-1')));
  });

  it('a recipient cannot remove someone else', async () => {
    await seedGroupShare();
    await assertFails(
      updateDoc(doc(as(SHARED), 'notes/group-1'), { sharedWith: arrayRemove(STRANGER), updatedBy: SHARED })
    );
    await assertFails(updateDoc(doc(as(SHARED), 'categories/group-cat'), { sharedWith: arrayRemove(STRANGER) }));
    await assertFails(updateDoc(doc(as(SHARED), 'notes/group-1'), { sharedWith: [], updatedBy: SHARED }));
  });

  it('leaving cannot be combined with any other change', async () => {
    await assertFails(
      updateDoc(doc(as(SHARED), 'notes/note-1'), {
        sharedWith: arrayRemove(SHARED),
        content: 'last edit on the way out',
        updatedBy: SHARED,
      })
    );
    await assertFails(
      updateDoc(doc(as(SHARED), 'categories/cat-1'), { sharedWith: arrayRemove(SHARED), name: 'renamed' })
    );
  });

  it('someone the note is not shared with cannot use it to join or change anything', async () => {
    await assertFails(
      updateDoc(doc(as(STRANGER), 'notes/note-1'), { sharedWith: arrayRemove(STRANGER), updatedBy: STRANGER })
    );
    await assertFails(
      updateDoc(doc(as(SHARED), 'notes/note-1'), { sharedWith: arrayUnion(SHARED, STRANGER), updatedBy: SHARED })
    );
  });

  it('the owner can still remove anyone', async () => {
    await seedGroupShare();
    await assertSucceeds(
      updateDoc(doc(as(OWNER), 'notes/group-1'), { sharedWith: arrayRemove(STRANGER), updatedBy: OWNER })
    );
  });
});

// ---------------------------------------------------------------------------
// פתקים וקטגוריות רגישים (C6, §12.5 בסקירה)
// ---------------------------------------------------------------------------

describe('sensitive notes and categories (C6)', () => {
  const seedSensitive = () =>
    env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'notes/secret-1'), { ...baseNote, isSensitive: true });
      await setDoc(doc(db, 'categories/secret-cat'), { ...baseCategory, isSensitive: true });
    });

  it("a shared user cannot mark the owner's note sensitive, or clear it", async () => {
    await seedSensitive();
    await assertFails(updateDoc(doc(as(SHARED), 'notes/note-1'), { isSensitive: true, updatedBy: SHARED }));
    await assertFails(updateDoc(doc(as(SHARED), 'notes/secret-1'), { isSensitive: false, updatedBy: SHARED }));
  });

  it("a shared user cannot mark the owner's category sensitive, or clear it", async () => {
    await seedSensitive();
    await assertFails(updateDoc(doc(as(SHARED), 'categories/cat-1'), { isSensitive: true }));
    await assertFails(updateDoc(doc(as(SHARED), 'categories/secret-cat'), { isSensitive: false }));
  });

  // היה "known hole": שותף העביר פתק לקטגוריה שלו, והפתק נעלם מהבעלים (SH-2)
  // ויצא מקטגוריה רגישה
  it("a shared user cannot move the owner's note to another category", async () => {
    await seedSensitive();
    await assertFails(
      updateDoc(doc(as(SHARED), 'notes/note-1'), { categoryId: 'shared-users-own-category', updatedBy: SHARED })
    );
    await assertFails(
      updateDoc(doc(as(SHARED), 'notes/secret-1'), { categoryId: 'shared-users-own-category', updatedBy: SHARED })
    );
  });

  it('a shared user can still edit the content of a sensitive note', async () => {
    await seedSensitive();
    await assertSucceeds(updateDoc(doc(as(SHARED), 'notes/secret-1'), { content: '[]', updatedBy: SHARED }));
  });

  it('the owner can set and clear the flag on notes and categories, and move notes', async () => {
    await seedSensitive();
    await assertSucceeds(updateDoc(doc(as(OWNER), 'notes/note-1'), { isSensitive: true, updatedBy: OWNER }));
    await assertSucceeds(updateDoc(doc(as(OWNER), 'notes/secret-1'), { isSensitive: false, updatedBy: OWNER }));
    await assertSucceeds(updateDoc(doc(as(OWNER), 'categories/cat-1'), { isSensitive: true }));
    await assertSucceeds(updateDoc(doc(as(OWNER), 'categories/secret-cat'), { isSensitive: false }));
    await assertSucceeds(updateDoc(doc(as(OWNER), 'notes/note-1'), { categoryId: 'cat-2', updatedBy: OWNER }));
  });

  it('a note or category can be created sensitive by its owner', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), 'notes/new-secret'), { ...baseNote, isSensitive: true }));
    await assertSucceeds(setDoc(doc(as(OWNER), 'categories/new-secret'), { ...baseCategory, isSensitive: true }));
  });

  it('a recipient can still leave a sensitive note', async () => {
    await seedSensitive();
    await assertSucceeds(
      updateDoc(doc(as(SHARED), 'notes/secret-1'), { sharedWith: arrayRemove(SHARED), updatedBy: SHARED })
    );
  });
});

// ---------------------------------------------------------------------------
// הרשאות notesCore (שרת ה-MCP) - תת-קבוצה של ה-rules (mcp-plan §3.2.5)
//
// ה-Admin SDK עוקף את ה-rules, ולכן כל שדה ש-`sanitizeNotePatch` מתיר
// למשתמש חייב להיות מותר לו גם כאן. שדה חדש ב-`NOTE_PATCH_FIELDS` בלי
// ערך לדוגמה כאן מכשיל את הבדיקה.
// ---------------------------------------------------------------------------

describe('notesCore permissions are a subset of the rules', () => {
  const SAMPLE: Record<NotePatchField, unknown> = {
    title: 'כותרת מ-MCP',
    content: '[{"id":"1","text":"x","completed":false}]',
    isPinned: true,
    isArchived: true,
    categoryId: 'cat-2',
  };

  const users = { owner: OWNER, shared: SHARED } as const;
  const cases = (Object.entries(NOTE_PATCH_FIELDS) as [NotePatchField, 'read' | 'write' | 'owner'][]).flatMap(
    ([field, need]) =>
      (['owner', 'shared'] as const)
        .filter((access) => access === 'owner' || need !== 'owner')
        .map((access) => [field, access] as const)
  );

  it.each(cases)('%s by the %s is allowed by the rules too', async (field, access) => {
    const uid = users[access];
    const patch = sanitizeNotePatch({ [field]: SAMPLE[field] }, access);
    await assertSucceeds(updateDoc(doc(as(uid), 'notes/note-1'), { ...patch, updatedBy: uid }));
  });
});

describe('rateLimits (findUserByEmail counters)', () => {
  it('are never readable or writable by a client', async () => {
    await assertFails(getDoc(doc(as(OWNER), `rateLimits/findUserByEmail_${OWNER}`)));
    await assertFails(setDoc(doc(as(OWNER), `rateLimits/findUserByEmail_${OWNER}`), { minute: { count: 0 } }));
  });
});

// ---------------------------------------------------------------------------
// חורים ידועים - ההתנהגות הנוכחית, שאמורה להשתנות
// ---------------------------------------------------------------------------

describe('known holes (current behavior, expected to change)', () => {
  knownHole('E3 (R-2)', "a shared user can archive the owner's note", async () => {
    await assertSucceeds(updateDoc(doc(as(SHARED), 'notes/note-1'), { isArchived: true, updatedBy: SHARED }));
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
    await assertSucceeds(updateDoc(doc(as(OWNER), 'notes/note-1'), { userId: STRANGER, updatedBy: OWNER }));
  });

  knownHole('R-1', 'there is no size or schema validation on notes', async () => {
    await assertSucceeds(
      updateDoc(doc(as(OWNER), 'notes/note-1'), { title: 'x'.repeat(5000), unexpectedField: true, updatedBy: OWNER })
    );
  });
});
