/**
 * שירות API לניהול קטגוריות ב-Firestore
 */

import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/services/firebase/config';
import { getDefaultCategory } from '@/utils/defaults';
import type { Category, CategoryInput } from '@/types';
import { toCategory } from './mappers';
import { findUserIdByEmail } from './users';
import { logger } from '@/utils/logger';
import { wrapError } from '@/utils/errors';

const CATEGORIES_COLLECTION = 'categories';
const NOTES_COLLECTION = 'notes';

/** מגבלת הפעולות ב-batch יחיד של Firestore */
const BATCH_LIMIT = 500;

const categoryRef = (categoryId: string) => doc(db, CATEGORIES_COLLECTION, categoryId);
const categoriesRef = () => collection(db, CATEGORIES_COLLECTION);

/**
 * יצירת קטגוריה חדשה
 */
export const createCategory = async (
  userId: string,
  name: string,
  color?: string
): Promise<string> => {
  try {
    const docRef = await addDoc(categoriesRef(), {
      ...getDefaultCategory(userId, name),
      ...(color && { color }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    logger.error('Error creating category:', error);
    throw wrapError('שגיאה ביצירת הקטגוריה', error);
  }
};

/**
 * עדכון קטגוריה קיימת
 */
export const updateCategory = async (
  categoryId: string,
  updates: Partial<CategoryInput>
): Promise<void> => {
  try {
    // `sharedWith` מתעדכן רק דרך פונקציות השיתוף הייעודיות, שמשתמשות
    // בפעולות מערך אטומיות. עדכון ישיר שלו כאן היה דורס שיתופים מקבילים.
    const { sharedWith: _ignored, ...safeUpdates } = updates;

    await updateDoc(categoryRef(categoryId), {
      ...safeUpdates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    logger.error('Error updating category:', error);
    throw wrapError('שגיאה בעדכון הקטגוריה', error);
  }
};

/**
 * מחיקת קטגוריה
 */
export const deleteCategory = async (categoryId: string): Promise<void> => {
  try {
    await deleteDoc(categoryRef(categoryId));
  } catch (error) {
    logger.error('Error deleting category:', error);
    throw wrapError('שגיאה במחיקת הקטגוריה', error);
  }
};

/**
 * קבלת כל הקטגוריות של משתמש (שליפה חד-פעמית)
 */
export const getUserCategories = async (userId: string): Promise<Category[]> => {
  try {
    const snapshot = await getDocs(query(categoriesRef(), where('userId', '==', userId)));
    return snapshot.docs.map(toCategory).sort((a, b) => a.order - b.order);
  } catch (error) {
    logger.error('Error getting categories:', error);
    throw wrapError('שגיאה בטעינת הקטגוריות', error);
  }
};

/**
 * מנוי לשינויים בקטגוריות (בבעלות המשתמש + משותפות איתו).
 *
 * כמו בפתקים - שני מאזינים שממוזגים, כי Firestore לא תומך ב-OR בין שדות.
 */
export const subscribeToCategories = (
  userId: string,
  callback: (categories: Category[]) => void
): Unsubscribe => {
  let owned: Category[] = [];
  let shared: Category[] = [];
  let ownedLoaded = false;
  let sharedLoaded = false;

  const emit = () => {
    if (!ownedLoaded || !sharedLoaded) return;

    const unique = Array.from(
      new Map([...owned, ...shared].map((category) => [category.id, category])).values()
    ).sort((a, b) => a.order - b.order);

    callback(unique);
  };

  const unsubscribeOwned = onSnapshot(
    query(categoriesRef(), where('userId', '==', userId)),
    (snapshot) => {
      owned = snapshot.docs.map(toCategory);
      ownedLoaded = true;
      emit();
    },
    (error) => {
      logger.error('Error in owned categories subscription:', error);
      ownedLoaded = true;
      emit();
    }
  );

  const unsubscribeShared = onSnapshot(
    query(categoriesRef(), where('sharedWith', 'array-contains', userId)),
    (snapshot) => {
      shared = snapshot.docs.map(toCategory);
      sharedLoaded = true;
      emit();
    },
    (error) => {
      logger.error('Error in shared categories subscription:', error);
      sharedLoaded = true;
      emit();
    }
  );

  return () => {
    unsubscribeOwned();
    unsubscribeShared();
  };
};

/**
 * מחיל פעולת מערך על שדה `sharedWith` של הקטגוריה ושל כל הפתקים שבתוכה,
 * בכתיבות אטומיות. `arrayUnion`/`arrayRemove` הן idempotent, ולכן אין
 * צורך לבדוק מראש מי כבר נמצא ברשימה.
 */
const applySharingToCategoryTree = async (
  categoryId: string,
  operation: ReturnType<typeof arrayUnion> | ReturnType<typeof arrayRemove>
): Promise<void> => {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('משתמש לא מחובר');
  }

  /**
   * הסינון לפי `userId` אינו אופטימיזציה - בלעדיו השאילתה נדחית.
   *
   * Firestore מעריך כללי הרשאה מול השאילתה עצמה ולא מול התוצאות שהיא
   * מחזירה. כלל הקריאה לפתקים דורש בעלות או שיתוף, ושאילתה שמסננת לפי
   * `categoryId` בלבד לא מוכיחה שכל מה שיחזור קריא - אז היא נכשלת
   * ב-permission-denied, וכל שיתוף קטגוריה נכשל איתה.
   *
   * הסינון גם נכון לגופו: אפשר לשתף רק פתקים שבבעלותך. פתק של מישהו
   * אחר שיושב בקטגוריה משותפת אינו שלך לחלוק הלאה.
   */
  const notesSnapshot = await getDocs(
    query(
      collection(db, NOTES_COLLECTION),
      where('categoryId', '==', categoryId),
      where('userId', '==', userId)
    )
  );

  const targets = [categoryRef(categoryId), ...notesSnapshot.docs.map((noteDoc) => noteDoc.ref)];

  // מחלקים ל-batches כדי לא לעבור את מגבלת הפעולות של Firestore
  for (let i = 0; i < targets.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const ref of targets.slice(i, i + BATCH_LIMIT)) {
      batch.update(ref, { sharedWith: operation, updatedAt: serverTimestamp() });
    }
    await batch.commit();
  }

  logger.debug(`Updated sharing for category ${categoryId} and ${notesSnapshot.size} notes`);
};

/**
 * שיתוף קטגוריה (וכל הפתקים שבה) עם משתמש אחר לפי אימייל
 */
export const shareCategoryWithUser = async (
  categoryId: string,
  userEmail: string
): Promise<void> => {
  const targetUserId = await findUserIdByEmail(userEmail);
  if (!targetUserId) {
    throw new Error('משתמש לא נמצא במערכת');
  }

  try {
    await applySharingToCategoryTree(categoryId, arrayUnion(targetUserId));
  } catch (error) {
    logger.error('Error sharing category:', error);
    throw wrapError('שגיאה בשיתוף הקטגוריה', error);
  }
};

/**
 * הסרת משתמש משיתוף קטגוריה (וכל הפתקים שבה)
 */
export const unshareCategoryWithUser = async (
  categoryId: string,
  userId: string
): Promise<void> => {
  try {
    await applySharingToCategoryTree(categoryId, arrayRemove(userId));
  } catch (error) {
    logger.error('Error unsharing category:', error);
    throw wrapError('שגיאה בהסרת השיתוף', error);
  }
};
