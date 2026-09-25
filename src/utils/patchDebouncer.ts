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
  /** מחליף את פונקציית השמירה (הקולבק של הקומפוננטה מתחלף בכל רינדור) */
  setSave: (save: (patch: Partial<T>) => void) => void;
}

export const createPatchDebouncer = <T extends object>(
  save: (patch: Partial<T>) => void,
  delayMs: number
): PatchDebouncer<T> => {
  let pending: Partial<T> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

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
      pending = { ...pending, ...patch };
      clearTimer();
      timer = setTimeout(flush, delayMs);
    },
    flush,
    cancel: () => {
      clearTimer();
      pending = null;
    },
    setSave: (next) => {
      save = next;
    },
  };
};
