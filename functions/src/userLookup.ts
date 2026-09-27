/**
 * חיפוש משתמש לפי אימייל לצורך שיתוף (S-1 בסקירה)
 *
 * עד עכשיו הלקוח חיפש ישירות בקולקציה `userLookup`, שכל משתמש מחובר
 * יכול היה לקרוא בשלמותה (כלומר לשלוף את האימיילים של כל המשתמשים), וכל
 * משתמש יכול היה לרשום בה אימייל של מישהו אחר - ולקבל שיתופים שנועדו לו.
 *
 * כאן החיפוש עובר דרך Firebase Auth עצמו ולא דרך `userLookup`:
 * - האימייל הוא זה שהמשתמש נכנס איתו בפועל, ואי אפשר לזייף אותו.
 * - רק חשבון עם אימייל **מאומת** נמצא. בלי זה, מי שנרשם עם אימייל וסיסמה
 *   לכתובת של מישהו אחר (ולא אימת אותה) היה מקבל את השיתופים שלו.
 * - מוחזר רק מה שנדרש לשיתוף: `uid` ושם תצוגה. לא האימייל, לא ספקים,
 *   לא תאריכים.
 * - חשבון לא קיים, מושבת או לא מאומת מחזירים אותה תשובה בדיוק
 *   (`found: false`), כדי שהפונקציה לא תגלה איזה מהם.
 *
 * הגבלת קצב לכל מבקש: אחרת הפונקציה עצמה הייתה הופכת לדרך החדשה לבדוק
 * אילו אימיילים רשומים. ההסבר על המספרים ליד `LOOKUP_LIMITS`.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * שיתוף הוא פעולה נדירה: מקלידים אימייל, ולכל היותר מתקנים שגיאת
 * הקלדה פעם או פעמיים.
 * - 5 בדקה: מספיק לתיקוני הקלדה ברצף, ועוצר לולאה אוטומטית מיד.
 * - 30 ביממה: הרבה מעבר לשימוש אמיתי (גם מי ששיתף רשימה עם כל
 *   המשפחה), ומגביל ניחוש אימיילים לחשבון אחד ל-30 ביום - כמה אלפים
 *   בשנה, מה שהופך סריקה לחסרת טעם.
 * ניסיון שנחסם לא נספר, כדי שמי שנחסם לא יאריך לעצמו את החסימה.
 */
export const LOOKUP_LIMITS = [
  { name: 'minute', windowMs: MINUTE_MS, max: 5 },
  { name: 'day', windowMs: DAY_MS, max: 30 },
] as const;

interface WindowState {
  start: number;
  count: number;
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterMs: number };

/**
 * חלונות קבועים לכל מבקש, ב-transaction כדי ששתי קריאות במקביל לא
 * ייספרו כאחת. המסמך נמחק אוטומטית אחרי יממה (`expiresAt`, TTL).
 */
export const consumeRateLimit = async (
  db: Firestore,
  key: string,
  now: number
): Promise<RateLimitResult> => {
  const ref = db.collection('rateLimits').doc(key);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const stored = snapshot.exists ? snapshot.data() ?? {} : {};
    const next: Record<string, WindowState> = {};

    for (const limit of LOOKUP_LIMITS) {
      const current = stored[limit.name] as WindowState | undefined;
      const state =
        !current || now - current.start >= limit.windowMs ? { start: now, count: 0 } : current;

      if (state.count >= limit.max) {
        return { allowed: false, retryAfterMs: state.start + limit.windowMs - now };
      }
      next[limit.name] = { start: state.start, count: state.count + 1 };
    }

    transaction.set(ref, { ...next, expiresAt: Timestamp.fromMillis(now + DAY_MS) });
    return { allowed: true };
  });
};

export type LookupResult = { found: true; uid: string; displayName: string } | { found: false };

/** אורך מקסימלי של כתובת אימייל לפי RFC 5321 */
const MAX_EMAIL_LENGTH = 254;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+$/;

export interface LookupRequest {
  db: Firestore;
  auth: Auth;
  callerUid: string;
  email: unknown;
  now: number;
}

export const lookupUserByEmail = async ({
  db,
  auth,
  callerUid,
  email,
  now,
}: LookupRequest): Promise<LookupResult> => {
  if (typeof email !== 'string') {
    throw new HttpsError('invalid-argument', 'נדרשת כתובת אימייל');
  }

  const normalized = email.trim().toLowerCase();
  if (normalized.length === 0 || normalized.length > MAX_EMAIL_LENGTH || !EMAIL_SHAPE.test(normalized)) {
    throw new HttpsError('invalid-argument', 'כתובת אימייל לא תקינה');
  }

  const limit = await consumeRateLimit(db, `findUserByEmail_${callerUid}`, now);
  if (!limit.allowed) {
    throw new HttpsError('resource-exhausted', 'יותר מדי חיפושים. נסה שוב מאוחר יותר.', {
      retryAfterSeconds: Math.ceil(limit.retryAfterMs / 1000),
    });
  }

  let user;
  try {
    user = await auth.getUserByEmail(normalized);
  } catch (error) {
    if ((error as { code?: string }).code === 'auth/user-not-found') return { found: false };
    throw error;
  }

  if (user.disabled || !user.emailVerified) return { found: false };

  return { found: true, uid: user.uid, displayName: user.displayName ?? '' };
};
