/**
 * השוואת גרסאות לצורך `minClientVersion` (D4a). טהור.
 *
 * הכלל החשוב: **ערך שאי אפשר לקרוא לא חוסם.** config שגוי (הקלדה במסוף,
 * "1.33" בלי תיקון, רווח) היה נועל את כל המשתמשים מחוץ לשמירה. לכן רק
 * מינימום תקין וגבוה ממש מהגרסה הרצה חוסם.
 */

const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

const parse = (value: unknown): [number, number, number] | null => {
  if (typeof value !== 'string') return null;
  const match = VERSION.exec(value.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
};

/** `true` רק כשהגרסה הרצה תקינה, המינימום תקין, והרצה נמוכה ממנו */
export const isBelowMinimum = (running: string, minimum: unknown): boolean => {
  const [have, need] = [parse(running), parse(minimum)];
  if (!have || !need) return false;
  for (let index = 0; index < 3; index += 1) {
    if (have[index] !== need[index]) return have[index] < need[index];
  }
  return false;
};

/**
 * שורת האבחון ב"מה חדש": מה האפליקציה קראה מ-`config/app` ומתי. בלי לוגים
 * בפרודקשן, זו הדרך לבדוק במכשיר למה חסימה הופיעה או לא.
 */
export const describeMinVersionStatus = (status: {
  running: string;
  raw: unknown;
  blocked: boolean;
  lastCheck: { ok: boolean; at: number } | null;
  formatTime: (at: number) => string;
}): string => {
  const minimum =
    status.raw === undefined
      ? 'אין'
      : parse(status.raw)
        ? `${(status.raw as string).trim()}${status.blocked ? ' (חוסם)' : ''}`
        : `${JSON.stringify(status.raw)} (לא תקין, לא חוסם)`;
  const check = !status.lastCheck
    ? 'עוד לא נבדק מהשרת'
    : `${status.lastCheck.ok ? 'נבדק מהשרת' : 'בדיקה נכשלה'} ב-${status.formatTime(status.lastCheck.at)}`;
  return `גרסה ${status.running} · מינימום: ${minimum} · ${check}`;
};
