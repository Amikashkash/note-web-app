/**
 * טקסט שלא נשמר כי הגרסה נחסמה (`minClientVersion`, D4a), שמור במכשיר עד
 * שהגרסה החדשה מציגה אותו (`RecoveredText`). לא נכתב לפתק אוטומטית: הוא
 * בפורמט של הגרסה הישנה.
 *
 * מאז v1.36.0:
 * - נשמר כאן כבר כשהטקסט נעצר (`holdUnsaved`), לא רק בלחיצה על "רענן" -
 *   כך הוא לא נעלם גם אם סוגרים את האפליקציה בלי לרענן.
 * - נמחק בהתנתקות שמוחקת את הנתונים המקומיים (`localData.ts`), ונספר
 *   כשינוי שלא נשמר לפני ההתנתקות - כדי שלא יימחק בלי לשאול.
 */

import type { UnsavedText } from '@/store/appVersionStore';
import { logger } from './logger';

const STASH_KEY = 'notes4me.unsavedBeforeUpdate';

export const readStash = (): UnsavedText[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STASH_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as UnsavedText[]) : [];
  } catch (error) {
    logger.warn('Could not read stashed unsaved text:', error);
    return [];
  }
};

/** מוסיף או מחליף, לפי פתק: הטקסט האחרון של כל פתק */
export const stashUnsaved = (entries: UnsavedText[]): void => {
  if (entries.length === 0) return;
  const byNote = new Map(readStash().map((entry) => [entry.noteId, entry]));
  entries.forEach((entry) => byNote.set(entry.noteId, entry));
  try {
    localStorage.setItem(STASH_KEY, JSON.stringify([...byNote.values()]));
  } catch (error) {
    logger.warn('Could not stash unsaved text:', error);
  }
};

export const hasStash = (): boolean => readStash().length > 0;

export const clearStash = (): void => {
  try {
    localStorage.removeItem(STASH_KEY);
  } catch {
    // אין גישה ל-storage: אין מה למחוק
  }
};
