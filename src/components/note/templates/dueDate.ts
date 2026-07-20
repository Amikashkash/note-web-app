/**
 * חישוב מצב מועד היעד של משימה
 *
 * מופרד מהקומפוננטה כי אלו פונקציות טהורות שאין להן קשר לרינדור, והן
 * גם נבדקות בקלות רבה יותר בנפרד.
 */

export type DateStatus = 'overdue' | 'soon' | 'future';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

/**
 * פרסור "YYYY-MM-DD" ו-"HH:MM" לזמן מקומי.
 *
 * הבנייה מרכיבים מפורשים ולא דרך `new Date("2026-07-20")`: המחרוזת
 * הזו מפורשת כ-UTC לפי התקן, ובאזור זמן שלילי היא נופלת ליום הקודם.
 */
export const parseLocalDateTime = (dateStr?: string, timeStr?: string): Date | null => {
  if (!dateStr) return null;

  const dateMatch = DATE_PATTERN.exec(dateStr);
  if (!dateMatch) return null;

  const [, year, month, day] = dateMatch;

  let hours = 0;
  let minutes = 0;

  if (timeStr) {
    const timeMatch = TIME_PATTERN.exec(timeStr);
    if (timeMatch) {
      hours = Number(timeMatch[1]);
      minutes = Number(timeMatch[2]);
    }
  }

  return new Date(Number(year), Number(month) - 1, Number(day), hours, minutes, 0, 0);
};

/**
 * מצב המשימה ביחס לעכשיו.
 *
 * משימה עם שעה נמדדת לפי הרגע המדויק; בלי שעה - לפי היום בלבד, אחרת
 * כל משימה להיום הייתה הופכת ל"באיחור" מיד אחרי חצות.
 */
export const getDateStatus = (dueDate?: string, dueTime?: string): DateStatus | null => {
  const due = parseLocalDateTime(dueDate, dueTime);
  if (!due) return null;

  const now = new Date();

  if (dueTime) {
    if (due.getTime() < now.getTime()) return 'overdue';
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfDue = new Date(due);
  startOfDue.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (startOfDue.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) return 'overdue';
  // היום או מחר
  if (diffDays <= 1) return 'soon';
  return 'future';
};

/** תיאור קריא של מועד היעד, לשימוש ב-tooltip */
export const formatDueLabel = (dueDate?: string, dueTime?: string): string => {
  if (!dueDate) return 'הוסף תאריך יעד';

  const parsed = parseLocalDateTime(dueDate);
  if (!parsed) return 'הוסף תאריך יעד';

  const date = parsed.toLocaleDateString('he-IL');
  return dueTime ? `יעד: ${date} ${dueTime}` : `יעד: ${date}`;
};

export const DATE_STATUS_TEXT_CLASS: Record<DateStatus, string> = {
  overdue: 'text-red-600',
  soon: 'text-yellow-600',
  future: 'text-blue-600',
};

export const DATE_STATUS_BORDER_CLASS: Record<DateStatus, string> = {
  overdue: 'border-red-300 dark:border-red-700',
  soon: 'border-yellow-300 dark:border-yellow-700',
  future: 'border-gray-200 dark:border-gray-600',
};
