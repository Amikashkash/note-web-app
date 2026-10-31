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
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayRemove,
  arrayUnion,
  increment,
  collection,
  deleteDoc,
  disableNetwork,
  doc,
  enableNetwork,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import {
  NOTE_PATCH_FIELDS,
  sanitizeNotePatch,
  type NotePatchField,
} from '../../functions/src/notesCore/permissions';
import {
  getEntry,
  recordEntry,
  setJournalStorage,
  type JournalEntry,
  type JournalStorage,
} from '../../src/utils/draftJournal';
import { createJournalResolver, type ResolverDeps } from '../../src/utils/draftJournalResolver';
import { editDraft, initialSync, markSent, onSnapshot as onSnapshot_, type SyncState } from '../../src/utils/noteSync';
import {
  AdminTimestamp,
  adminDb,
  claudeMarksDone,
  runNoteTrigger,
} from '../../functions/test-emulator/support/claudeOnEmulator';

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

/**
 * מה שהאפליקציה שולחת עם כל כתיבה של תוכן (`updateNote`, מאז v1.26.0).
 * בלעדיו כתיבה של `title`/`content`/`templateType` נדחית (revision, שלב 2).
 */
const BUMP = { revision: increment(1) };

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
    await assertSucceeds(updateDoc(doc(db, 'notes/note-1'), { title: 'חדש', ...BUMP, updatedBy: OWNER }));
    await assertSucceeds(deleteDoc(doc(db, 'notes/note-1')));
  });

  it('a user the note is shared with can read it and edit content', async () => {
    const db = as(SHARED);
    await assertSucceeds(getDoc(doc(db, 'notes/note-1')));
    await assertSucceeds(
      updateDoc(doc(db, 'notes/note-1'), { content: '[{"id":"1"}]', title: 'x', ...BUMP, updatedBy: SHARED })
    );
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
// updatedBy - שלב 2 (B6b, סבב 1 בשיפורים): חובה בכל כתיבה, ותמיד המשתמש המחובר.
// (היו כאן "חורים ידועים" של שלב 1 - כולם התהפכו לבדיקות שנכשלות.)
// ---------------------------------------------------------------------------

describe('notes: updatedBy, phase 2 (required, and always the signed-in user)', () => {
  it('create: required and correct; absent or foreign is denied', async () => {
    const { updatedBy: _omitted, ...withoutWriter } = baseNote;
    await assertFails(setDoc(doc(as(OWNER), 'notes/n-absent'), withoutWriter));
    await assertSucceeds(setDoc(doc(as(OWNER), 'notes/n-correct'), baseNote));
    await assertFails(setDoc(doc(as(OWNER), 'notes/n-wrong'), { ...baseNote, updatedBy: SHARED }));
  });

  it('update: present and correct is allowed', async () => {
    await assertSucceeds(updateDoc(doc(as(SHARED), 'notes/note-1'), { content: 'x', ...BUMP, updatedBy: SHARED }));
  });

  it("an old client's write without updatedBy, over someone else's name, is denied", async () => {
    // note-1 נכתב אחרון ע"י הבעלים. השותף בלי השדה היה משאיר עליו את שם הבעלים
    await assertFails(updateDoc(doc(as(SHARED), 'notes/note-1'), { content: 'x', ...BUMP }));
    await assertFails(updateDoc(doc(as(SHARED), 'notes/note-1'), { isPinned: true }));
  });

  it("a shared user cannot write a third user's name, or re-send the owner's", async () => {
    await assertFails(updateDoc(doc(as(SHARED), 'notes/note-1'), { content: 'x', ...BUMP, updatedBy: STRANGER }));
    await assertFails(updateDoc(doc(as(SHARED), 'notes/note-1'), { content: 'x', ...BUMP, updatedBy: OWNER }));
  });

  it('after a shared user wrote, the owner cannot put the shared user back by hand', async () => {
    await assertSucceeds(updateDoc(doc(as(SHARED), 'notes/note-1'), { title: 'theirs', ...BUMP, updatedBy: SHARED }));
    await assertFails(updateDoc(doc(as(OWNER), 'notes/note-1'), { title: 'mine', ...BUMP, updatedBy: STRANGER }));
    await assertSucceeds(updateDoc(doc(as(OWNER), 'notes/note-1'), { title: 'mine', ...BUMP, updatedBy: OWNER }));
  });

  it('after Claude wrote (mcp:...), an app write must carry the user again', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'notes/by-claude'), { ...baseNote, updatedBy: 'mcp:client:1234abcd' });
    });
    await assertFails(updateDoc(doc(as(OWNER), 'notes/by-claude'), { isPinned: true }));
    await assertSucceeds(updateDoc(doc(as(OWNER), 'notes/by-claude'), { isPinned: true, updatedBy: OWNER }));
  });

  it('a legacy note without updatedBy is edited only with the correct value', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'notes/legacy-2'), { title: 'ישן', userId: OWNER });
    });
    await assertFails(updateDoc(doc(as(OWNER), 'notes/legacy-2'), { title: 'x', ...BUMP }));
    await assertFails(updateDoc(doc(as(OWNER), 'notes/legacy-2'), { title: 'x', ...BUMP, updatedBy: SHARED }));
    await assertSucceeds(updateDoc(doc(as(OWNER), 'notes/legacy-2'), { title: 'x', ...BUMP, updatedBy: OWNER }));
  });

  it('the one case rules cannot see: omitting it on a note you wrote last passes, and changes nothing', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), 'notes/note-1'), { isPinned: true }));
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
    // כמו האפליקציה (ו-MCP, שמעלה revision בכל עריכה): שדה תוכן מעלה את המונה
    const content = ['title', 'content', 'templateType'].includes(field);
    await assertSucceeds(updateDoc(doc(as(uid), 'notes/note-1'), { ...patch, ...(content && BUMP), updatedBy: uid }));
  });
});

// ---------------------------------------------------------------------------
// קריאה בלבד ל-Claude (`isReadOnly`) ו"נוצר ע"י Claude" (`createdVia`)
// ---------------------------------------------------------------------------

describe('read-only for Claude (isReadOnly)', () => {
  it("a shared user cannot set or clear the flag on the owner's note or category", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'notes/readonly-1'), { ...baseNote, isReadOnly: true });
    });
    await assertFails(updateDoc(doc(as(SHARED), 'notes/note-1'), { isReadOnly: true, updatedBy: SHARED }));
    await assertFails(updateDoc(doc(as(SHARED), 'notes/readonly-1'), { isReadOnly: false, updatedBy: SHARED }));
    await assertFails(updateDoc(doc(as(SHARED), 'categories/cat-1'), { isReadOnly: true }));
  });

  it('the owner sets and clears it on notes and categories, and can create with it', async () => {
    await assertSucceeds(updateDoc(doc(as(OWNER), 'notes/note-1'), { isReadOnly: true, updatedBy: OWNER }));
    await assertSucceeds(updateDoc(doc(as(OWNER), 'notes/note-1'), { isReadOnly: false, updatedBy: OWNER }));
    await assertSucceeds(updateDoc(doc(as(OWNER), 'categories/cat-1'), { isReadOnly: true }));
    await assertSucceeds(setDoc(doc(as(OWNER), 'categories/new-ro'), { ...baseCategory, isReadOnly: true }));
  });

  it('a shared user can still edit the content of a read-only note in the app', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'notes/readonly-2'), { ...baseNote, isReadOnly: true });
    });
    await assertSucceeds(updateDoc(doc(as(SHARED), 'notes/readonly-2'), { content: '[]', updatedBy: SHARED }));
  });
});

