/**
 * שער הכתיבה של `minClientVersion` (D4a). כל כתיבה לפתק עוברת כאן דרך
 * `writeStamp` (`notes.ts`); קטגוריות ומוצרים קוראים לו ישירות. כתיבה
 * חדשה לפתק או לקטגוריה חייבת לעבור כאן.
 *
 * לא נחסמים: סימוני נוכחות, טוקן ההתראות ופרטי המשתמש. אין בהם פורמט של
 * תוכן שגרסה ישנה עלולה לא להבין, וחסימה שלהם הייתה שוברת התראות.
 */

import { writesBlocked } from '@/store/appVersionStore';

export const WRITES_BLOCKED_MESSAGE =
  'יש גרסה חדשה של האפליקציה, והגרסה הזו כבר לא שומרת שינויים. רעננו כדי לעבור לגרסה החדשה. מה שכתבתם לא נמחק.';

export class WritesBlockedError extends Error {
  constructor() {
    super(WRITES_BLOCKED_MESSAGE);
    this.name = 'WritesBlockedError';
  }
}

export const assertWritesAllowed = (): void => {
  if (writesBlocked()) throw new WritesBlockedError();
};
