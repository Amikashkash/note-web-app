/**
 * משימות חוזרות: כשמשימה עם `repeat` מסומנת כבוצעה, היא חוזרת להיות לא
 * בוצעה, עם תאריך היעד הבא. התזכורת זזה איתה (הטריגר מסנכרן אותה מהתוכן).
 *
 * **המקום היחיד שבו ההיגיון הזה קיים.** הוא רץ בטריגר `onNoteWritten`, על
 * כל כתיבה לפתק - מהאפליקציה (כל מכשיר, כל גרסה, גם שותף), מ-MCP, ובעתיד
 * מכפתור "בוצע" בהתראה. כל מי שמסמן "בוצע" רק כותב `completed: true`.
 * למה לא בקוד משותף שגם האפליקציה מריצה: `functions/` לא יכולה לייבא
 * מ-`src/` (mcp-plan, החלטה 10), ומראה היא שני עותקים. ובנוסף, רק בטריגר
 * אי אפשר לפספס כותב: גרסה ישנה של האפליקציה שבמטמון, מכשיר שהיה לא
 * מקוון, או נקודת כניסה חדשה - כולם מקבלים את אותו איפוס בלי שינוי אצלם.
 * `mcp/tools.ts` משתמש ב-`nextDueAfterDone` רק כדי לומר ל-Claude מה יקרה.
 *
 * המועד הבא: המופע הראשון של הסדרה שאחרי **גם** עכשיו **וגם** המועד
 * הנוכחי. סימון מוקדם (משימה של מחר שבוצעה היום) מקדם למחרתיים, ולא
 * משאיר את מחר. סימון באיחור מדלג על מה שהוחמץ אל המופע הבא בעתיד.
 * החישוב בזמן מקומי, דרך `recurrence.ts`, ולכן 09:00 נשאר 09:00 גם
 * אחרי מעבר שעון.
 *
 * `repeatBase`: "כל חודש ב-31" שהתקדם ל-28 בפברואר היה ממשיך מ-28 לתמיד.
 * כשהיום מתקצץ, הבסיס המקורי נשמר בשדה הזה, והמופע שאחרי חוזר ל-31. הוא
 * קיים רק בזמן קיצוץ, ותקף רק כל עוד תאריך היעד הוא מופע שלו - תאריך
 * שהמשתמש שינה ביד מבטל אותו.
 */

import { Timestamp, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import { isClampedOccurrence, isRepeatRule, nextOccurrenceDate } from './recurrence';
import { localDateTimeToDate } from './timezone';

type Row = Record<string, unknown>;

const text = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined);

/** בסיס הסדרה: `repeatBase` אם תאריך היעד עדיין מופע שלו, אחרת תאריך היעד */
export const seriesBase = (row: Row): string | undefined => {
  const dueDate = text(row.dueDate);
  const base = text(row.repeatBase);
  if (dueDate && base && isRepeatRule(row.repeat) && isClampedOccurrence(base, dueDate, row.repeat)) return base;
  return dueDate;
};

export interface NextDue {
  dueDate: string;
  /** הרגע של המועד הבא */
  at: Date;
  /** הבסיס לשמירה כשהיום התקצץ, אחרת `undefined` (השדה נמחק) */
  repeatBase: string | undefined;
}

/**
 * תאריך היעד הבא של משימה חוזרת שסומנה כבוצעה. `null` - המשימה לא חוזרת
 * (בלי `repeat`, או בלי תאריך ושעה תקינים), ונשארת בוצעה.
 */
export const nextDueAfterDone = (row: Row, now: Date): NextDue | null => {
  const dueDate = text(row.dueDate);
  const dueTime = text(row.dueTime);
  if (!isRepeatRule(row.repeat) || !dueDate || !dueTime) return null;
  const current = localDateTimeToDate(dueDate, dueTime);
  const base = seriesBase(row);
  if (!current || !base) return null;

  const after = new Date(Math.max(now.getTime(), current.getTime()));
  const next = nextOccurrenceDate(base, dueTime, row.repeat, after);
  if (!next) return null;

  const clamped = (row.repeat === 'monthly' || row.repeat === 'yearly') && next.date.slice(8) !== base.slice(8);
  return { dueDate: next.date, at: next.at, repeatBase: clamped ? base : undefined };
};

// ---------------------------------------------------------------------------
// מה הכתיבה צריכה
// ---------------------------------------------------------------------------

/** השורות של רשימה, או `null` כשהתוכן לא רשימה */
const rowsOf = (content: unknown): Row[] | null => {
  if (typeof content !== 'string' || content.trim() === '') return null;
  try {
    const parsed: unknown = JSON.parse(content);
    return Array.isArray(parsed) && parsed.every((row) => row && typeof row === 'object' && !Array.isArray(row))
      ? (parsed as Row[])
      : null;
  } catch {
    return null;
  }
};

