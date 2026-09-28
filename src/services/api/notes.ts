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
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/services/firebase/config';
import { Note, NoteInput } from '@/types/note';
import type { NoteVersion } from '@/types/version';
import { byPinnedThenOrder, toNote } from './mappers';
import { findUserIdByEmail } from './users';
import { logger } from '@/utils/logger';
import { wrapError } from '@/utils/errors';
import { appendSnippet, type AppendResult, type SharedSnippet } from '@/utils/templateContent';

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
  // נקבע רק בשרת, כשהפתק נוצר ע"י Claude (ה-rules חוסמים שינוי)
  'createdVia',
  'userId',
  'sharedWith',
  'createdAt',
  'updatedAt',
  'updatedBy',
];

/**
 * חותמת הכותב לכל כתיבה לפתק: מי ומתי.
 *
 * `updatedBy` חובה בכל כתיבה - `firestore.rules` דוחים כתיבה שבה הוא לא
 * שווה למשתמש המחובר, כך ששותף לא יכול להתחזות לבעלים. היסטוריית הגרסאות
 * (בטריגר בענן) נשענת עליו כדי לדעת מי שינה, ולפתוח גרסה כשהכותב מתחלף.
 */
const writeStamp = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('משתמש לא מחובר');
  }
  return { updatedBy: uid, updatedAt: serverTimestamp() };
};

const stripImmutableFields = (updates: Partial<NoteInput>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(updates).filter(([key]) => !IMMUTABLE_FIELDS.includes(key))
  );

/** שדות התוכן: כתיבה שלהם מעלה את `revision` (C-1) */
const CONTENT_FIELDS: readonly string[] = ['title', 'content', 'templateType'];

const touchesContent = (updates: object): boolean => Object.keys(updates).some((key) => CONTENT_FIELDS.includes(key));

/**
 * יצירת פתק חדש
 */
export const createNote = async (noteInput: NoteInput): Promise<string> => {
  try {
    const docRef = await addDoc(notesRef(), {
      ...noteInput,
      revision: 0,
      isArchived: false,
      createdAt: serverTimestamp(),
      ...writeStamp(),
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
      // כתיבה של תוכן מעלה את המונה, כדי שפתק פתוח במכשיר אחר יזהה אותה.
      // `increment` תמיד עובר את ה-rule (old + 1); מי שצריך בדיקת התנגשות
      // (העורך הפתוח) משתמש ב-`saveNoteText` עם revision מפורש.
      ...(touchesContent(updates) && { revision: increment(1) }),
      ...writeStamp(),
    });
  } catch (error) {
    logger.error('Error updating note:', error);
    throw wrapError('שגיאה בעדכון הפתק', error);
  }
};

export interface NoteTextPatch {
  title?: string;
  content?: string;
  templateType?: Note['templateType'];
}

/**
 * שמירה מהעורך הפתוח, עם בדיקת התנגשות (C-1).
 *
 * `revision` הוא מפורש: הגרסה שהעריכה נשענת עליה + 1. ה-rules מקבלים
 * רק `old + 1`, כך שאם מישהו אחר כתב בינתיים (מכשיר אחר, או Claude),
 * הכתיבה נדחית - גם אם היא המתינה offline - במקום לדרוס. הדחייה חוזרת
 * כ-`permission-denied`, וה-snapshot חוזר לגרסת השרת; העורך מזהה זאת
 * ומציג בחירה, בלי לאבד את הטקסט.
 */
export const saveNoteText = (noteId: string, patch: NoteTextPatch, revision: number): Promise<void> =>
  updateDoc(noteRef(noteId), {
    ...patch,
    revision,
    // משתנה בכל שמירה, כדי שה-rules תמיד יבדקו אותה (ראו revisionPhase1)
    saveId: crypto.randomUUID(),
    ...writeStamp(),
  });

/** מה שהעורך הפתוח צריך מהמסמך: התוכן, המונה, והאם זה הד מקומי */
export interface LiveNoteText {
  exists: boolean;
  title: string;
  content: string;
  templateType: string;
  revision: number;
  /** hasPendingWrites: כתיבה מקומית שהשרת עוד לא אישר */
  pending: boolean;
}

/**
 * מאזין למסמך אחד, עם metadata. המאזין הכללי (`subscribeToNotes`) לא
 * מבחין בין הד מקומי לגרסה מאושרת, וההבחנה הזו היא מה שמאפשר לזהות
 * שכתיבה שלנו נדחתה. עלות: קריאה אחת בפתיחה ואחת לכל שינוי בפתק הפתוח.
 */
export const subscribeToNoteText = (
  noteId: string,
  onChange: (note: LiveNoteText) => void,
  onError: (error: unknown) => void
): Unsubscribe =>
  onSnapshot(
    noteRef(noteId),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange({ exists: false, title: '', content: '', templateType: 'plain', revision: 0, pending: false });
        return;
      }
      const note = toNote(snapshot);
      onChange({
        exists: true,
        title: note.title,
        content: note.content,
        templateType: note.templateType,
        revision: note.revision,
        pending: snapshot.metadata.hasPendingWrites,
      });
    },
    onError
  );

/**
 * הוספת תוכן משותף לפתק קיים, על התוכן העדכני בשרת.
 *
 * בתוך transaction ולא על עותק מהזיכרון: הפתק עשוי להשתנות בין הרגע
 * שבו נבחר בדף השיתוף לבין השמירה (למשל שותף שמסמן פריט), וכתיבה
 * שמבוססת על עותק ישן הייתה מוחקת את השינוי הזה.
 *
 * כשאי אפשר להוסיף (סוג פתק שלא תומך, תוכן לא תקין) לא נכתב דבר,
 * והסיבה מוחזרת לקורא.
 */
