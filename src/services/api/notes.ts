/**
 * שירות API לניהול פתקים ב-Firestore
 */

import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import { Note, NoteInput } from '@/types/note';
import { byPinnedThenOrder, toNote } from './mappers';
import { findUserIdByEmail } from './users';
import { logger } from '@/utils/logger';
import { wrapError } from '@/utils/errors';

const NOTES_COLLECTION = 'notes';

const noteRef = (noteId: string) => doc(db, NOTES_COLLECTION, noteId);
const notesRef = () => collection(db, NOTES_COLLECTION);

/**
 * שדות שלא מתעדכנים בעדכון תוכן רגיל.
 *
 * `userId` ו-`sharedWith` הם שדות בעלות - חוקי Firestore חוסמים שינוי שלהם
 * ע"י משתמש משותף. הסינון כאן מונע דחיות מיותרות כשקומפוננטה שולחת בטעות
 * אובייקט פתק שלם, ומוודא ש-`updatedAt` נקבע רק ע"י השרת.
 */
const IMMUTABLE_FIELDS: readonly string[] = [
  'id',
  'userId',
  'sharedWith',
  'createdAt',
  'updatedAt',
];

const stripImmutableFields = (updates: Partial<NoteInput>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(updates).filter(([key]) => !IMMUTABLE_FIELDS.includes(key))
  );

/**
 * יצירת פתק חדש
 */
