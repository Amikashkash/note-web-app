/**
 * שליפת כל נתוני המשתמש לצורך גיבוי
 *
 * בניגוד למנויים הרגילים, כאן נדרשת שליפה חד-פעמית שכוללת גם את
 * הפתקים המאורכבים - גיבוי שמשמיט את הארכיון אינו גיבוי.
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import type { Note } from '@/types/note';
import type { Category } from '@/types';
import { toCategory, toNote } from './mappers';
import { logger } from '@/utils/logger';
import { wrapError } from '@/utils/errors';

const NOTES_COLLECTION = 'notes';
const CATEGORIES_COLLECTION = 'categories';

export interface BackupData {
  notes: Note[];
  categories: Category[];
}

/**
 * ממזג שתי רשימות של מסמכים לפי מזהה.
 *
 * פתק יכול להופיע גם ברשימת הבעלות וגם ברשימת השיתוף (בעלים ששיתף
 * את עצמו), ובגיבוי הוא צריך להופיע פעם אחת.
 */
const mergeById = <T extends { id: string }>(...lists: T[][]): T[] =>
  Array.from(new Map(lists.flat().map((item) => [item.id, item])).values());

/**
 * שליפת כל הפתקים והקטגוריות שהמשתמש רואה - בבעלותו ומשותפים איתו,
 * כולל מאורכבים.
 *
 * Firestore לא תומך ב-OR בין שדות שונים, ולכן כל מקור נשלף בנפרד
 * והתוצאות ממוזגות - אותה גישה כמו במנויים ב-`notes.ts`.
 */
export const fetchBackupData = async (userId: string): Promise<BackupData> => {
  try {
    const notesRef = collection(db, NOTES_COLLECTION);
    const categoriesRef = collection(db, CATEGORIES_COLLECTION);

    const [ownedNotes, sharedNotes, ownedCategories, sharedCategories] = await Promise.all([
      getDocs(query(notesRef, where('userId', '==', userId))),
      getDocs(query(notesRef, where('sharedWith', 'array-contains', userId))),
      getDocs(query(categoriesRef, where('userId', '==', userId))),
      getDocs(query(categoriesRef, where('sharedWith', 'array-contains', userId))),
    ]);

    return {
      notes: mergeById(ownedNotes.docs.map(toNote), sharedNotes.docs.map(toNote)),
      categories: mergeById(
        ownedCategories.docs.map(toCategory),
        sharedCategories.docs.map(toCategory)
      ),
    };
  } catch (error) {
    logger.error('Error fetching backup data:', error);
    throw wrapError('שגיאה בשליפת הנתונים לגיבוי', error);
  }
};