// ---------------------------------------------------------------------------
// revision (C-1), שלב 2 (סבב 1 בשיפורים): חובה על כתיבת תוכן - בדיוק הקודם + 1.
// כתיבות אחרות לא חייבות, אבל אם נגעו בו - אותו כלל.
// ---------------------------------------------------------------------------

describe('revision (C-1, phase 2: required on content writes)', () => {
  const seedRevision = (revision: number | null) =>
    env.withSecurityRulesDisabled(async (context) => {
      const data = revision === null ? baseNote : { ...baseNote, revision };
      await setDoc(doc(context.firestore(), 'notes/rev-1'), data);
    });

  it.each([
    ['content', { content: 'ישן' }],
    ['title', { title: 'ישן' }],
    ['templateType', { templateType: 'plain' }],
  ])('an old client changing %s without revision is rejected, instead of overwriting', async (_field, change) => {
    await seedRevision(4);
    await assertFails(updateDoc(doc(as(OWNER), 'notes/rev-1'), { ...change, updatedBy: OWNER }));
    await assertFails(updateDoc(doc(as(SHARED), 'notes/rev-1'), { ...change, updatedBy: SHARED }));
  });

  it('a write that does not change content does not need revision', async () => {
    await seedRevision(4);
    await assertSucceeds(updateDoc(doc(as(OWNER), 'notes/rev-1'), { isPinned: true, order: 3, tags: ['x'], updatedBy: OWNER }));
    // אותו ערך כמו בשרת אינו שינוי
    await assertSucceeds(updateDoc(doc(as(OWNER), 'notes/rev-1'), { content: baseNote.content, updatedBy: OWNER }));
  });

  it('a content write on a note from before the field counts from 0', async () => {
    await seedRevision(null);
    await assertFails(updateDoc(doc(as(OWNER), 'notes/rev-1'), { title: 'x', revision: 2, updatedBy: OWNER }));
    await assertSucceeds(updateDoc(doc(as(OWNER), 'notes/rev-1'), { title: 'x', revision: 1, updatedBy: OWNER }));
  });

  /** שמירה של העורך: revision מפורש ו-saveId חדש, כמו `saveNoteText` */
  const save = (uid: string, content: string, revision: number) =>
    updateDoc(doc(as(uid), 'notes/rev-1'), { content, revision, saveId: `s-${Math.random()}`, updatedBy: uid });

  it('a save based on the current version (old + 1) is accepted', async () => {
    await seedRevision(4);
    await assertSucceeds(save(OWNER, 'חדש', 5));
  });

  it('a save based on a stale version is rejected instead of overwriting', async () => {
    await seedRevision(4);
    // המכשיר פתח בגרסה 3, ובינתיים מישהו כתב את 4: הוא שולח 3 + 1 = 4 - אותו ערך שכבר בשרת
    await assertFails(save(OWNER, 'דורס', 4));
    await assertFails(save(SHARED, 'דורס', 4));
  });

  it('skipping ahead is rejected too', async () => {
    await seedRevision(4);
    await assertFails(save(OWNER, 'x', 9));
  });

  it('a note from before the field counts as 0', async () => {
    await seedRevision(null);
    await assertSucceeds(save(OWNER, 'x', 1));
  });

  it('increment(1) always passes, since the rule sees the result', async () => {
    await seedRevision(4);
    await assertSucceeds(updateDoc(doc(as(OWNER), 'notes/rev-1'), { title: 'x', revision: increment(1), updatedBy: OWNER }));
  });

  it('two devices: the first save wins, the second, from the same base, is rejected', async () => {
    await seedRevision(4);
    await assertSucceeds(save(OWNER, 'טלפון', 5));
    await assertFails(save(SHARED, 'מחשב', 5));
  });

  /** שמירה של העורך מ-v1.35.0: עם `baseSaveId` - ה-saveId של מה שהיא נשענת עליו */
  const chained = (uid: string, content: string, revision: number, saveId: string, baseSaveId: string | null) =>
    updateDoc(doc(as(uid), 'notes/rev-1'), { content, revision, saveId, baseSaveId, updatedBy: uid });

  const seedSaved = (revision: number, saveId: string | null) =>
    env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'notes/rev-1'), { ...baseNote, revision, ...(saveId && { saveId }) });
    });

  it('baseSaveId: two queued saves, another device wrote first - both are rejected, nothing is overwritten', async () => {
    await seedSaved(4, 'S4');
    // המחשב offline שמר פעמיים: 5 (על S4) ו-6 (על 5 שלו). בינתיים הטלפון כתב 5
    await assertSucceeds(chained(SHARED, 'מהטלפון', 5, 'P5', 'S4'));
    await assertFails(chained(OWNER, 'מהמחשב', 5, 'C5', 'S4'));
    // ה-revision יוצא נכון במקרה (5 + 1), אבל הבסיס C5 לא בשרת
    await assertFails(chained(OWNER, 'מהמחשב ועוד', 6, 'C6', 'C5'));
  });

  it('baseSaveId: the same queue with nobody in between is accepted in order', async () => {
    await seedSaved(4, 'S4');
    await assertSucceeds(chained(OWNER, 'א', 5, 'C5', 'S4'));
    await assertSucceeds(chained(OWNER, 'אב', 6, 'C6', 'C5'));
  });

  it('baseSaveId: a note without saveId chains from null; a wrong base is rejected', async () => {
    await seedSaved(4, null);
    await assertFails(chained(OWNER, 'x', 5, 'C5', 'S-other'));
    await assertSucceeds(chained(OWNER, 'x', 5, 'C5', null));
  });

  it('baseSaveId: a server write (increment, saveId unchanged) in between - the next save names the same saveId', async () => {
    await seedSaved(4, 'S4');
    // Claude / האיפוס של משימה חוזרת: revision + 1, בלי saveId
    await env.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'notes/rev-1'), { content: 'מ-Claude', revision: 5 });
    });
    await assertFails(chained(OWNER, 'ישן', 5, 'C5', 'S4'));
    await assertSucceeds(chained(OWNER, 'על בסיס Claude', 6, 'C6', 'S4'));
  });

  it('the real offline queue: saves queued while offline, another device writes first, reconnect - nothing is overwritten', async () => {
    await seedSaved(4, 'S4');
    const computer = as(OWNER);
    const phone = as(SHARED);
    await disableNetwork(computer);
    const ref = doc(computer, 'notes/rev-1');
    // שתי שמירות בתור, כמו שהעורך שולח אותן offline
    const first = updateDoc(ref, { content: 'מחשב 1', revision: 5, saveId: 'C5', baseSaveId: 'S4', updatedBy: OWNER });
    const second = updateDoc(ref, { content: 'מחשב 2', revision: 6, saveId: 'C6', baseSaveId: 'C5', updatedBy: OWNER });
    await assertSucceeds(updateDoc(doc(phone, 'notes/rev-1'), { content: 'טלפון', revision: 5, saveId: 'P5', baseSaveId: 'S4', updatedBy: SHARED }));
    await enableNetwork(computer);
    await assertFails(first);
    await assertFails(second);
    let stored: unknown;
    await env.withSecurityRulesDisabled(async (context) => {
      stored = (await getDoc(doc(context.firestore() as unknown as Firestore, 'notes/rev-1'))).data();
    });
    expect(stored).toMatchObject({ content: 'טלפון', revision: 5, saveId: 'P5' });
  });

  knownHole('baseSaveId (until minClientVersion 1.35.0)', 'a client from before baseSaveId still overwrites with a queued second save', async () => {
    await seedSaved(4, 'S4');
    await assertSucceeds(save(SHARED, 'מהטלפון', 5));
    await assertFails(save(OWNER, 'מהמחשב', 5));
    await assertSucceeds(save(OWNER, 'דורס את הטלפון', 6));
  });

  it('a note is created at revision 0 (or without it), never higher', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), 'notes/new-rev'), { ...baseNote, sharedWith: [], revision: 0 }));
    await assertFails(setDoc(doc(as(OWNER), 'notes/new-rev-2'), { ...baseNote, sharedWith: [], revision: 7 }));
  });
});

