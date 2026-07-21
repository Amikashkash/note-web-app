/**
 * זיכרון מוצרים לרשימת הקניות
 *
 * כל מוצר שנוסף לרשימה נרשם תחת `users/{uid}/products`, ומשמש להשלמה
 * אוטומטית בפעמים הבאות. ב-Firestore ולא ב-localStorage: הזיכרון צריך
 * לעבור בין מכשירים ולשרוד ניקוי מטמון.
 *
 * הלמידה נעשית ברגע ההוספה המפורשת ולא מתוכן הפתק. שם מוצר נבנה תו-תו
 * בזמן הקלדה, ולמידה מהתוכן הייתה שומרת גם את "ח" ואת "חל" בדרך ל"חלב".
 */

import {
  collection,
  doc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import { logger } from '@/utils/logger';
import { normalizeProductName, type RememberedProduct } from './productMatching';

export type { RememberedProduct };
export { rankSuggestions } from './productMatching';

/** אורך מינימלי שנחשב שם מוצר ולא הקלדה מקרית */
const MIN_NAME_LENGTH = 2;

const productsRef = (userId: string) => collection(db, 'users', userId, 'products');

/**
 * מזהה המסמך. מקודד כי מזהה ב-Firestore לא יכול להכיל '/',
 * ושמות מוצרים בהחלט יכולים ("שמן זית/קנולה").
 */
const toProductId = (normalized: string): string => encodeURIComponent(normalized);

/**
 * רישום שימוש במוצר. אידמפוטנטי מבחינת זהות - אותו שם תמיד מגיע לאותו
 * מסמך - ומגדיל את מונה השימושים בכל קריאה.
 */
export const recordProductUse = async (userId: string, name: string): Promise<void> => {
  const normalized = normalizeProductName(name);
  if (normalized.length < MIN_NAME_LENGTH) return;

  try {
    await setDoc(
      doc(productsRef(userId), toProductId(normalized)),
      {
        // נשמר כפי שהוקלד, כדי שההצעה תיראה טבעית ולא באותיות קטנות
        name: name.trim(),
        normalized,
        useCount: increment(1),
        lastUsedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    // כישלון בלמידה לא צריך להפריע להוספת הפריט לרשימה
    logger.warn('Could not record product use:', error);
  }
};

/**
 * טעינת כל המוצרים הזכורים.
 *
 * טעינה חד-פעמית ולא מנוי מתמשך: הרשימה משמשת להשלמה אוטומטית בלבד,
 * והיא קטנה - משק בית מייצר מאות מוצרים לכל היותר.
 */
export const fetchRememberedProducts = async (userId: string): Promise<RememberedProduct[]> => {
  try {
    const snapshot = await getDocs(productsRef(userId));

    return snapshot.docs
      .map((productDoc) => ({
        name: (productDoc.get('name') as string) || '',
        useCount: (productDoc.get('useCount') as number) || 0,
      }))
      .filter((product) => product.name.length > 0);
  } catch (error) {
    logger.warn('Could not load remembered products:', error);
    return [];
  }
};

