/**
 * סנכרון תזכורות למשימות
 *
 * הקוד הועבר כמו שהוא מ-`index.ts` (שם היה `syncNoteReminders`) כשהטריגר
 * אוחד ל-`onNoteWritten`. השינויים היחידים: `db` ו-`now` מתקבלים כפרמטרים,
 * ונוספה `remindersNeedSync` שמאפשרת לדלג על עבודה מיותרת.
 *
 * למה התזכורות בקולקציה נפרדת ולא בתוך הפתק: המשימות שמורות כ-JSON
 * בתוך מחרוזת, ו-Firestore לא יכול לשאול לתוך מחרוזת. בנוסף, סימון
 * "נשלח" בתוך התוכן היה מחייב את השרת לכתוב חזרה ל-`content` - ולהתנגש
 * עם עריכה של המשתמש באותו רגע.
 */

import { FieldValue, Timestamp, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import { localDateTimeToDate } from './timezone';
import { isRepeatRule, nextOccurrence, type RepeatRule } from './recurrence';

/** אורך מקסימלי לגוף ההתראה - payload של FCM מוגבל ל-4KB */
export const BODY_PREVIEW_LENGTH = 200;
interface ChecklistItem {
  id?: string;
  text?: string;
  completed?: boolean;
  dueDate?: string;
  dueTime?: string;
  /** 'daily' | 'weekly' | 'monthly' | 'yearly', או חסר לתזכורת חד-פעמית */
  repeat?: string;
}

interface DesiredReminder {
  docId: string;
  itemId: string;
  itemText: string;
  remindAt: Timestamp;
  repeat: RepeatRule | null;
  /**
   * התאריך והשעה שהמשתמש קבע, כמחרוזות מקומיות.
   *
   * נשמרים כי המתזמן חייב לחשב את המועד הבא מהבסיס ולא מהמועד שהרגע
   * נורה. "כל חודש ב-31" שנורה ב-28 בפברואר וממשיך משם היה מקבל 28
   * במרץ - הקיצוץ מצטבר. מהבסיס, מרץ מקבל את ה-31 שלו.
   */
  baseDate: string;
  baseTime: string;
}

/**
 * מזהה דטרמיניסטי לתזכורת. אותה משימה תמיד ממופה לאותו מסמך, כך
 * שכתיבה חוזרת מעדכנת במקום לשכפל.
 */
const reminderDocId = (noteId: string, itemId: string): string => `${noteId}__${itemId}`;

const parseChecklistItems = (content: unknown): ChecklistItem[] => {
  if (typeof content !== 'string' || content.trim() === '') return [];

  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? (parsed as ChecklistItem[]) : [];
  } catch {
    // תוכן שאינו JSON תקין הוא פתק טקסט רגיל, לא שגיאה
    return [];
  }
};

/**
 * המשימות שאמורות להניב תזכורת.
 *
 * דורש גם תאריך וגם שעה: תאריך לבדו הוא תאריך יעד ויזואלי, והתראה
 * בחצות הלילה היא התנהגות גרועה. משימה שהושלמה או שמועדה כבר חלף
 * לא מניבה תזכורת חדשה.
 */
const computeDesiredReminders = (
  noteId: string,
  items: ChecklistItem[],
  now: number
): DesiredReminder[] => {
  const desired: DesiredReminder[] = [];
  const seen = new Set<string>();

  items.forEach((item, index) => {
    if (item.completed) return;
    if (!item.dueDate || !item.dueTime) return;

    const repeat = isRepeatRule(item.repeat) ? item.repeat : null;

    // תזכורת חוזרת מתגלגלת קדימה למועד הבא במקום להיפסל כשעברה.
    // המועד נגזר מהכלל, ולכן החישוב כאן זהה לזה שהמתזמן עושה אחרי
    // שליחה - שניהם מגיעים לאותה תוצאה ואין ביניהם מרוץ.
    const remindAt = repeat
      ? nextOccurrence(item.dueDate, item.dueTime, repeat, new Date(now))
      : localDateTimeToDate(item.dueDate, item.dueTime);

    if (!remindAt || remindAt.getTime() <= now) return;

    // מזהה נגזר-מיקום תואם את מה שהלקוח עושה כשפריט ישן חסר `id`
    const itemId = item.id || `item-${index}`;
    if (seen.has(itemId)) return;
    seen.add(itemId);

    desired.push({
      docId: reminderDocId(noteId, itemId),
      itemId,
      itemText: (item.text || '').slice(0, BODY_PREVIEW_LENGTH),
      remindAt: Timestamp.fromDate(remindAt),
      repeat,
      baseDate: item.dueDate,
      baseTime: item.dueTime,
    });
  });

  return desired;
};

