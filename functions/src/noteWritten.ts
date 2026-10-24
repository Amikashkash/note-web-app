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
import { resetRecurringTasksForNote } from './recurringTasks';
import { remindersNeedSync, syncRemindersForNote } from './reminders';
import { syncVersionsForNote } from './versions';

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
  // משימה חוזרת שסומנה כבוצעה חוזרת עם המועד הבא (`recurringTasks.ts`).
  // אם נכתב איפוס, הכתיבה שלו מפעילה את הטריגר שוב, והתזכורות מסונכרנות
  // שם, מהתוכן הסופי. סנכרון כאן, במקביל, היה מוחק את התזכורת אחרי
  // שהריצה השנייה כבר יצרה אותה מחדש.
  const tasksAndReminders = async () => {
    const reset = await resetRecurringTasksForNote(db, noteId, before, after, now);
    if (!reset && remindersNeedSync(before, after)) {
      await syncRemindersForNote(db, noteId, after, now);
    }
  };

  await Promise.all([
    tasksAndReminders(),
    // היסטוריית גרסאות. יוצאת מוקדם בעצמה כשלא השתנה שדה תוכן.
    syncVersionsForNote(db, noteId, before, after, now),
  ]);
};