// ---------------------------------------------------------------------------
// כל סוג כתיבה שהאפליקציה עושה לפתק - חייב לעבור את שלב 2.
// ה-payloads מועתקים מ-`src/services/api/notes.ts` ו-`categories.ts`. כתיבה
// חדשה באפליקציה צריכה שורה כאן. `writeStamp` (notes.ts) כולל `clientVersion`
// מ-v1.33.0; הכתיבות של categories.ts לא.
// ---------------------------------------------------------------------------

describe('every kind of note write the app makes passes phase 2', () => {
  const NOTE = 'notes/app-1';
  const stamp = (uid: string) => ({ updatedBy: uid, updatedAt: serverTimestamp(), clientVersion: '1.33.0' });

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      // נכתב אחרון ע"י הבעלים, revision 4 - כמו פתק אמיתי שנערך כבר
      await setDoc(doc(context.firestore(), NOTE), { ...baseNote, revision: 4, content: '[{"id":"1","text":"א","completed":false}]' });
    });
  });

  const cases: [string, string, (db: Firestore) => Promise<unknown>][] = [
    // createNote (וגם "שמור את שלי כפתק חדש" בהתנגשות)
    ['createNote', OWNER, (db) =>
      setDoc(doc(db, 'notes/app-new'), {
        ...baseNote, sharedWith: [], revision: 0, isArchived: false, createdAt: serverTimestamp(), ...stamp(OWNER),
      })],
    // useNoteEditor.saveNote -> updateNote עם שדות תוכן: increment(1)
    ...[OWNER, SHARED].map((uid): [string, string, (db: Firestore) => Promise<unknown>] => [
      'updateNote (form save)', uid, (db) =>
        updateDoc(doc(db, NOTE), {
          title: 'כותרת', content: '[]', templateType: 'checklist', tags: ['t'], color: '#fff', revision: increment(1), ...stamp(uid),
        }),
    ]),
    // saveNoteText - העורך הפתוח: revision מפורש + saveId + baseSaveId (v1.35.0). גם החלפת תבנית ("המר לטקסט")
    ...[OWNER, SHARED].flatMap((uid): [string, string, (db: Firestore) => Promise<unknown>][] => [
      ['saveNoteText (content)', uid, (db) =>
        updateDoc(doc(db, NOTE), { content: '[{"id":"1","text":"א","completed":true}]', revision: 5, saveId: 's1', baseSaveId: null, ...stamp(uid) })],
      ['saveNoteText (title)', uid, (db) => updateDoc(doc(db, NOTE), { title: 'חדש', revision: 5, saveId: 's2', baseSaveId: null, ...stamp(uid) })],
      ['saveNoteText (convert to text)', uid, (db) =>
        updateDoc(doc(db, NOTE), { templateType: 'plain', revision: 5, saveId: 's3', baseSaveId: null, ...stamp(uid) })],
    ]),
    // appendToNote - "הוסף לפתק" מדף השיתוף, ב-transaction
    ['appendToNote', OWNER, (db) =>
      runTransaction(db, async (tx) => {
        const snapshot = await tx.get(doc(db, NOTE));
        tx.update(doc(db, NOTE), { content: '[]', revision: (snapshot.get('revision') as number) + 1, ...stamp(OWNER) });
      })],
    // restoreNoteVersion
    ...[OWNER, SHARED].map((uid): [string, string, (db: Firestore) => Promise<unknown>] => [
      'restoreNoteVersion', uid, (db) =>
        updateDoc(doc(db, NOTE), {
          title: 'ישן', content: '[]', templateType: 'checklist', tags: [], color: null,
          restoredFrom: 'v1', restoredAt: serverTimestamp(), revision: increment(1), ...stamp(uid),
        }),
    ]),
    // updateNote בלי שדות תוכן: בלי revision
    ['move to category', OWNER, (db) => updateDoc(doc(db, NOTE), { categoryId: 'cat-2', ...stamp(OWNER) })],
    ...[OWNER, SHARED].map((uid): [string, string, (db: Firestore) => Promise<unknown>] => [
      'togglePinNote', uid, (db) => updateDoc(doc(db, NOTE), { isPinned: true, ...stamp(uid) }),
    ]),
    ['setNoteSensitive', OWNER, (db) => updateDoc(doc(db, NOTE), { isSensitive: true, ...stamp(OWNER) })],
    ['setNoteReadOnly', OWNER, (db) => updateDoc(doc(db, NOTE), { isReadOnly: true, ...stamp(OWNER) })],
    ...[OWNER, SHARED].map((uid): [string, string, (db: Firestore) => Promise<unknown>] => [
      'reorderNotes (batch)', uid, (db) => {
        const batch = writeBatch(db);
        batch.update(doc(db, NOTE), { order: 2, ...stamp(uid) });
        return batch.commit();
      },
    ]),
    ['archiveNote', OWNER, (db) => updateDoc(doc(db, NOTE), { isArchived: true, archivedAt: serverTimestamp(), ...stamp(OWNER) })],
    ['restoreNote', OWNER, (db) => updateDoc(doc(db, NOTE), { isArchived: false, archivedAt: null, ...stamp(OWNER) })],
    ['shareNoteWithUser', OWNER, (db) => updateDoc(doc(db, NOTE), { sharedWith: arrayUnion(STRANGER), ...stamp(OWNER) })],
    ['unshareNoteWithUser', OWNER, (db) => updateDoc(doc(db, NOTE), { sharedWith: arrayRemove(SHARED), ...stamp(OWNER) })],
    ['leaveSharedNote', SHARED, (db) => updateDoc(doc(db, NOTE), { sharedWith: arrayRemove(SHARED), ...stamp(SHARED) })],
    // categories.ts: שיתוף קטגוריה, ויציאה ממנה - batch על הפתקים שבה
    ['share a category (notes batch)', OWNER, (db) => {
      const batch = writeBatch(db);
      batch.update(doc(db, NOTE), { sharedWith: arrayUnion(STRANGER), updatedBy: OWNER, updatedAt: serverTimestamp() });
      return batch.commit();
    }],
    ['leaveSharedCategory (notes batch)', SHARED, (db) => {
      const batch = writeBatch(db);
      batch.update(doc(db, NOTE), { sharedWith: arrayRemove(SHARED), updatedBy: SHARED, updatedAt: serverTimestamp() });
      return batch.commit();
    }],
    ['permanentlyDeleteNote', OWNER, (db) => deleteDoc(doc(db, NOTE))],
  ];

  it.each(cases)('%s by %s', async (_name, uid, write) => {
    await assertSucceeds(write(as(uid)));
  });

  it('a sequence on one note: the owner and a shared user alternate, every write passes', async () => {
    await assertSucceeds(updateDoc(doc(as(SHARED), NOTE), { content: '[]', revision: 5, saveId: 'a', ...stamp(SHARED) }));
    await assertSucceeds(updateDoc(doc(as(OWNER), NOTE), { isPinned: true, ...stamp(OWNER) }));
    await assertSucceeds(updateDoc(doc(as(OWNER), NOTE), { title: 'x', revision: 6, saveId: 'b', ...stamp(OWNER) }));
    await assertSucceeds(updateDoc(doc(as(SHARED), NOTE), { title: 'y', revision: increment(1), ...stamp(SHARED) }));
  });
});

