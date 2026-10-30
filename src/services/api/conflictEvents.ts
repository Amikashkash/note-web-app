/**
 * אירוע אנונימי לכל התנגשות שהגיעה לבחירה בעורך (צעד 3 בסבב 2). המטרה:
 * למדוד אם התנגשויות אמיתיות שמיזוג לפי שדה לא פותר קורות בכלל - אם כן,
 * חוזרים ל-E1 (`thinking/round2-plan.md`).
 *
 * **בלי** uid, מזהה פתק, כותרת או תוכן: רק הסיבה, שמות השדות (רשימה סגורה,
 * `noteMerge.REPORTABLE_FIELDS`), סוג התבנית והגרסה. ה-rules אוכפים את זה.
 * לא עובר ב-`writeGate`: אין בו פורמט של תוכן. כישלון לא מפריע לכלום.
 */

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import type { MergeConflict } from '@/utils/noteMerge';
import { logger } from '@/utils/logger';

const TEMPLATE_TYPES = new Set(['plain', 'checklist', 'shopping', 'workplan', 'accounting', 'recipe']);

export const reportConflict = (conflict: MergeConflict, templateType: string): void => {
  addDoc(collection(db, 'conflictEvents'), {
    at: serverTimestamp(),
    reason: conflict.reason,
    fields: conflict.fields,
    templateType: TEMPLATE_TYPES.has(templateType) ? templateType : 'other',
    clientVersion: __APP_VERSION__,
  }).catch((error: unknown) => logger.debug('Could not report a conflict:', error));
};
