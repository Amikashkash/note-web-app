/**
 * שירות API למשתמשים
 *
 * הפרדה בין שתי קולקציות:
 * - `users/{uid}`  - המסמך המלא, כולל הגדרות אישיות. נגיש לבעליו בלבד.
 * - `userLookup/{uid}` - אימייל ושם תצוגה בלבד, נגיש לכל משתמש מחובר
 *   כדי לאפשר שיתוף לפי אימייל בלי לחשוף את שאר נתוני המשתמש.
 */

import {
  collection,
  doc,
  documentId,
  getDocs,
  limit,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import { logger } from '@/utils/logger';
import { wrapError } from '@/utils/errors';

const LOOKUP_COLLECTION = 'userLookup';

/** מגבלת הערכים בשאילתת `in` של Firestore */
const IN_QUERY_LIMIT = 30;

export interface UserLookupEntry {
  uid: string;
  email: string;
  displayName: string;
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/**
 * יצירה/עדכון של רשומת החיפוש של המשתמש.
 * נקרא בכל התחברות כדי שגם משתמשים ותיקים יקבלו רשומה.
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
    // כישלון כאן אומר שהמשתמש לא יימצא בחיפוש לשיתוף,
    // אבל אין סיבה לחסום בגללו את ההתחברות.
    logger.error('Error updating user lookup entry:', error);
  }
};

/**
 * מציאת מזהה משתמש לפי כתובת אימייל (לצורך שיתוף).
 *
 * מחזיר `null` אם המשתמש לא קיים - מצב תקין ולא שגיאה,
 * והקורא מחליט איזו הודעה להציג.
 */
export const findUserIdByEmail = async (email: string): Promise<string | null> => {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, LOOKUP_COLLECTION),
        where('email', '==', normalizeEmail(email)),
        limit(1)
      )
    );

    return snapshot.empty ? null : snapshot.docs[0].id;
  } catch (error) {
    logger.error('Error looking up user by email:', error);
    throw wrapError('שגיאה בחיפוש המשתמש', error);
  }
};

/**
 * שליפת פרטי תצוגה של משתמשים לפי מזהים.
 * משמש להצגת רשימת "משותף עם" באימיילים במקום במזהים גולמיים.
 */
export const getUserLookupEntries = async (uids: string[]): Promise<UserLookupEntry[]> => {
  if (uids.length === 0) return [];

  try {
    const entries: UserLookupEntry[] = [];

    // שאילתת `in` מוגבלת במספר הערכים, ולכן מפצלים לקבוצות
    for (let i = 0; i < uids.length; i += IN_QUERY_LIMIT) {
      const chunk = uids.slice(i, i + IN_QUERY_LIMIT);
      const snapshot = await getDocs(
        query(collection(db, LOOKUP_COLLECTION), where(documentId(), 'in', chunk))
      );

      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        entries.push({
          uid: docSnapshot.id,
          email: typeof data.email === 'string' ? data.email : '',
          displayName: typeof data.displayName === 'string' ? data.displayName : '',
        });
      }
    }

    return entries;
  } catch (error) {
    logger.error('Error loading user lookup entries:', error);
    return [];
  }
};