// ---------------------------------------------------------------------------
// config/app - minClientVersion (D4a)
// ---------------------------------------------------------------------------

describe('config/app (minClientVersion)', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'config/app'), { minClientVersion: '1.33.0' });
      await setDoc(doc(context.firestore(), 'config/mcp'), { allowedUids: [OWNER] });
    });
  });

  it('every client can read it, signed in or not (the check runs before sign-in too)', async () => {
    await assertSucceeds(getDoc(doc(as(OWNER), 'config/app')));
    await assertSucceeds(getDoc(doc(asUnverified(STRANGER), 'config/app')));
    await assertSucceeds(getDoc(doc(anonymous(), 'config/app')));
  });

  it('a missing config/app is readable too: the app treats it as no minimum', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await deleteDoc(doc(context.firestore(), 'config/app'));
    });
    await assertSucceeds(getDoc(doc(as(OWNER), 'config/app')));
  });

  it('no client can write it - an old version cannot lower the minimum for itself', async () => {
    for (const db of [as(OWNER), anonymous()]) {
      await assertFails(setDoc(doc(db, 'config/app'), { minClientVersion: '0.0.1' }));
      await assertFails(updateDoc(doc(db, 'config/app'), { minClientVersion: '0.0.1' }));
      await assertFails(deleteDoc(doc(db, 'config/app')));
    }
  });

  it('config cannot be listed, and config/mcp stays closed', async () => {
    await assertFails(getDocs(collection(as(OWNER), 'config')));
    await assertFails(getDoc(doc(as(OWNER), 'config/mcp')));
    await assertFails(getDoc(doc(anonymous(), 'config/mcp')));
  });
});

// ---------------------------------------------------------------------------
// conflictEvents - אירוע אנונימי לכל התנגשות שהגיעה לבחירה
// ---------------------------------------------------------------------------

describe('conflictEvents (anonymous conflict measurement)', () => {
  const event = () => ({
    at: serverTimestamp(),
    reason: 'same-field',
    fields: ['text'],
    templateType: 'checklist',
    clientVersion: '1.34.0',
  });

  it('a signed-in user can create one, with every allowed reason and field', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), 'conflictEvents/e1'), event()));
    for (const reason of ['title', 'text', 'unreadable', 'schedule', 'edit-vs-delete', 'both-added', 'unconfirmed']) {
      await assertSucceeds(setDoc(doc(as(OWNER), `conflictEvents/${reason}`), { ...event(), reason, fields: [] }));
    }
    await assertSucceeds(
      setDoc(doc(as(OWNER), 'conflictEvents/all-fields'), {
        ...event(),
        reason: 'schedule',
        fields: ['completed', 'dueDate', 'dueTime', 'repeat', 'repeatBase', 'other'],
      })
    );
  });

  it('nothing that identifies a user, a note or content can be attached', async () => {
    for (const extra of [{ uid: OWNER }, { noteId: 'note-1' }, { content: 'חלב' }, { title: 'קניות' }]) {
      await assertFails(setDoc(doc(as(OWNER), 'conflictEvents/e2'), { ...event(), ...extra }));
    }
    // ערך של שדה במקום שם של שדה
    await assertFails(setDoc(doc(as(OWNER), 'conflictEvents/e3'), { ...event(), fields: ['חלב סויה'] }));
    await assertFails(setDoc(doc(as(OWNER), 'conflictEvents/e4'), { ...event(), templateType: 'חלב' }));
    await assertFails(setDoc(doc(as(OWNER), 'conflictEvents/e5'), { ...event(), reason: 'חלב' }));
    await assertFails(setDoc(doc(as(OWNER), 'conflictEvents/e6'), { ...event(), clientVersion: 'x'.repeat(21) }));
  });

  it('the time is the server time, and every field is required', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'conflictEvents/e7'), { ...event(), at: Timestamp.fromMillis(0) }));
    const { clientVersion: _omit, ...partial } = event();
    await assertFails(setDoc(doc(as(OWNER), 'conflictEvents/e8'), partial));
  });

  it('not signed in cannot create; nobody can read, list, change or delete', async () => {
    await assertFails(setDoc(doc(anonymous(), 'conflictEvents/e9'), event()));
    await assertSucceeds(setDoc(doc(as(OWNER), 'conflictEvents/e10'), event()));
    await assertFails(getDoc(doc(as(OWNER), 'conflictEvents/e10')));
    await assertFails(getDocs(collection(as(OWNER), 'conflictEvents')));
    await assertFails(updateDoc(doc(as(OWNER), 'conflictEvents/e10'), { reason: 'text' }));
    await assertFails(deleteDoc(doc(as(OWNER), 'conflictEvents/e10')));
  });
});

// ---------------------------------------------------------------------------
// "הפתק פתוח" - סימוני נוכחות
// ---------------------------------------------------------------------------

