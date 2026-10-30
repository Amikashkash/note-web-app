/**
 * טקסט שלא נשמר לא נעלם (C-1).
 *
 * שמירה מהעורך נדחית כשמישהו אחר כתב בינתיים (בדיקת `revision` ב-rules).
 * כשהעורך עדיין פתוח, הוא מציג למשתמש בחירה. אבל הדחייה יכולה להגיע
 * אחרי שהעורך נסגר: שמירה אחרונה בסגירה, או כתיבה שהמתינה offline ונשלחה
 * כשהחיבור חזר - אולי רק בהפעלה הבאה של האפליקציה. אז אין מי שיציג בחירה.
 *
 * מאז v1.36.0 את זה מכריע `draftJournal` (`utils/draftJournal.ts`): מיזוג
 * כשבטוח, ואחרת פתק חדש, "טקסט שלא נשמר", עם מה שהמשתמש כתב, באותה
 * קטגוריה. הפתק המקורי נשאר כפי שהוא בשרת. כך אף צד לא מאבד.
 *
 * לעותק יש מזהה קבוע לכל שמירה (`recoveryCopyId`), ולכן הוא נוצר פעם אחת:
 * קודם נוצר עותק לכל שמירה שנדחתה, ושתי שמירות בתור הולידו שני עותקים.
 */

import { createNoteWithId, noteExistsOnServer } from './notes';
import { LENGTH_LIMITS } from '@/utils/constants';
import { getFirebaseErrorCode } from '@/utils/errors';
import type { JournalEntry } from '@/utils/draftJournal';

/** עורכים פתוחים: להם יש ממשק התנגשות משלהם */
const openEditors = new Map<string, number>();
const closeListeners = new Set<(noteId: string) => void>();

/** נרשם בפתיחת עורך. מחזיר ביטול רישום לסגירה */
export const registerOpenEditor = (noteId: string): (() => void) => {
  openEditors.set(noteId, (openEditors.get(noteId) ?? 0) + 1);
  return () => {
    const count = (openEditors.get(noteId) ?? 1) - 1;
    if (count > 0) {
      openEditors.set(noteId, count);
      return;
    }
    openEditors.delete(noteId);
    // שמירה שנדחתה בזמן שהעורך היה פתוח ולא הוכרעה שם - עכשיו תורו של ה-journal
    closeListeners.forEach((listener) => listener(noteId));
  };
};

export const isEditorOpen = (noteId: string): boolean => openEditors.has(noteId);

export const onEditorClosed = (listener: (noteId: string) => void): (() => void) => {
  closeListeners.add(listener);
  return () => closeListeners.delete(listener);
};

export const recoveryTitle = (title: string): string =>
  `טקסט שלא נשמר - ${title || 'ללא כותרת'}`.slice(0, LENGTH_LIMITS.NOTE_TITLE);

/**
 * האם העותק כבר נוצר (בלשונית אחרת, או בהפעלה קודמת). פתק שלא קיים נדחה
 * ע"י ה-rules (הם קוראים את `resource.data`) - וזו התשובה "לא". עותק קיים
 * הוא תמיד שלנו, ולכן נקרא. בלי חיבור - נכשל, וננסה שוב.
 */
export const recoveryCopyExists = async (copyId: string): Promise<boolean> => {
  try {
    return await noteExistsOnServer(copyId);
  } catch (error) {
    if (getFirebaseErrorCode(error) === 'permission-denied') return false;
    throw error;
  }
};

/**
 * העותק של שמירה שנדחתה. `uid` - המשתמש המחובר, שהוא בעלי העותק (גם כשהפתק
 * המקורי משותף ושייך למישהו אחר).
 */
export const createRecoveryCopy = (copyId: string, entry: JournalEntry, uid: string): Promise<void> =>
  createNoteWithId(copyId, {
    title: recoveryTitle(entry.text.title),
    content: entry.text.content,
    templateType: entry.templateType,
    categoryId: entry.meta.categoryId,
    tags: entry.meta.tags,
    color: entry.meta.color,
    userId: uid,
    order: 0,
    sharedWith: [],
    isPinned: false,
    // העותק מוסתר ומוגן בדיוק כמו המקור: פתק רגיש לא נחשף ל-Claude דרך העותק שלו
    isSensitive: entry.meta.isSensitive,
    isReadOnly: entry.meta.isReadOnly,
  });
