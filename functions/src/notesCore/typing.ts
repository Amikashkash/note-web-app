/**
 * "המשתמש מקליד בפתק עכשיו" (v1.39.0): רק זה חוסם את כלי העריכה של Claude.
 *
 * עד 1.37.0 כל פתק פתוח חסם - גם הצצה, גם טאב שנשכח פתוח. מאז שאין מצב
 * עריכה, כל פתק פתוח הוא עורך, ולכן החסימה צומצמה להקלדה: העורך כותב
 * `typedAt` (זמן השרת) על סימון הנוכחות שלו, לכל היותר כל 15 שניות בזמן
 * הקלדה (`src/utils/presence.ts`).
 *
 * פתק שרק פתוח: השינוי של Claude נכתב, והעורך הפתוח מאמץ אותו (או ממזג,
 * אם יש בו שינוי שעוד לא אושר) - `src/utils/noteSync.ts`. בלי אובדן בשקט:
 * `revision` דוחה כל שמירה ישנה של העורך, וכל שינוי של Claude נשמר בהיסטוריה.
 */

/**
 * 60 שניות מההקלדה האחרונה, ועוד מרווח הכתיבות של הסימון (15): חסום
 * לפחות 60 שניות אחרי ההקלדה האחרונה, ולכל היותר 75. זהה ל-
 * `TYPING_WINDOW_MS` באפליקציה (בדיקת מראה ב-`tests/mirrors`).
 */
export const TYPING_WINDOW_MS = 75 * 1000;

interface MarkerLike {
  typedAt: { toMillis: () => number } | null;
  device: string;
}

/** המכשירים שבהם המשתמש הקליד בחלון האחרון. ריק - אפשר לכתוב */
export const typingOn = (markers: MarkerLike[], now: number): string[] =>
  markers
    .filter((marker) => marker.typedAt !== null && now - marker.typedAt.toMillis() < TYPING_WINDOW_MS)
    .map((marker) => marker.device);
