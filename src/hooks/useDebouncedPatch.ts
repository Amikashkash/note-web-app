/**
 * Hook לשמירה מושהית שצוברת שינויים
 *
 * שימוש עיקרי: עריכה inline של פתק. בלי השהיה כל הקשה על מקש
 * מייצרת כתיבה נפרדת ל-Firestore; בלי צבירה, שינוי בשדה אחד היה
 * מוחק מהתור שינוי ממתין בשדה אחר. הלוגיקה עצמה ב-`createPatchDebouncer`.
 */

import { useEffect, useState } from 'react';
import { createPatchDebouncer, type PatchDebouncer } from '@/utils/patchDebouncer';

export const useDebouncedPatch = <T extends object>(
  save: (patch: Partial<T>) => void,
  delayMs: number
): PatchDebouncer<T> => {
  // נוצר פעם אחת, כדי שהצבירה והטיימר ישרדו רינדורים
  const [debouncer] = useState(() => createPatchDebouncer<T>(save, delayMs));

  // הקולבק מתחלף בכל רינדור (פונקציה אנונימית) - מעדכנים אותו בלי
  // לאתחל את ה-debounce ובלי לאבד את מה שממתין
  useEffect(() => {
    debouncer.setSave(save);
  }, [debouncer, save]);

  // בפירוק הקומפוננטה שומרים את מה שממתין במקום לאבד אותו
  useEffect(() => () => debouncer.flush(), [debouncer]);

  return debouncer;
};
