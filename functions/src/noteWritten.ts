/**
 * מה קורה כשפתק נכתב
 *
 * כל כתיבה ל-`notes/{noteId}` מגיעה לכאן דרך `onNoteWritten`. הפונקציה
 * מחליטה לבד, לפי מה שהשתנה בין `before` ל-`after`, איזה עבודה צריך,
 * ומדלגת על השאר בלי אף קריאה ל-Firestore.
 *
 * מופרד מ-`index.ts` כי `index.ts` מאתחל את ה-Admin SDK כבר בטעינה;
 * כאן מקבלים `db` מבחוץ, כך שבדיקות ה-emulator מריצות בדיוק את הקוד הזה.
 */

import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import { remindersNeedSync, syncRemindersForNote } from './reminders';

export interface NoteWrite {
  db: Firestore;
  noteId: string;
  /** מצב הפתק לפני הכתיבה; `undefined` אם זו יצירה */
  before: DocumentData | undefined;
  /** מצב הפתק אחרי הכתיבה; `undefined` אם זו מחיקה */
  after: DocumentData | undefined;
  /** לבדיקות בלבד; ב-production הזמן הנוכחי */
  now?: number;
}

export const handleNoteWritten = async ({ db, noteId, before, after, now }: NoteWrite): Promise<void> => {
  const tasks: Promise<void>[] = [];

  if (remindersNeedSync(before, after)) {
    tasks.push(syncRemindersForNote(db, noteId, after, now));
  }

  await Promise.all(tasks);
};
