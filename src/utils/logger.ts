/**
 * לוגר מרכזי לאפליקציה
 *
 * בפיתוח - כל הרמות נכתבות לקונסול.
 * בפרודקשן - רק שגיאות, כדי לא לדלוף מידע על משתמשים ללוג של הדפדפן.
 */

const isDev = import.meta.env.DEV;

export const logger = {
  debug: (...args: unknown[]): void => {
    if (isDev) console.log(...args);
  },

  info: (...args: unknown[]): void => {
    if (isDev) console.info(...args);
  },

  warn: (...args: unknown[]): void => {
    if (isDev) console.warn(...args);
  },

  /** שגיאות נכתבות תמיד - גם בפרודקשן */
  error: (...args: unknown[]): void => {
    console.error(...args);
  },
};
