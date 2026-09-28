/**
 * טקסט שלא נשמר לא נעלם (C-1).
 *
 * שמירה מהעורך נדחית כשמישהו אחר כתב בינתיים (בדיקת `revision` ב-rules).
 * כשהעורך עדיין פתוח, הוא מציג למשתמש בחירה. אבל הדחייה יכולה להגיע
 * אחרי שהעורך נסגר: שמירה אחרונה בסגירה, או כתיבה שהמתינה offline ונשלחה
 * כשהחיבור חזר. אז אין מי שיציג בחירה - והטקסט היה הולך לאיבוד בשקט.
 *
 * במקרה הזה נוצר פתק חדש, "טקסט שלא נשמר", עם מה שהמשתמש כתב, באותה
 * קטגוריה. הפתק המקורי נשאר כפי שהוא בשרת. כך אף צד לא מאבד.
 */

import { createNote } from './notes';
import { logger } from '@/utils/logger';
import { LENGTH_LIMITS } from '@/utils/constants';
import type { Note } from '@/types/note';

/** עורכים פתוחים: להם יש ממשק התנגשות משלהם */
const openEditors = new Map<string, number>();

/** נרשם בפתיחת עורך. מחזיר ביטול רישום לסגירה */
export const registerOpenEditor = (noteId: string): (() => void) => {
  openEditors.set(noteId, (openEditors.get(noteId) ?? 0) + 1);
  return () => {
    const count = (openEditors.get(noteId) ?? 1) - 1;
    if (count > 0) openEditors.set(noteId, count);
    else openEditors.delete(noteId);
  };
};

export const isEditorOpen = (noteId: string): boolean => openEditors.has(noteId);

/** כמה כתיבות רצופות נדחות יחד: עותק אחד, של האחרונה */
const scheduled = new Map<string, ReturnType<typeof setTimeout>>();
const RECOVERY_DELAY_MS = 1500;

export type RecoverableNote = Pick<
  Note,
  'id' | 'title' | 'content' | 'templateType' | 'categoryId' | 'tags' | 'color' | 'isSensitive' | 'isReadOnly'
>;

export const recoveryTitle = (title: string): string =>
  `טקסט שלא נשמר - ${title || 'ללא כותרת'}`.slice(0, LENGTH_LIMITS.NOTE_TITLE);

/**
 * שמירה שנדחתה כשהעורך כבר סגור: עותק בפתק חדש. `uid` - המשתמש המחובר,
 * שהוא בעלי העותק (גם כשהפתק המקורי משותף ושייך למישהו אחר).
 */
export const recoverRejectedText = (note: RecoverableNote, uid: string): void => {
  if (isEditorOpen(note.id)) return;

  const previous = scheduled.get(note.id);
  if (previous) clearTimeout(previous);

  scheduled.set(
    note.id,
    setTimeout(() => {
      scheduled.delete(note.id);
      if (isEditorOpen(note.id)) return;
      createNote({
        title: recoveryTitle(note.title),
        content: note.content,
        templateType: note.templateType,
        categoryId: note.categoryId,
        tags: note.tags,
        color: note.color,
        userId: uid,
        order: 0,
        sharedWith: [],
        isPinned: false,
        // העותק מוסתר ומוגן בדיוק כמו המקור: פתק רגיש לא נחשף ל-Claude דרך העותק שלו
        isSensitive: note.isSensitive,
        isReadOnly: note.isReadOnly,
      }).catch((error) => logger.error('Could not save the recovery copy:', error));
    }, RECOVERY_DELAY_MS)
  );
};
