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