/** אותו מזהה כמו באפליקציה, ב-MCP ובתזכורות: השמור, או לפי המיקום */
const idOf = (row: Row, index: number): string => text(row.id) ?? `item-${index}`;

const sameTiming = (a: Row, b: Row) =>
  ['dueDate', 'dueTime', 'repeat', 'repeatBase'].every((field) => (a[field] ?? null) === (b[field] ?? null));

export interface RecurringReset {
  content: string;
  /** המשימות שאופסו, לבדיקות */
  resets: { itemId: string; dueDate: string }[];
}

/**
 * האיפוס, טהור. `before` ו-`after` - הכתיבה שהטריגר רואה; `current` - הגרסה
 * העדכנית של התוכן (בתוך ה-transaction), שאולי כבר השתנתה שוב.
 *
 * מאפסים רק משימה ש**עברה** מלא-בוצעה לבוצעה בכתיבה הזו. משימה חוזרת
 * שכבר הייתה בוצעה (נתונים מלפני השינוי) לא קמה פתאום בעריכה לא קשורה,
 * ומשימה חדשה שנוספה כבוצעה נשארת כך. ב-`current` היא חייבת להיות עדיין
 * בוצעה ועם אותו מועד: אם המשתמש ביטל את הסימון או שינה את המועד בינתיים,
 * ההחלטה שלו קובעת.
 */
export const resetRecurringTasks = (
  beforeContent: unknown,
  afterContent: unknown,
  currentContent: unknown,
  now: Date
): RecurringReset | null => {
  const [before, after, current] = [beforeContent, afterContent, currentContent].map(rowsOf);
  if (!before || !after || !current) return null;

  const wasOpen = new Set(before.flatMap((row, index) => (row.completed === true ? [] : [idOf(row, index)])));
  const markedNow = new Map(
    after.flatMap((row, index) => {
      const id = idOf(row, index);
      return row.completed === true && wasOpen.has(id) && isRepeatRule(row.repeat) ? [[id, row] as const] : [];
    })
  );
  if (markedNow.size === 0) return null;

  const resets: RecurringReset['resets'] = [];
  const next = current.map((row, index) => {
    const id = idOf(row, index);
    const marked = markedNow.get(id);
    if (!marked || row.completed !== true || !sameTiming(row, marked)) return row;
    const due = nextDueAfterDone(row, now);
    if (!due) return row;
    resets.push({ itemId: id, dueDate: due.dueDate });
    const { repeatBase: _old, ...rest } = row;
    return { ...rest, completed: false, dueDate: due.dueDate, ...(due.repeatBase && { repeatBase: due.repeatBase }) };
  });

  return resets.length > 0 ? { content: JSON.stringify(next), resets } : null;
};

/** פתק שיכולות להיות בו משימות חוזרות פעילות */
const isActiveChecklist = (note: DocumentData | undefined): note is DocumentData =>
  note !== undefined && note.templateType === 'checklist' && note.isArchived !== true;

/**
 * מהטריגר: אם הכתיבה סימנה משימה חוזרת כבוצעה, כותב את האיפוס. `true` -
 * נכתב, ואז הכתיבה הזו תפעיל את הטריגר שוב והוא יסנכרן את התזכורות.
 *
 * הכתיבה: התוכן ו-`revision + 1` (עורך פתוח מזהה שינוי מרחוק וממזג, כמו
 * אחרי עריכה של Claude), ו-`updatedBy` **לא משתנה** - האיפוס הוא חלק
 * מהסימון של מי שסימן, ולא כותב נוסף שהיה מייצר גרסה בהיסטוריה בכל סימון.
 * בלי בדיקה ראשונה שעוברת (כמעט כל כתיבה) - בלי אף קריאה ל-Firestore.
 */
export const resetRecurringTasksForNote = async (
  db: Firestore,
  noteId: string,
  before: DocumentData | undefined,
  after: DocumentData | undefined,
  now: number = Date.now()
): Promise<boolean> => {
  if (!isActiveChecklist(before) || !isActiveChecklist(after)) return false;
  const at = new Date(now);
  if (!resetRecurringTasks(before.content, after.content, after.content, at)) return false;

  const ref = db.collection('notes').doc(noteId);
  return db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    const data = fresh.data();
    if (!fresh.exists || !isActiveChecklist(data)) return false;
    const reset = resetRecurringTasks(before.content, after.content, data.content, at);
    if (!reset) return false;
    tx.update(ref, {
      content: reset.content,
      revision: (typeof data.revision === 'number' ? data.revision : 0) + 1,
      updatedAt: Timestamp.fromMillis(now),
    });
    return true;
  });
};
