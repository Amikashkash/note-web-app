/**
 * שירות API למשתמשים
 *
 * הפרדה בין שתי קולקציות:
 * - `users/{uid}`  - המסמך המלא, כולל הגדרות אישיות. נגיש לבעליו בלבד.
 * - `userLookup/{uid}` - אימייל ושם תצוגה בלבד, להצגת שמות לפי מזהה
 *   (למשל ברשימת "משותף עם"). קריאה רק לפי מזהה (`get`), לעולם לא
 *   כרשימה - אחרת כל משתמש יכול היה לשלוף את האימיילים של כולם.
 *
 * חיפוש לפי אימייל (לשיתוף) לא עובר כאן בכלל: הוא ב-callable
 * `findUserByEmail`, שבודק מול Firebase Auth ומגביל קצב.
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/services/firebase/config';
import { logger } from '@/utils/logger';
import { getFirebaseErrorCode, wrapError } from '@/utils/errors';

const LOOKUP_COLLECTION = 'userLookup';

export interface UserLookupEntry {
  uid: string;
  email: string;
  displayName: string;
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/**
 * יצירה/עדכון של רשומת החיפוש של המשתמש.
 * נקרא בכל התחברות כדי שגם משתמשים ותיקים יקבלו רשומה.
 *
 * ה-rules מקבלים רק את האימייל של המשתמש עצמו, ורק אם הוא מאומת. משתמש
 * שעוד לא אימת את האימייל שלו פשוט לא יקבל רשומה - הכישלון נבלע כאן.
 */
export const upsertUserLookup = async (
  uid: string,
  email: string,
  displayName: string
): Promise<void> => {
  try {
    await setDoc(doc(db, LOOKUP_COLLECTION, uid), {
      email: normalizeEmail(email),
      displayName,
    });
  } catch (error) {
    // כישלון כאן אומר שהשם לא יוצג לאחרים ברשימת השיתוף,
    // אבל אין סיבה לחסום בגללו את ההתחברות.
    logger.error('Error updating user lookup entry:', error);
  }
};

type FindUserResult = { found: true; uid: string; displayName: string } | { found: false };

/**
 * מציאת מזהה משתמש לפי כתובת אימייל (לצורך שיתוף).
 *
 * מחזיר `null` אם אין חשבון מאומת עם האימייל הזה - מצב תקין ולא שגיאה,
 * והקורא מחליט איזו הודעה להציג.
 */
export const findUserIdByEmail = async (email: string): Promise<string | null> => {
  try {
    const call = httpsCallable<{ email: string }, FindUserResult>(functions, 'findUserByEmail');
    const { data } = await call({ email: normalizeEmail(email) });
    return data.found ? data.uid : null;
  } catch (error) {
    logger.error('Error looking up user by email:', error);
    if (getFirebaseErrorCode(error) === 'functions/resource-exhausted') {
      throw new Error('יותר מדי חיפושים של משתמשים. נסה שוב בעוד כמה דקות.', { cause: error });
    }
    throw wrapError('שגיאה בחיפוש המשתמש', error);
  }
};

/**
 * שליפת פרטי תצוגה של משתמשים לפי מזהים.
 * משמש להצגת רשימת "משותף עם" והיסטוריית הגרסאות בשמות ולא במזהים.
 *
 * `get` נפרד לכל מזהה ולא שאילתת `documentId() in [...]`: שאילתה היא
 * `list`, וה-rules מאפשרים רק `get`. הרשימות כאן קטנות (אנשים שפתק
 * משותף איתם), כך שהקריאות המקבילות זולות.
 */
export const getUserLookupEntries = async (uids: string[]): Promise<UserLookupEntry[]> => {
  if (uids.length === 0) return [];

  const results = await Promise.all(
    [...new Set(uids)].map(async (uid): Promise<UserLookupEntry | null> => {
      try {
        const snapshot = await getDoc(doc(db, LOOKUP_COLLECTION, uid));
        if (!snapshot.exists()) return null;
        const data = snapshot.data();
        return {
          uid,
          email: typeof data.email === 'string' ? data.email : '',
          displayName: typeof data.displayName === 'string' ? data.displayName : '',
        };
      } catch (error) {
        logger.error('Error loading user lookup entry:', error);
        return null;
      }
    })
  );

  return results.filter((entry): entry is UserLookupEntry => entry !== null);
};