describe('presence markers (note open elsewhere)', () => {
  const marker = (uid: string, extra: Record<string, unknown> = {}) => ({
    uid,
    device: 'iPhone',
    refreshedAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
    ...extra,
  });

  it('the owner and a shared user each write and refresh their own marker', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), 'notes/note-1/presence/s-owner'), marker(OWNER)));
    await assertSucceeds(setDoc(doc(as(SHARED), 'notes/note-1/presence/s-shared'), marker(SHARED)));
    await assertSucceeds(setDoc(doc(as(OWNER), 'notes/note-1/presence/s-owner'), marker(OWNER)));
  });

  it('both can see who has the note open; a stranger cannot', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), 'notes/note-1/presence/s-owner'), marker(OWNER)));
    await assertSucceeds(getDocs(collection(as(SHARED), 'notes/note-1/presence')));
    await assertFails(getDocs(collection(as(STRANGER), 'notes/note-1/presence')));
  });

  it('a stranger cannot mark the note as open', async () => {
    await assertFails(setDoc(doc(as(STRANGER), 'notes/note-1/presence/s-x'), marker(STRANGER)));
  });

  it('nobody writes a marker in someone else\'s name, or takes over or deletes it', async () => {
    await assertFails(setDoc(doc(as(SHARED), 'notes/note-1/presence/s-fake'), marker(OWNER)));
    await assertSucceeds(setDoc(doc(as(OWNER), 'notes/note-1/presence/s-owner'), marker(OWNER)));
    await assertFails(setDoc(doc(as(SHARED), 'notes/note-1/presence/s-owner'), marker(SHARED)));
    await assertFails(deleteDoc(doc(as(SHARED), 'notes/note-1/presence/s-owner')));
    await assertSucceeds(deleteDoc(doc(as(OWNER), 'notes/note-1/presence/s-owner')));
  });

  it('the refresh time is the server time, and the expiry at most 5 minutes ahead', async () => {
    await assertFails(
      setDoc(doc(as(OWNER), 'notes/note-1/presence/s-1'), marker(OWNER, { refreshedAt: Timestamp.fromMillis(Date.now() + 86_400_000) }))
    );
    await assertFails(
      setDoc(doc(as(OWNER), 'notes/note-1/presence/s-2'), marker(OWNER, { expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000) }))
    );
    await assertFails(setDoc(doc(as(OWNER), 'notes/note-1/presence/s-3'), marker(OWNER, { extra: 'x' })));
  });

  describe('typedAt ("typing now" - the only thing that blocks Claude, v1.39.0)', () => {
    const ref = (id: string) => doc(as(OWNER), `notes/note-1/presence/${id}`);
    const readTypedAt = async (id: string) => {
      let value: unknown;
      await env.withSecurityRulesDisabled(async (context) => {
        value = (await getDoc(doc(context.firestore() as unknown as Firestore, `notes/note-1/presence/${id}`))).get('typedAt');
      });
      return value as Timestamp | undefined;
    };

    it('the app writes it as the server time', async () => {
      await assertSucceeds(setDoc(ref('t-1'), marker(OWNER, { typedAt: serverTimestamp() }), { merge: true }));
    });

    it('a made-up time is refused - nobody can block Claude for a day, or claim to have typed earlier', async () => {
      await assertFails(setDoc(ref('t-2'), marker(OWNER, { typedAt: Timestamp.fromMillis(Date.now() + 86_400_000) })));
      await assertFails(setDoc(ref('t-3'), marker(OWNER, { typedAt: Timestamp.fromMillis(Date.now() - 1_000) })));
    });

    it('the periodic refresh (merge, without typedAt) keeps the signal as it was', async () => {
      await assertSucceeds(setDoc(ref('t-4'), marker(OWNER, { typedAt: serverTimestamp() }), { merge: true }));
      const typed = await readTypedAt('t-4');
      await assertSucceeds(setDoc(ref('t-4'), marker(OWNER), { merge: true }));
      expect((await readTypedAt('t-4'))?.toMillis()).toBe(typed?.toMillis());
    });

    it('an existing signal cannot be moved to another time by hand', async () => {
      await assertSucceeds(setDoc(ref('t-5'), marker(OWNER, { typedAt: serverTimestamp() }), { merge: true }));
      await assertFails(
        setDoc(ref('t-5'), marker(OWNER, { typedAt: Timestamp.fromMillis(Date.now() + 3_600_000) }), { merge: true })
      );
    });

    it('a marker of an older app version, without typedAt, is still accepted', async () => {
      await assertSucceeds(setDoc(ref('t-6'), marker(OWNER)));
    });
  });
});

describe('created by Claude (createdVia)', () => {
  const seedMcpNote = () =>
    env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'notes/mcp-1'), { ...baseNote, createdVia: 'mcp' });
    });

  it('the app cannot create a note that claims to be created by Claude', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'notes/fake-mcp'), { ...baseNote, sharedWith: [], createdVia: 'mcp' }));
  });

  it('nobody can add, change or remove the marker from the app, not even the owner', async () => {
    await seedMcpNote();
    await assertFails(updateDoc(doc(as(OWNER), 'notes/note-1'), { createdVia: 'mcp', updatedBy: OWNER }));
    await assertFails(updateDoc(doc(as(OWNER), 'notes/mcp-1'), { createdVia: 'app', updatedBy: OWNER }));
    await assertFails(updateDoc(doc(as(SHARED), 'notes/mcp-1'), { createdVia: 'app', updatedBy: SHARED }));
  });

  it('a note Claude created is edited normally in the app', async () => {
    await seedMcpNote();
    await assertSucceeds(updateDoc(doc(as(OWNER), 'notes/mcp-1'), { title: 'ערוך', ...BUMP, updatedBy: OWNER }));
    await assertSucceeds(updateDoc(doc(as(SHARED), 'notes/mcp-1'), { content: '[{"id":"1"}]', ...BUMP, updatedBy: SHARED }));
  });
});

describe("Claude's audit log and idempotency keys", () => {
  const seedAudit = () =>
    env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'auditLog/a1'), { uid: OWNER, action: 'note.create', target: { id: 'n1' } });
      await setDoc(doc(db, 'mcpIdempotency/k1'), { uid: OWNER, noteId: 'n1' });
    });

  it('the owner reads and lists their own entries', async () => {
    await seedAudit();
    await assertSucceeds(getDoc(doc(as(OWNER), 'auditLog/a1')));
    await assertSucceeds(getDocs(query(collection(as(OWNER), 'auditLog'), where('uid', '==', OWNER))));
  });

  it('nobody else reads them, and nobody lists all entries', async () => {
    await seedAudit();
    await assertFails(getDoc(doc(as(STRANGER), 'auditLog/a1')));
    await assertFails(getDoc(doc(as(SHARED), 'auditLog/a1')));
    await assertFails(getDocs(collection(as(OWNER), 'auditLog')));
  });

  it('no client writes or deletes the log, not even the owner', async () => {
    await seedAudit();
    await assertFails(setDoc(doc(as(OWNER), 'auditLog/a2'), { uid: OWNER, action: 'note.create' }));
    await assertFails(updateDoc(doc(as(OWNER), 'auditLog/a1'), { action: 'nothing' }));
    await assertFails(deleteDoc(doc(as(OWNER), 'auditLog/a1')));
  });

  it('idempotency keys are closed to clients', async () => {
    await seedAudit();
    await assertFails(getDoc(doc(as(OWNER), 'mcpIdempotency/k1')));
    await assertFails(setDoc(doc(as(OWNER), 'mcpIdempotency/k2'), { uid: OWNER }));
  });
});

