/**
 * המרת תאריך ושעה מקומיים לרגע מוחלט
 *
 * משימות שומרות תאריך ושעה כמחרוזות מקומיות ("2026-07-20", "20:50") בלי
 * שום מידע על אזור זמן. הפונקציה בענן רצה ב-UTC, ולכן פרסור ישיר של
 * המחרוזות היה מקדים כל תזכורת בגובה ההפרש - שלוש שעות בקיץ הישראלי.
 *
 * אזור הזמן קבוע ולא נגזר מהמשתמש: האפליקציה עברית בלבד (`lang: 'he'`,
 * `dir: 'rtl'`, עיצוב תאריכים ב-`he-IL`). אם וכאשר תתווסף תמיכה בשפות
 * נוספות, זה המקום שצריך להשתנות - עדיף להעביר אז את אזור הזמן על
 * מסמך המשתמש מאשר לנחש.
 */

export const APP_TIME_ZONE = 'Asia/Jerusalem';

/** ההיסט של אזור הזמן ברגע נתון, במילישניות */
const getOffsetMs = (date: Date, timeZone: string): number => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    parts[part.type] = part.value;
  }

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    // '24' מופיע בחצות אצל חלק מהמימושים
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );

  return asUtc - date.getTime();
};

/**
 * המרת "YYYY-MM-DD" + "HH:MM" מקומיים ל-`Date`.
 * מחזיר `null` אם אחת המחרוזות אינה בפורמט הצפוי.
 */
export const localDateTimeToDate = (
  dateStr: string,
  timeStr: string,
  timeZone: string = APP_TIME_ZONE
): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return null;

  const naiveUtc = Date.parse(`${dateStr}T${timeStr}:00Z`);
  if (Number.isNaN(naiveUtc)) return null;

  // מעבר ראשון נותן היסט משוער, והשני מתקן אותו במעברי שעון קיץ -
  // שם ההיסט בזמן המקומי שונה מההיסט בזמן ה-UTC הנאיבי.
  const firstPass = naiveUtc - getOffsetMs(new Date(naiveUtc), timeZone);
  const corrected = naiveUtc - getOffsetMs(new Date(firstPass), timeZone);

  return new Date(corrected);
};
