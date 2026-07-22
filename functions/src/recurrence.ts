/**
 * חישוב המועד הבא של תזכורת חוזרת
 *
 * העיקרון: המועד הבא **נגזר** מתאריך הבסיס ומהכלל, ולא נשמר בשום מקום.
 * גם הטריגר שרץ על כתיבת פתק וגם המתזמן ששולח את ההתראה מחשבים אותו
 * מאותם נתונים ומגיעים לאותה תוצאה, ולכן אין צורך לעקוב אחרי "מתי
 * נשלח לאחרונה" - השדה הזה הוא מקור הסחיפה הקלאסי בתזכורות חוזרות.
 *
 * כל החישוב בזמן מקומי: המשתמש קבע "כל יום ב-09:00", והכוונה היא 09:00
 * על השעון שלו גם אחרי מעבר שעון קיץ. חישוב על חותמות UTC היה מזיז את
 * השעה בשעה פעמיים בשנה.
 */

import { localDateTimeToDate } from './timezone';

export type RepeatRule = 'daily' | 'weekly' | 'monthly' | 'yearly';

const REPEAT_RULES = new Set<string>(['daily', 'weekly', 'monthly', 'yearly']);

export const isRepeatRule = (value: unknown): value is RepeatRule =>
  typeof value === 'string' && REPEAT_RULES.has(value);

/** תקרת צעדים בחיפוש המועד הבא, כהגנה מפני תאריך בסיס מופרך */
const MAX_STEPS = 500;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

interface DateParts {
  year: number;
  month: number; // 1-12
  day: number;
}

const parseDateParts = (dateStr: string): DateParts | null => {
  const match = DATE_PATTERN.exec(dateStr);
  if (!match) return null;

  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
};

const toDateString = ({ year, month, day }: DateParts): string =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** מספר הימים בחודש, לצורך קיצוץ תאריכים שלא קיימים בו */
const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/**
 * הוספת חודשים עם קיצוץ היום לסוף החודש.
 * 31 בינואר + חודש = 28 בפברואר, ולא 3 במרץ.
 */
const addMonths = (parts: DateParts, count: number): DateParts => {
  const totalMonths = parts.year * 12 + (parts.month - 1) + count;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;

  return { year, month, day: Math.min(parts.day, daysInMonth(year, month)) };
};

/** הוספת ימים דרך UTC - בטוח לחישוב לוח שנה, בלי מלכודות שעון קיץ */
const addDays = (parts: DateParts, count: number): DateParts => {
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  base.setUTCDate(base.getUTCDate() + count);

  return { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1, day: base.getUTCDate() };
};

/**
 * המופע ה-`n` מתאריך הבסיס.
 *
 * תמיד מחושב מהבסיס ולא מהמופע הקודם, וזה לא עניין של סגנון: קיצוץ
 * לסוף חודש מצטבר אם צועדים. "כל חודש ב-31" היה הופך ל-28 בפברואר,
 * ומשם ל-28 במרץ - היום המקורי אבד לתמיד. מהבסיס, כל חודש מקבל את
 * ה-31 שלו אם הוא קיים בו.
 */
const occurrenceAt = (base: DateParts, rule: RepeatRule, n: number): DateParts => {
  switch (rule) {
    case 'daily':
      return addDays(base, n);
    case 'weekly':
      return addDays(base, n * 7);
    case 'monthly':
      return addMonths(base, n);
    case 'yearly':
      // דרך חודשים ולא שנים, כדי ש-29 בפברואר יקוצץ ל-28 בשנה שאינה
      // מעוברת במקום לגלוש למרץ - ויחזור ל-29 בשנה המעוברת הבאה
      return addMonths(base, n * 12);
  }
};

/**
 * קפיצה ישירה קדימה, כדי לא לצעוד יום-יום מתאריך בסיס בן שנים.
 *
 * הקירוב תמיד **מחסר** - הוא מניח חודש בן 31 יום ושנה בת 366, כך
 * שהתוצאה נוחתת לפני המועד המבוקש והלולאה משלימה את השארית. קירוב
 * שמגזים היה מדלג על מועדים.
 */
const startingIndex = (parts: DateParts, rule: RepeatRule, now: Date): number => {
  const baseUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  const elapsedDays = Math.floor((now.getTime() - baseUtc) / (1000 * 60 * 60 * 24));
  if (elapsedDays <= 0) return 0;

  switch (rule) {
    case 'daily':
      return elapsedDays;
    case 'weekly':
      return Math.floor(elapsedDays / 7);
    // חודש בן 31 ושנה בת 366 - מכוון בחסר, כדי לנחות לפני המועד
    // המבוקש ולא לדלג עליו
    case 'monthly':
      return Math.floor(elapsedDays / 31);
    case 'yearly':
      return Math.floor(elapsedDays / 366);
  }
};

/**
 * המועד הבא של התזכורת, המאוחר ממש מ-`now`.
 *
 * מחזיר `null` אם התאריך או השעה אינם בפורמט הצפוי, או אם לא נמצא מועד
 * בתוך תקרת הצעדים.
 */
export const nextOccurrence = (
  dateStr: string,
  timeStr: string,
  rule: RepeatRule,
  now: Date = new Date()
): Date | null => {
  const parts = parseDateParts(dateStr);
  if (!parts) return null;

  // מתחילים מאינדקס משוער ומתקדמים עד שעוברים את `now`. הקירוב חוסך
  // מעבר על אלפי מופעים כשתאריך הבסיס בן שנים.
  let index = startingIndex(parts, rule, now);

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const candidate = localDateTimeToDate(toDateString(occurrenceAt(parts, rule, index)), timeStr);
    if (!candidate) return null;

    if (candidate.getTime() > now.getTime()) return candidate;

    index += 1;
  }

  return null;
};