describe('rateLimits (findUserByEmail counters)', () => {
  it('are never readable or writable by a client', async () => {
    await assertFails(getDoc(doc(as(OWNER), `rateLimits/findUserByEmail_${OWNER}`)));
    await assertFails(setDoc(doc(as(OWNER), `rateLimits/findUserByEmail_${OWNER}`), { minute: { count: 0 } }));
  });
});

// ---------------------------------------------------------------------------
// שרת ה-MCP: Authorization Server (mcp-plan §8.1)
// ---------------------------------------------------------------------------

describe('MCP OAuth collections', () => {
  const seedOAuth = () =>
    env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const owned = { uid: OWNER, clientId: 'c1' };
      await setDoc(doc(db, 'oauthClients/c1'), { clientName: 'Claude', redirectUris: [] });
      await setDoc(doc(db, 'oauthRequests/r1'), { ...owned, status: 'pending' });
      await setDoc(doc(db, 'oauthCodes/h1'), { ...owned, used: false });
      await setDoc(doc(db, 'oauthTokens/h2'), { ...owned, type: 'access' });
      await setDoc(doc(db, 'oauthGrants/g1'), { ...owned, revoked: false });
      await setDoc(doc(db, 'config/mcp'), { allowedUids: [OWNER] });
    });

  it.each(['oauthClients/c1', 'oauthRequests/r1', 'oauthCodes/h1', 'oauthTokens/h2', 'config/mcp'])(
    '%s is never readable or writable, not even by the user it belongs to',
    async (path) => {
      await seedOAuth();
      for (const uid of [OWNER, STRANGER]) {
        await assertFails(getDoc(doc(as(uid), path)));
        await assertFails(setDoc(doc(as(uid), path), { uid, allowedUids: [uid] }));
        await assertFails(deleteDoc(doc(as(uid), path)));
      }
    }
  );

  it('a user cannot add themselves to the MCP allowlist', async () => {
    await assertFails(setDoc(doc(as(STRANGER), 'config/mcp'), { allowedUids: [STRANGER], openToAll: true }));
  });

  it('the owner of a grant can read it and list their own grants', async () => {
    await seedOAuth();
    await assertSucceeds(getDoc(doc(as(OWNER), 'oauthGrants/g1')));
    await assertSucceeds(getDocs(query(collection(as(OWNER), 'oauthGrants'), where('uid', '==', OWNER))));
  });

  it('nobody else can read a grant or list all grants', async () => {
    await seedOAuth();
    await assertFails(getDoc(doc(as(STRANGER), 'oauthGrants/g1')));
    await assertFails(getDocs(collection(as(OWNER), 'oauthGrants')));
  });

  it('a grant cannot be written by a client, not even to revoke it', async () => {
    await seedOAuth();
    await assertFails(updateDoc(doc(as(OWNER), 'oauthGrants/g1'), { revoked: true }));
    await assertFails(setDoc(doc(as(OWNER), 'oauthGrants/g2'), { uid: OWNER, revoked: false }));
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
      updateDoc(doc(as(OWNER), 'notes/note-1'), { title: 'x'.repeat(5000), unexpectedField: true, ...BUMP, updatedBy: OWNER })
    );
  });
});

/**
 * `draftJournal` (צעד 5 בסבב 2) מול ה-emulator, עם ה-SDK האמיתי וה-rules
 * האמיתיים: הפער מ-PR #21. שמירה שהמתינה offline, הסשן נגמר (ה-promise שלה
 * כבר לא מעניין אף אחד), מכשיר אחר כתב קודם, והיא נדחית. סשן חדש, שיש לו רק
 * את הרשומה ב-journal, מכריע: מיזוג או עותק - ובלי לאבד.
 */