export const appendToNote = async (
  noteId: string,
  snippet: SharedSnippet
): Promise<AppendResult> => {
  try {
    return await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(noteRef(noteId));
      if (!snapshot.exists()) {
        throw new Error('הפתק לא נמצא');
      }

      const note = toNote(snapshot);
      const result = appendSnippet(note.content, note.templateType, snippet);

      if (result.ok) {
        transaction.update(noteRef(noteId), {
          content: result.content,
          revision: note.revision + 1,
          ...writeStamp(),
        });
      }
      return result;
    });
  } catch (error) {
    logger.error('Error appending to note:', error);
    throw wrapError('שגיאה בהוספה לפתק', error);
  }
};

/**
 * שחזור גרסה קודמת - עדכון רגיל של שדות התוכן.
 *
 * `restoredFrom`/`restoredAt` מסמנים לטריגר שזה שחזור, כדי שישמור את
 * המצב שלפניו כגרסה גם בתוך חלון עשר הדקות. כך אפשר לבטל שחזור, כמו
 * כל שינוי אחר. קטגוריה וארכוב לא משוחזרים: אלה פעולות נפרדות.
 */
export const restoreNoteVersion = async (noteId: string, version: NoteVersion): Promise<void> => {
  try {
    await updateDoc(noteRef(noteId), {
      title: version.title,
      content: version.content,
      templateType: version.templateType,
      tags: version.tags,
      color: version.color,
      restoredFrom: version.id,
      restoredAt: serverTimestamp(),
      revision: increment(1),
      ...writeStamp(),
    });
  } catch (error) {
    logger.error('Error restoring note version:', error);
    throw wrapError('שגיאה בשחזור הגרסה', error);
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
  callback: (notes: Note[]) => void,
  onError: (error: unknown) => void = () => undefined
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
      // מסמנים כ"נטען" כדי שכישלון של מאזין אחד לא יתקע את השני, ומדווחים
      // לקורא - בלי זה הממשק הציג רשימה ריקה כאילו אין פתקים (ST-1)
      ownedLoaded = true;
      emit();
      onError(error);
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
      onError(error);
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
  callback: (notes: Note[]) => void,
  onError: (error: unknown) => void = () => undefined
): Unsubscribe =>
  onSnapshot(
    query(notesRef(), where('userId', '==', userId), where('isArchived', '==', true)),
    (snapshot) => {
      const notes = snapshot.docs
        .map(toNote)
        .sort((a, b) => (b.archivedAt?.toMillis() ?? 0) - (a.archivedAt?.toMillis() ?? 0));
      callback(notes);
    },
    (error) => {
      logger.error('Error in archived notes subscription:', error);
      onError(error);
    }
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
      batch.update(noteRef(noteId), { order: index, ...writeStamp() });
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
 * סימון/ביטול סימון פתק כרגיש (מוסתר מ-Claude). רק הבעלים - ה-rules
 * דוחים את זה משותף. לא יוצר גרסה בהיסטוריה: `isSensitive` אינו שדה
 * תוכן (ראה `VERSIONED_FIELDS` ב-`functions/src/versions.ts`).
 */
export const setNoteSensitive = (noteId: string, isSensitive: boolean): Promise<void> =>
  updateNote(noteId, { isSensitive });

/**
 * קריאה בלבד ל-Claude: הוא רואה את הפתק, אבל כלי עריכה עתידיים יסרבו
 * לשנות אותו. רק הבעלים (rules). לא יוצר גרסה - אינו שדה תוכן.
 */
export const setNoteReadOnly = (noteId: string, isReadOnly: boolean): Promise<void> =>
  updateNote(noteId, { isReadOnly });

/**
 * העברת פתק לארכיון (מחיקה רכה)
 */
export const archiveNote = async (noteId: string): Promise<void> => {
  try {
    await updateDoc(noteRef(noteId), {
      isArchived: true,
      archivedAt: serverTimestamp(),
      ...writeStamp(),
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
      ...writeStamp(),
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
    throw new Error('לא נמצא משתמש עם האימייל הזה. אם הוא נרשם עם אימייל וסיסמה, ייתכן שעוד לא אימת את הכתובת');
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
      ...writeStamp(),
    });
  } catch (error) {
    logger.error('Error sharing note:', error);
    throw wrapError('שגיאה בשיתוף הפתק', error);
  }
};

/**
 * הנמען מסיר את עצמו משיתוף פתק (SH-1).
 *
 * הבעלים יכול לשתף שוב בכל רגע. ה-rules מתירים לנמען רק את זה: להוריד
 * את עצמו מ-`sharedWith`, בלי לגעת בשום שדה אחר.
 */
export const leaveSharedNote = async (noteId: string): Promise<void> => {
  const stamp = writeStamp();
  try {
    await updateDoc(noteRef(noteId), {
      sharedWith: arrayRemove(stamp.updatedBy),
      ...stamp,
    });
  } catch (error) {
    logger.error('Error leaving shared note:', error);
    throw wrapError('שגיאה בהסרה מהשיתוף', error);
  }
};

/**
 * הסרת משתמש משיתוף פתק
 */
export const unshareNoteWithUser = async (noteId: string, userId: string): Promise<void> => {
  try {
    await updateDoc(noteRef(noteId), {
      sharedWith: arrayRemove(userId),
      ...writeStamp(),
    });
  } catch (error) {
    logger.error('Error unsharing note:', error);
    throw wrapError('שגיאה בהסרת השיתוף', error);
  }
};
