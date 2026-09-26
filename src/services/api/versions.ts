/**
 * קריאת היסטוריית הגרסאות של פתק
 *
 * קריאה בלבד: הגרסאות נכתבות רק ע"י הטריגר בענן, וה-rules חוסמים כל
 * כתיבה מהלקוח. שחזור הוא עדכון רגיל של הפתק (`restoreNoteVersion`).
 */

import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import type { NoteVersion } from '@/types/version';
import { toNoteVersion } from './mappers';
import { logger } from '@/utils/logger';
import { wrapError } from '@/utils/errors';

/** השרת שומר לכל היותר 50 גרסאות לפתק */
const MAX_VERSIONS = 50;

export const fetchNoteVersions = async (noteId: string): Promise<NoteVersion[]> => {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'notes', noteId, 'versions'),
        orderBy('capturedAt', 'desc'),
        limit(MAX_VERSIONS)
      )
    );
    return snapshot.docs.map(toNoteVersion);
  } catch (error) {
    logger.error('Error loading note versions:', error);
    throw wrapError('שגיאה בטעינת ההיסטוריה', error);
  }
};