describe('draftJournal against the emulator (offline, session ends, another device writes, next session)', () => {
  const NOTE = 'notes/j-1';
  const store = new Map<string, string>();
  const memoryStorage: JournalStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    keys: () => [...store.keys()],
  };

  beforeEach(() => {
    store.clear();
    setJournalStorage(memoryStorage);
  });

  const seed = (data: Record<string, unknown>) =>
    env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore() as unknown as Firestore, NOTE), { ...baseNote, ...data });
    });

  const readAs = async (path: string) => {
    let data: Record<string, unknown> | undefined;
    await env.withSecurityRulesDisabled(async (context) => {
      data = (await getDoc(doc(context.firestore() as unknown as Firestore, path))).data();
    });
    return data;
  };

  const waitFor = async (check: () => Promise<boolean> | boolean, ms = 8000) => {
    const until = Date.now() + ms;
    while (!(await check())) {
      if (Date.now() > until) throw new Error('timed out');
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };

  const journaled = (overrides: Partial<JournalEntry>): JournalEntry => ({
    noteId: 'j-1',
    saveId: 'C5',
    revision: 5,
    text: { title: baseNote.title, content: '' },
    templateType: 'plain',
    base: null,
    meta: { categoryId: 'cat-1', tags: [], color: null, isSensitive: false, isReadOnly: false },
    clientVersion: 'test',
    tabId: 'previous-session',
    at: 0,
    ...overrides,
  });

  /** ה-deps של האפליקציה (`useDraftJournal`), על Firestore של הסשן החדש */
  const resolverFor = (db: Firestore, overrides: Partial<ResolverDeps> = {}) =>
    createJournalResolver({
      uid: OWNER,
      tabId: 'this-session',
      clientVersion: 'test',
      now: Date.now,
      newSaveId: () => `M-${Math.random().toString(36).slice(2)}`,
      subscribe: (noteId, onView) =>
        onSnapshot(
          doc(db, `notes/${noteId}`),
          { includeMetadataChanges: true },
          (snapshot) => {
            const data = snapshot.data();
            onView({
              kind: 'snapshot',
              exists: snapshot.exists(),
              fromCache: snapshot.metadata.fromCache,
              pending: snapshot.metadata.hasPendingWrites,
              title: data?.title ?? '',
              content: data?.content ?? '',
              templateType: data?.templateType ?? 'plain',
              revision: data?.revision ?? 0,
              saveId: data?.saveId ?? null,
            });
          },
          () => onView({ kind: 'unreadable' })
        ),
      isEditorOpen: () => false,
      writesBlocked: () => false,
      // כמו `recoveryCopyExists`: פתק שלא קיים נדחה ע"י ה-rules
      copyExists: async (copyId) => {
        try {
          return (await getDocFromServer(doc(db, `notes/${copyId}`))).exists();
        } catch (error) {
          if ((error as { code?: string }).code === 'permission-denied') return false;
          throw error;
        }
      },
      // כמו `createRecoveryCopy` → `createNoteWithId`
      createCopy: (copyId, entry) =>
        setDoc(doc(db, `notes/${copyId}`), {
          title: `טקסט שלא נשמר - ${entry.text.title}`,
          content: entry.text.content,
          templateType: entry.templateType,
          categoryId: entry.meta.categoryId,
          tags: entry.meta.tags,
          color: entry.meta.color,
          userId: OWNER,
          order: 0,
          sharedWith: [],
          isPinned: false,
          isSensitive: entry.meta.isSensitive,
          isReadOnly: entry.meta.isReadOnly,
          revision: 0,
          isArchived: false,
          createdAt: serverTimestamp(),
          updatedBy: OWNER,
          updatedAt: serverTimestamp(),
        }),
      // כמו `saveNoteText`
      saveText: (noteId, text, chain) => updateDoc(doc(db, `notes/${noteId}`), { ...text, ...chain, updatedBy: OWNER }),
      report: () => undefined,
      setTimer: (callback, ms) => setTimeout(callback, ms),
      onError: () => undefined,
      ...overrides,
    });

  /** הסשן הקודם: שמירה בתור offline, ונרשמת ב-journal; ואז מכשיר אחר כותב, והחיבור חוזר */
  const rejectedOfflineSave = async (
    mine: Record<string, unknown>,
    theirs: Record<string, unknown>,
    entry: JournalEntry
  ) => {
    const previousSession = as(OWNER);
    await disableNetwork(previousSession);
    recordEntry(OWNER, entry);
    const queued = updateDoc(doc(previousSession, NOTE), {
      ...mine,
      revision: 5,
      saveId: 'C5',
      baseSaveId: 'S4',
      updatedBy: OWNER,
    });
    await assertSucceeds(
      updateDoc(doc(as(SHARED), NOTE), { ...theirs, revision: 5, saveId: 'P5', baseSaveId: 'S4', updatedBy: SHARED })
    );
    await enableNetwork(previousSession);
    await assertFails(queued);
  };

  const countCopies = async () => {
    let copies = 0;
    await env.withSecurityRulesDisabled(async (context) => {
      const all = await getDocs(collection(context.firestore() as unknown as Firestore, 'notes'));
      copies = all.docs.filter((d) => d.id.startsWith('recovery-')).length;
    });
    return copies;
  };

  it('plain text edited on both sides: ONE copy with the offline text, and the note keeps the other device text', async () => {
    await seed({ templateType: 'plain', content: 'בסיס', revision: 4, saveId: 'S4' });
    const entry = journaled({
      text: { title: baseNote.title, content: 'מהמחשב offline' },
      base: { title: baseNote.title, content: 'בסיס', revision: 4 },
    });
    await rejectedOfflineSave({ content: 'מהמחשב offline' }, { content: 'מהטלפון' }, entry);

    const resolver = resolverFor(as(OWNER));
    resolver.sync();
    await waitFor(async () => (await readAs('notes/recovery-C5')) !== undefined);
    await waitFor(() => getEntry(OWNER, 'j-1') === null);
    resolver.stop();

    expect(await readAs('notes/recovery-C5')).toMatchObject({ content: 'מהמחשב offline', userId: OWNER, revision: 0 });
    expect(await readAs(NOTE)).toMatchObject({ content: 'מהטלפון', revision: 5, saveId: 'P5' });

    // הפעלה נוספת עם אותה רשומה (נשארה בלשונית אחרת): אין עותק שני, והעותק לא משתנה
    recordEntry(OWNER, entry);
    const again = resolverFor(as(OWNER));
    again.sync();
    await waitFor(() => getEntry(OWNER, 'j-1') === null);
    again.stop();
    expect(await countCopies()).toBe(1);
  });

  it('a checklist with different items changed: the next session writes the merge, and the rules accept it', async () => {
    const list = (a: boolean, b: string) =>
      JSON.stringify([
        { id: 'a', text: 'חלב', completed: a },
        { id: 'b', text: b, completed: false },
      ]);
    await seed({ templateType: 'checklist', content: list(false, 'לחם'), revision: 4, saveId: 'S4' });
    const entry = journaled({
      templateType: 'checklist',
      text: { title: baseNote.title, content: list(true, 'לחם') },
      base: { title: baseNote.title, content: list(false, 'לחם'), revision: 4 },
    });
    await rejectedOfflineSave({ content: list(true, 'לחם') }, { content: list(false, 'לחם מלא') }, entry);

    const resolver = resolverFor(as(OWNER));
    resolver.sync();
    await waitFor(async () => (await readAs(NOTE))?.revision === 6);
    await waitFor(() => getEntry(OWNER, 'j-1') === null);
    resolver.stop();

    expect(await readAs(NOTE)).toMatchObject({ content: list(true, 'לחם מלא'), revision: 6, baseSaveId: 'P5' });
    expect(await countCopies()).toBe(0);
  });

  it('the offline save landed (nobody wrote in between): the record is dropped, nothing else is written', async () => {
    await seed({ templateType: 'plain', content: 'בסיס', revision: 4, saveId: 'S4' });
    const previousSession = as(OWNER);
    await disableNetwork(previousSession);
    recordEntry(
      OWNER,
      journaled({ text: { title: baseNote.title, content: 'מהמחשב' }, base: { title: baseNote.title, content: 'בסיס', revision: 4 } })
    );
    const queued = updateDoc(doc(previousSession, NOTE), {
      content: 'מהמחשב',
      revision: 5,
      saveId: 'C5',
      baseSaveId: 'S4',
      updatedBy: OWNER,
    });
    await enableNetwork(previousSession);
    await assertSucceeds(queued);

    const resolver = resolverFor(as(OWNER));
    resolver.sync();
    await waitFor(() => getEntry(OWNER, 'j-1') === null);
    resolver.stop();
    expect(await readAs(NOTE)).toMatchObject({ content: 'מהמחשב', revision: 5, saveId: 'C5' });
    expect(await countCopies()).toBe(0);
  });

  it('the note was deleted meanwhile: the listener is refused, and the text becomes a copy', async () => {
    await seed({ templateType: 'plain', content: 'בסיס', revision: 4, saveId: 'S4' });
    recordEntry(OWNER, journaled({ text: { title: baseNote.title, content: 'לא נשמר' } }));
    await env.withSecurityRulesDisabled(async (context) => {
      await deleteDoc(doc(context.firestore() as unknown as Firestore, NOTE));
    });
    const resolver = resolverFor(as(OWNER));
    resolver.sync();
    await waitFor(async () => (await readAs('notes/recovery-C5')) !== undefined);
    resolver.stop();
    expect(await readAs('notes/recovery-C5')).toMatchObject({ content: 'לא נשמר' });
  });
});

/**
 * כלי העריכה של Claude מול עורך פתוח באפליקציה (v1.39.0): נחסמים **רק**
 * כשהמשתמש מקליד (`typedAt` טרי). מקצה לקצה על ה-emulator: הסימון נכתב
 * מהאפליקציה דרך ה-rules, העריכה היא `UserScope.editNote` האמיתי של השרת,
 * והעורך הפתוח הוא `noteSync` של האפליקציה מעל מאזין של ה-SDK האמיתי.
 */
