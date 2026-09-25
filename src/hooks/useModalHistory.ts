/**
 * מחבר חלונית להיסטוריית הדפדפן
 *
 * הבעיה: החלוניות באפליקציה מנוהלות ב-state ולא כמסלולים, ולכן אין להן
 * רשומה בהיסטוריה. לחיצה על "חזור" באנדרואיד לא מוצאת חלונית לסגור,
 * מוציאה את הרשומה האמיתית מהמחסנית, וב-PWA מותקנת זה סוגר את
 * האפליקציה כולה במקום לסגור את הפתק.
 *
 * הפתרון: כשחלונית נפתחת נדחפת רשומת היסטוריה משלה, עם מזהה ועומק.
 * "חזור" מוציא אותה, ואנחנו סוגרים את החלונית במקום לתת לדפדפן לנווט.
 *
 * למה מזהה ועומק ולא סתם "כל popstate סוגר": ה-effect יכול לרוץ שוב
 * על אותה חלונית (StrictMode בפיתוח מריץ mount → cleanup → mount). בגרסה
 * קודמת ה-cleanup קרא ל-`history.back()`, וה-popstate שלו הגיע אחרי
 * שה-mount השני כבר האזין - והחלונית סגרה את עצמה חלקיק שנייה אחרי
 * שנפתחה. עכשיו:
 *
 * - popstate סוגר חלונית רק אם הרשומה שנעשתה נוכחית רדודה מהרשומה שלה.
 *   בחלוניות מקוננות "חזור" אחד סוגר רק את העליונה.
 * - הסרת הרשומה אחרי סגירה מהממשק נדחית ל-microtask. mount חוזר של
 *   אותה חלונית מבטל אותה (הרשומה עדיין שלה), וחלונית אחרת שנפתחת
 *   באותו commit מקבלת את הרשומה במקום לדחוף חדשה - כך ה-`back()` הדחוי
 *   לא מוציא בטעות את הרשומה של החלונית החדשה.
 */

import { useEffect, useId, useRef } from 'react';

interface ModalHistoryState {
  modalId?: string;
  /** מספר החלוניות הפתוחות כשהרשומה הזו נוכחית. 0 או חסר = אין חלונית */
  modalDepth?: number;
}

const readState = (state: unknown = window.history.state): ModalHistoryState =>
  typeof state === 'object' && state !== null ? (state as ModalHistoryState) : {};

const currentDepth = (state?: unknown): number => {
  const depth = readState(state).modalDepth;
  return typeof depth === 'number' ? depth : 0;
};

/**
 * חלוניות שנסגרו מהממשק ומחכות להסרת הרשומה שלהן: מזהה → עומק.
 * ההסרה מתבצעת ב-microtask אחד לכל הסגירות של אותו commit, כך שסדר
 * ה-cleanup בין חלונית חיצונית לפנימית לא משנה.
 */
const closing = new Map<string, number>();
let flushScheduled = false;

const flushClosing = () => {
  flushScheduled = false;
  if (closing.size === 0) return;

  // יורדים מהרשומה העליונה כל עוד היא שייכת לחלונית שנסגרה.
  // חלונית שעדיין פתוחה מעל חלונית שנסגרה עוצרת את הירידה - לא מוציאים
  // רשומה של חלונית חיה.
  const closedDepths = new Set(closing.values());
  closing.clear();

  const top = currentDepth();
  let target = top;
  while (target > 0 && closedDepths.has(target)) target -= 1;

  if (target < top) window.history.go(target - top);
};

export const useModalHistory = (isOpen: boolean, onClose: () => void): void => {
  const modalId = useId();

  // דרך ref ולא כתלות: `onClose` נוצר מחדש כמעט בכל רינדור, ותלות בו
  // הייתה מריצה את ה-effect שוב ודוחפת רשומה כפולה בכל רינדור.
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const top = readState();
    let depth: number;

    if (closing.has(modalId)) {
      // mount חוזר של אותה חלונית (StrictMode, או הרצה חוזרת של ה-effect):
      // הרשומה שלנו עדיין במחסנית - מבטלים את ההסרה שלה
      depth = closing.get(modalId)!;
      closing.delete(modalId);
    } else if (top.modalId !== undefined && closing.has(top.modalId)) {
      // חלונית אחרת נסגרה באותו commit והרשומה שלה עליונה - לוקחים אותה
      // לעצמנו במקום לדחוף חדשה, אחרת ההסרה הדחויה הייתה מוציאה את שלנו
      depth = closing.get(top.modalId)!;
      closing.delete(top.modalId);
      window.history.replaceState({ ...top, modalId, modalDepth: depth }, '');
    } else if (top.modalId === modalId) {
      depth = currentDepth();
    } else {
      depth = currentDepth() + 1;
      // שומרים את שאר ה-state (למשל של React Router) כדי שהנתב לא
      // יחשוב שזו ניווט למיקום אחר
      window.history.pushState({ ...top, modalId, modalDepth: depth }, '');
    }

    const handlePopState = (event: PopStateEvent) => {
      // רשומה ברמה שלנו או עמוקה יותר עדיין נוכחית - ה-popstate שייך
      // לחלונית אחרת (למשל ההסרה של חלונית פנימית שנסגרה מהממשק)
      if (currentDepth(event.state) >= depth) return;
      onCloseRef.current();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);

      // נסגרה מ"חזור" - הרשומה שלנו כבר מתחת לנוכחית ואין מה להסיר
      if (depth > currentDepth()) return;

      // נסגרה מבפנים (כפתור סגירה, Escape, שמירה) - הרשומה שלנו עדיין
      // במחסנית ויש להסיר אותה, אחרת "חזור" הבא לא יעשה כלום. נדחה כדי
      // ש-mount חוזר יוכל לבטל.
      closing.set(modalId, depth);
      if (!flushScheduled) {
        flushScheduled = true;
        queueMicrotask(flushClosing);
      }
    };
  }, [isOpen, modalId]);
};
