/**
 * השהיית שמירה שצוברת שינויים (debounce של patch)
 *
 * למה צבירה ולא "הקריאה האחרונה מנצחת": בעריכת פתק כמה שדות עוברים
 * באותו ערוץ שמירה. בגרסה קודמת כל קריאה החליפה את הממתינה, כך ששינוי
 * כותרת ומיד אחריו סימון משימה שמרו רק את הסימון - הכותרת נשארה ישנה
 * בשרת בזמן שהמסך הציג את החדשה. כאן כל קריאה מתמזגת לתוך ה-patch
 * הממתין, ושדה שנשלח פעמיים שומר את הערך האחרון שלו.
 *
 * טהור, בלי React ובלי Firebase - ה-hook `useDebouncedPatch` עוטף אותו.
 */

export interface PatchDebouncer<T extends object> {
  /** ממזג שינוי לתוך הממתין ומתזמן שמירה מחדש */
  call: (patch: Partial<T>) => void;
  /** שולח מיד את כל מה שנצבר, אם יש */
  flush: () => void;
  /** זורק את מה שנצבר בלי לשלוח */
  cancel: () => void;
  /** יש שינוי שנצבר ועוד לא נשלח */
  hasPending: () => boolean;
  /** מחליף את פונקציית השמירה (הקולבק של הקומפוננטה מתחלף בכל רינדור) */
  setSave: (save: (patch: Partial<T>) => void) => void;
}

/**
 * `maxWaitMs`: הקלדה רצופה מאריכה את ההשהיה בכל הקשה, ובלי תקרה שום דבר
 * לא היה נשמר עד שהמשתמש עוצר. עם תקרה, נשלחת שמירה לכל המאוחר `maxWaitMs`
 * אחרי השינוי הראשון שממתין - גם באמצע הקלדה.
 */
export const createPatchDebouncer = <T extends object>(
  save: (patch: Partial<T>) => void,
  delayMs: number,
  maxWaitMs?: number
): PatchDebouncer<T> => {
  let pending: Partial<T> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** מתי נכנס השינוי הראשון שעוד ממתין */
  let firstPendingAt = 0;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const flush = () => {
    clearTimer();
    if (pending === null) return;

    const patch = pending;
    pending = null;
    save(patch);
  };

  return {
    call: (patch) => {
      if (pending === null) firstPendingAt = Date.now();
      pending = { ...pending, ...patch };
      clearTimer();
      const wait =
        maxWaitMs === undefined ? delayMs : Math.max(0, Math.min(delayMs, firstPendingAt + maxWaitMs - Date.now()));
      timer = setTimeout(flush, wait);
    },
    flush,
    cancel: () => {
      clearTimer();
      pending = null;
    },
    hasPending: () => pending !== null,
    setSave: (next) => {
      save = next;
    },
  };
};