describe('Claude edits while the note is open in the app (typing signal, v1.39.0)', () => {
  const NOTE_ID = 'typing-1';
  const NOTE = `notes/${NOTE_ID}`;
  const items = (a: boolean, bText = 'לחם') =>
    JSON.stringify([
      { id: 'a', text: 'חלב', completed: a },
      { id: 'b', text: bText, completed: false },
    ]);

  const seedNote = () =>
    env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await setDoc(doc(db, 'categories/cat-1'), { name: 'בית', icon: null, order: 0, userId: OWNER, sharedWith: [], isSensitive: false, isReadOnly: false });
      await setDoc(doc(db, NOTE), {
        ...baseNote,
        sharedWith: [],
        isSensitive: false,
        isReadOnly: false,
        templateType: 'checklist',
        content: items(false),
        revision: 4,
        saveId: 'S4',
      });
    });

  const storedNote = async () => {
    let data: Record<string, unknown> | undefined;
    await env.withSecurityRulesDisabled(async (context) => {
      data = (await getDoc(doc(context.firestore() as unknown as Firestore, NOTE))).data();
    });
    return data ?? {};
  };

  const waitFor = async (check: () => boolean, ms = 8000) => {
    const until = Date.now() + ms;
    while (!check()) {
      if (Date.now() > until) throw new Error('timed out');
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  };

  /** העורך הפתוח של האפליקציה: `noteSync` מעל מאזין עם metadata, כמו `useNoteSync` */
  const openEditor = async (app: Firestore) => {
    let state: SyncState | null = null;
    const actions: string[] = [];
    let pendingLocalPatch = false;
    const stop = onSnapshot(doc(app, NOTE), { includeMetadataChanges: true }, (snapshot) => {
      const data = snapshot.data();
      if (!data) return;
      const live = {
        title: data.title,
        content: data.content,
        templateType: data.templateType,
        revision: data.revision ?? 0,
        saveId: data.saveId ?? null,
        pending: snapshot.metadata.hasPendingWrites,
      };
      if (state === null) {
        if (!live.pending) state = initialSync(live);
        return;
      }
      const result = onSnapshot_(state, live, pendingLocalPatch);
      state = result.state;
      if (result.action.kind !== 'none') actions.push(result.action.kind);
    });
    await waitFor(() => state !== null);
    return {
      stop,
      get state() {
        return state as SyncState;
      },
      actions,
      /** הקלדה שעוד לא נשלחה (בתוך ה-debounce) */
      typeLocally: (content: string) => {
        state = editDraft(state as SyncState, { content });
        pendingLocalPatch = true;
      },
      /** השמירה של העורך (כמו `saveNoteText`), אחרי מיזוג */
      save: async () => {
        pendingLocalPatch = false;
        const sent = markSent(state as SyncState, 'E-merged');
        state = sent.state;
        await updateDoc(doc(app, NOTE), {
          content: sent.state.draft.content,
          revision: sent.revision,
          saveId: sent.saveId,
          baseSaveId: sent.baseSaveId,
          updatedBy: OWNER,
        });
      },
    };
  };

  const marker = (extra: Record<string, unknown> = {}) => ({
    uid: OWNER,
    device: 'iPhone',
    refreshedAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
    ...extra,
  });

  it('TYPING: the app wrote "typing now" - Claude is refused, nothing changes, and the reason names the device', async () => {
    await seedNote();
    const app = as(OWNER);
    await assertSucceeds(setDoc(doc(app, `${NOTE}/presence/s1`), marker({ typedAt: serverTimestamp() }), { merge: true }));

    await expect(claudeMarksDone(OWNER, NOTE_ID, 'a')).rejects.toMatchObject({ name: 'UserTypingError', devices: ['iPhone'] });
    expect(await storedNote()).toMatchObject({ content: items(false), revision: 4 });
  });

  it('OPEN BUT IDLE: Claude applies, and the open editor adopts it silently; the version before is in the history', async () => {
    await seedNote();
    const app = as(OWNER);
    // פתוח (רענון טרי), והקליד לאחרונה לפני 2 דקות - לא חוסם
    await assertSucceeds(setDoc(doc(app, `${NOTE}/presence/s1`), marker(), { merge: true }));
    await adminDb.doc(`${NOTE}/presence/s1`).update({ typedAt: AdminTimestamp.fromMillis(Date.now() - 120_000) });
    const editor = await openEditor(app);
    const before = await storedNote();

    await claudeMarksDone(OWNER, NOTE_ID, 'a');
    await waitFor(() => editor.state.base.revision === 5);
    editor.stop();

    expect(editor.actions).toEqual(['adopted']);
    expect(editor.state.draft.content).toBe(items(true));
    expect(editor.state.conflict).toBeNull();
    // ההיסטוריה שומרת את מה שהיה לפני Claude
    await runNoteTrigger(NOTE_ID, before);
    const versions = (await adminDb.collection(`${NOTE}/versions`).get()).docs.map((version) => version.data());
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ content: items(false) });
  });

  it('OPEN, a change not yet saved in another task: Claude applies, the editor MERGES both, and its save is accepted', async () => {
    await seedNote();
    const app = as(OWNER);
    await assertSucceeds(setDoc(doc(app, `${NOTE}/presence/s1`), marker(), { merge: true }));
    const editor = await openEditor(app);
    // הקלדה במשימה b שעוד לא נשלחה (בלי סימון "מקליד" - כמו אחרי 75 שניות שקט)
    editor.typeLocally(items(false, 'לחם מלא'));

    await claudeMarksDone(OWNER, NOTE_ID, 'a');
    await waitFor(() => editor.actions.length > 0);
    expect(editor.actions).toEqual(['merged']);
    expect(editor.state.draft.content).toBe(items(true, 'לחם מלא'));

    await editor.save();
    editor.stop();
    expect(await storedNote()).toMatchObject({ content: items(true, 'לחם מלא'), revision: 6, baseSaveId: 'S4' });
  });

  it('A STALE SIGNAL from a closed tab (typed 90 seconds ago, never refreshed): Claude applies', async () => {
    await seedNote();
    await adminDb.doc(`${NOTE}/presence/old-tab`).set({
      uid: OWNER,
      device: 'מחשב Windows',
      refreshedAt: AdminTimestamp.fromMillis(Date.now() - 90_000),
      typedAt: AdminTimestamp.fromMillis(Date.now() - 90_000),
      expiresAt: AdminTimestamp.fromMillis(Date.now() - 30_000),
    });
    await claudeMarksDone(OWNER, NOTE_ID, 'a');
    expect(await storedNote()).toMatchObject({ content: items(true), revision: 5 });
  });

  it('a marker of an older app version (open, no typedAt) no longer blocks', async () => {
    await seedNote();
    await assertSucceeds(setDoc(doc(as(OWNER), `${NOTE}/presence/s1`), marker()));
    await claudeMarksDone(OWNER, NOTE_ID, 'a');
    expect(await storedNote()).toMatchObject({ content: items(true), revision: 5 });
  });
});
