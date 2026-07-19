/**
 * Hook להשהיית קריאות (debounce)
 *
 * שימוש עיקרי: עריכה inline של פתק. בלי זה כל הקשה על מקש
 * מייצרת כתיבה נפרדת ל-Firestore.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';

export interface DebouncedCallback<A extends unknown[]> {
  /** מתזמן קריאה; קריאה נוספת לפני שחלף הזמן מאפסת את ההמתנה */
  call: (...args: A) => void;
  /** מריץ מיד את הקריאה הממתינה, אם יש כזו */
  flush: () => void;
  /** מבטל קריאה ממתינה בלי להריץ אותה */
  cancel: () => void;
}

export const useDebouncedCallback = <A extends unknown[]>(
  callback: (...args: A) => void,
  delayMs: number
): DebouncedCallback<A> => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgsRef = useRef<A | null>(null);

  // שומרים את הקולבק ב-ref כדי שה-debounce לא יאותחל מחדש
  // בכל רינדור כשמעבירים פונקציה אנונימית.
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flush = useCallback(() => {
    clearTimer();
    const args = pendingArgsRef.current;
    if (args) {
      pendingArgsRef.current = null;
      callbackRef.current(...args);
    }
  }, [clearTimer]);

  const cancel = useCallback(() => {
    clearTimer();
    pendingArgsRef.current = null;
  }, [clearTimer]);

  const call = useCallback(
    (...args: A) => {
      pendingArgsRef.current = args;
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const pending = pendingArgsRef.current;
        pendingArgsRef.current = null;
        if (pending) callbackRef.current(...pending);
      }, delayMs);
    },
    [clearTimer, delayMs]
  );

  // בפירוק הקומפוננטה שומרים את מה שממתין במקום לאבד אותו
  useEffect(() => {
    return () => {
      const args = pendingArgsRef.current;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      if (args) callbackRef.current(...args);
    };
  }, []);

  return useMemo(() => ({ call, flush, cancel }), [call, flush, cancel]);
};