/**
 * מסנכרן את מסמכי התזכורת של פתק מול התוכן שלו.
 *
 * `note` הוא מצב הפתק אחרי הכתיבה, או `undefined` אם נמחק. `now` ניתן
 * מבחוץ רק כדי שהבדיקות יהיו דטרמיניסטיות; ב-production זה הזמן הנוכחי.
 */
export const syncRemindersForNote = async (
  db: Firestore,
  noteId: string,
  note: DocumentData | undefined,
  now: number = Date.now()
): Promise<void> => {
  const existing = await db.collection('reminders').where('noteId', '==', noteId).get();
  const existingById = new Map(existing.docs.map((doc) => [doc.id, doc]));

  // פתק שנמחק, אורכב, או שאינו רשימת משימות - אין לו תזכורות
  const isEligible =
    note !== undefined && note.isArchived !== true && note.templateType === 'checklist';

  const desired = isEligible
    ? computeDesiredReminders(noteId, parseChecklistItems(note.content), now)
    : [];

  const batch = db.batch();
  const desiredIds = new Set(desired.map((reminder) => reminder.docId));

  for (const reminder of desired) {
    const current = existingById.get(reminder.docId);
    const remindAtChanged =
      !current || !reminder.remindAt.isEqual(current.get('remindAt') as Timestamp);

    // גם שינוי בכלל החזרה נחשב שינוי, גם כשהמועד הבא יצא זהה. מעבר
    // מיומי לשבועי כשהמופע הבא הוא ממילא מחר לא מזיז את `remindAt`,
    // ובלי הבדיקה הזו הכלל הישן היה נשאר במסמך וממשיך לגלגל לפיו.
    const repeatChanged = !current || (current.get('repeat') ?? null) !== reminder.repeat;

    // מסמך שלא השתנה נשאר כפי שהוא. דריסה שלו הייתה מאפסת את `sent`
    // ומייצרת התראה חוזרת בכל שמירה של הפתק.
    if (!remindAtChanged && !repeatChanged) continue;

    batch.set(
      db.collection('reminders').doc(reminder.docId),
      {
        userId: note!.userId ?? '',
        noteId,
        itemId: reminder.itemId,
        categoryId: note!.categoryId ?? '',
        noteTitle: (note!.title as string) || 'תזכורת',
        itemText: reminder.itemText,
        remindAt: reminder.remindAt,
        repeat: reminder.repeat,
        baseDate: reminder.baseDate,
        baseTime: reminder.baseTime,
        // מועד חדש מחמש מחדש, גם אם התזכורת הקודמת כבר נשלחה
        sent: false,
        sentAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  for (const [docId, doc] of existingById) {
    if (!desiredIds.has(docId)) {
      batch.delete(doc.ref);
    }
  }

  await batch.commit();
};

// ==================== מתי צריך לסנכרן ====================

/** פתק שיכולות להיות לו תזכורות: קיים, לא בארכיון, ורשימת משימות */
const isReminderEligible = (note: DocumentData | undefined): boolean =>
  note !== undefined && note.isArchived !== true && note.templateType === 'checklist';

/** השדות היחידים שהתזכורות נגזרות מהם */
const REMINDER_SOURCE_FIELDS = ['content', 'templateType', 'isArchived', 'userId'] as const;

/**
 * האם הכתיבה יכולה לשנות את התזכורות של הפתק (F-4 בסקירה).
 *
 * עד עכשיו כל כתיבה לפתק - גם הצמדה, שינוי סדר או כותרת - הריצה שאילתה
 * על `reminders`. כאן מדלגים כש:
 * - הפתק לא היה ולא נעשה רשימת משימות פעילה (למשל כל שמירה של פתק טקסט),
 * - או שאף שדה שהתזכורות נגזרות ממנו לא השתנה.
 *
 * בשני המקרים הקוד הקודם היה מגיע לאותה תוצאה בלי לכתוב דבר, חוץ משני
 * מקרי קצה שהדילוג מתקן: כתיבה לא קשורה בדקה שבה תזכורת הגיעה למועדה
 * הייתה מגלגלת אותה קדימה (חוזרת) או מוחקת אותה (חד-פעמית) לפני שנשלחה.
 */
export const remindersNeedSync = (
  before: DocumentData | undefined,
  after: DocumentData | undefined
): boolean => {
  if (!isReminderEligible(before) && !isReminderEligible(after)) return false;
  if (before === undefined || after === undefined) return true;
  return REMINDER_SOURCE_FIELDS.some((field) => before[field] !== after[field]);
};
