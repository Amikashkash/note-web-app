/**
 * העדפות מסך הבית של המשתמש: היום רק הסדר האישי של הקטגוריות (סבב 3, v1.40.0).
 *
 * `users/{uid}/preferences/home` - מסמך נפרד ולא `users/{uid}` עצמו, כדי
 * שכתיבת סדר לא תתנגש עם עדכון `settings` (שכותב את כל המפה). ה-rules
 * מתירים בו רק את `categoryOrder` ו-`updatedAt`, ורק לבעלים.
 */

import { doc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import { logger } from '@/utils/logger';
import { wrapError } from '@/utils/errors';
import { MAX_CATEGORY_ORDER, parseCategoryOrder } from '@/utils/categoryOrder';
import { assertWritesAllowed } from './writeGate';

const homePreferencesRef = (userId: string) => doc(db, 'users', userId, 'preferences', 'home');

/**
 * מנוי לסדר הקטגוריות. כולל כתיבה מקומית שעוד ממתינה (גם offline), כך
 * שהסדר המוצג הוא תמיד מה שבמסד; כתיבה שנדחתה מוחזרת ע"י ה-SDK.
 */
export const subscribeToCategoryOrder = (
  userId: string,
  callback: (order: string[]) => void,
  onError: (error: unknown) => void = () => undefined
): Unsubscribe =>
  onSnapshot(
    homePreferencesRef(userId),
    (snapshot) => callback(parseCategoryOrder(snapshot.data()?.categoryOrder)),
    (error) => {
      logger.error('Error in category order subscription:', error);
      onError(error);
    }
  );

/**
 * שמירת הסדר המלא. לא מחכים לשרת: ה-SDK מחיל את הכתיבה מקומית מיד (גם
 * offline) ושולח כשאפשר. דחייה מהשרת מגיעה כ-reject של ה-Promise.
 */
export const saveCategoryOrder = async (userId: string, order: string[]): Promise<void> => {
  try {
    assertWritesAllowed();
    await setDoc(homePreferencesRef(userId), {
      categoryOrder: order.slice(0, MAX_CATEGORY_ORDER),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    logger.error('Error saving category order:', error);
    throw wrapError('שגיאה בשמירת סדר הקטגוריות', error);
  }
};