export const createNote = async (noteInput: NoteInput): Promise<string> => {
  try {
    const docRef = await addDoc(notesRef(), {
      // ברירות המחדל לפני הפיזור: קורא שמעביר ערך מפורש גובר עליהן.
      //
      // `reminderPending` חייב להיכתב תמיד, גם כ-false. הפונקציה המתוזמנת
      // בענן מסננת לפיו, ושאילתת Firestore לא מחזירה מסמכים שהשדה כלל
      // לא קיים בהם - פתק בלי השדה הוא בלתי נראה לה לצמיתות. הערך נקבע
      // כאן ולא אצל הקוראים כי זו נקודת המעבר היחידה ליצירת פתק, ויש
      // יותר מקורא אחד (טופס הפתק, וגם קליטת שיתוף נכנס).
      reminderEnabled: false,
      reminderTime: null,
      reminderPending: false,
      ...noteInput,
      isArchived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    logger.error('Error creating note:', error);
    throw wrapError('שגיאה ביצירת הפתק', error);
  }
};

/**
 * עדכון פתק קיים.
 *
 * מקבל רק את השדות שהשתנו - לא אובייקט פתק שלם. שליחת אובייקט שלם
 * דורסת שינויים מקבילים של משתמשים אחרים וכותבת שדות מיותרים למסמך.
 */
export const updateNote = async (
  noteId: string,
  updates: Partial<NoteInput>
): Promise<void> => {
  try {
    await updateDoc(noteRef(noteId), {
      ...stripImmutableFields(updates),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    logger.error('Error updating note:', error);
    throw wrapError('שגיאה בעדכון הפתק', error);
  }
};

/**
 * מחיקה סופית של פתק
 */
export const permanentlyDeleteNote = async (noteId: string): Promise<void> => {
  try {
    await deleteDoc(noteRef(noteId));
  } catch (error) {
    logger.error('Error deleting note:', error);
    throw wrapError('שגיאה במחיקת הפתק', error);
  }
};

/**
 * קבלת כל הפתקים של קטגוריה ספציפית (שליפה חד-פעמית)
 */
export const getNotesByCategory = async (categoryId: string): Promise<Note[]> => {
  try {
    const snapshot = await getDocs(query(notesRef(), where('categoryId', '==', categoryId)));
    return snapshot.docs.map(toNote).sort(byPinnedThenOrder);
  } catch (error) {
    logger.error('Error getting notes by category:', error);
    throw wrapError('שגיאה בטעינת הפתקים', error);
  }
};

/**
 * מנוי לשינויים בפתקים של משתמש (בבעלותו + משותפים איתו, ללא מאורכבים).
 *
 * Firestore לא תומך ב-OR בין שדות שונים, ולכן נדרשים שני מאזינים
 * שתוצאותיהם ממוזגות. `callback` נקרא בכל פעם שאחד מהם מתעדכן.
 */
export const subscribeToNotes = (
  userId: string,
  callback: (notes: Note[]) => void
): Unsubscribe => {
  let ownedNotes: Note[] = [];
  let sharedNotes: Note[] = [];
  let ownedLoaded = false;
  let sharedLoaded = false;

  const emit = () => {
    // ממתינים לתוצאה ראשונה משני המאזינים כדי לא להבהב רשימה חלקית
    if (!ownedLoaded || !sharedLoaded) return;

    const unique = Array.from(
      new Map([...ownedNotes, ...sharedNotes].map((note) => [note.id, note])).values()
    )
      .filter((note) => !note.isArchived)
      .sort((a, b) => {
        if (a.categoryId !== b.categoryId) return a.categoryId.localeCompare(b.categoryId);
        return byPinnedThenOrder(a, b);
      });

    callback(unique);
  };

  const unsubscribeOwned = onSnapshot(
    query(notesRef(), where('userId', '==', userId)),
    (snapshot) => {
      ownedNotes = snapshot.docs.map(toNote);
      ownedLoaded = true;
      emit();
    },
    (error) => {
      logger.error('Error in owned notes subscription:', error);
      // מסמנים כ"נטען" כדי שכישלון של מאזין אחד לא יתקע את השני
      ownedLoaded = true;
      emit();
    }
  );

  const unsubscribeShared = onSnapshot(
    query(notesRef(), where('sharedWith', 'array-contains', userId)),
    (snapshot) => {
      sharedNotes = snapshot.docs.map(toNote);
      sharedLoaded = true;
      emit();
    },
    (error) => {
      logger.error('Error in shared notes subscription:', error);
      sharedLoaded = true;
      emit();
    }
  );

  return () => {
    unsubscribeOwned();
    unsubscribeShared();
  };
};

/**
 * מנוי לפתקים מאורכבים של משתמש
 */
export const subscribeToArchivedNotes = (
  userId: string,
  callback: (notes: Note[]) => void
): Unsubscribe =>
  onSnapshot(
    query(notesRef(), where('userId', '==', userId), where('isArchived', '==', true)),
    (snapshot) => {
      const notes = snapshot.docs
        .map(toNote)
        .sort((a, b) => (b.archivedAt?.toMillis() ?? 0) - (a.archivedAt?.toMillis() ?? 0));
      callback(notes);
    },
    (error) => logger.error('Error in archived notes subscription:', error)
  );

/**
 * עדכון סדר הפתקים בכתיבה אטומית אחת.
 *
 * `orderedIds` הוא סדר הפתקים הרצוי; המיקום במערך הופך לערך `order`.
 */
export const reorderNotes = async (orderedIds: string[]): Promise<void> => {
  try {
    const batch = writeBatch(db);
    orderedIds.forEach((noteId, index) => {
      batch.update(noteRef(noteId), { order: index, updatedAt: serverTimestamp() });
    });
    await batch.commit();
  } catch (error) {
    logger.error('Error reordering notes:', error);
    throw wrapError('שגיאה בשינוי סדר הפתקים', error);
  }
};

/**
 * הצמדת/ביטול הצמדת פתק
 */
export const togglePinNote = (noteId: string, isPinned: boolean): Promise<void> =>
  updateNote(noteId, { isPinned });

/**
 * העברת פתק לארכיון (מחיקה רכה)
 */
export const archiveNote = async (noteId: string): Promise<void> => {
  try {
    await updateDoc(noteRef(noteId), {
      isArchived: true,
      archivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    logger.error('Error archiving note:', error);
    throw wrapError('שגיאה בהעברת הפתק לארכיון', error);
  }
};

/**
 * שחזור פתק מהארכיון
 */
export const restoreNote = async (noteId: string): Promise<void> => {
  try {
    await updateDoc(noteRef(noteId), {
      isArchived: false,
      archivedAt: null,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    logger.error('Error restoring note:', error);
    throw wrapError('שגיאה בשחזור הפתק', error);
  }
};

/**
 * שיתוף פתק עם משתמש אחר לפי אימייל.
 *
 * `arrayUnion` הוא אטומי - שני שיתופים במקביל לא ידרסו זה את זה.
 */
export const shareNoteWithUser = async (noteId: string, userEmail: string): Promise<void> => {
  const targetUserId = await findUserIdByEmail(userEmail);
  if (!targetUserId) {
    throw new Error('משתמש לא נמצא במערכת');
  }

  const snapshot = await getDoc(noteRef(noteId));
  if (!snapshot.exists()) {
    throw new Error('פתק לא נמצא');
  }

  if (toNote(snapshot).sharedWith.includes(targetUserId)) {
    throw new Error('הפתק כבר משותף עם משתמש זה');
  }

  try {
    await updateDoc(noteRef(noteId), {
      sharedWith: arrayUnion(targetUserId),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    logger.error('Error sharing note:', error);
    throw wrapError('שגיאה בשיתוף הפתק', error);
  }
};

/**
 * הסרת משתמש משיתוף פתק
 */
export const unshareNoteWithUser = async (noteId: string, userId: string): Promise<void> => {
  try {
    await updateDoc(noteRef(noteId), {
      sharedWith: arrayRemove(userId),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    logger.error('Error unsharing note:', error);
    throw wrapError('שגיאה בהסרת השיתוף', error);
  }
};
