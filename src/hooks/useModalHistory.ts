/**
 * מחבר חלונית להיסטוריית הדפדפן
 *
 * הבעיה: החלוניות באפליקציה מנוהלות ב-state ולא כמסלולים, ולכן אין להן
 * רשומה בהיסטוריה. לחיצה על "חזור" באנדרואיד לא מוצאת חלונית לסגור,
 * מוציאה את הרשומה האמיתית מהמחסנית, וב-PWA מותקנת זה סוגר את
 * האפליקציה כולה במקום לסגור את הפתק.
 *
 * הפתרון: כשחלונית נפתחת נדחפת רשומת היסטוריה ריקה. "חזור" מוציא אותה,
 * ואנחנו סוגרים את החלונית במקום לתת לדפדפן לנווט.
 */

import { useEffect, useRef } from 'react';

export const useModalHistory = (isOpen: boolean, onClose: () => void): void => {
  // דרך ref ולא כתלות: `onClose` נוצר מחדש כמעט בכל רינדור, ותלות בו
  // הייתה מריצה את ה-effect שוב ודוחפת רשומה כפולה בכל רינדור.
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  /** האם הסגירה הגיעה מכפתור "חזור" ולא מתוך הממשק */
  const closedByBackRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    closedByBackRef.current = false;
    window.history.pushState({ modal: true }, '');

    const handlePopState = () => {
      closedByBackRef.current = true;
      onCloseRef.current();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);

      // נסגרה מבפנים (כפתור סגירה, Escape, שמירה) - הרשומה שדחפנו
      // עדיין במחסנית וצריך להסיר אותה, אחרת "חזור" הבא לא יעשה כלום
      // והמשתמש ייתקע. אם הסגירה כבר הגיעה מ"חזור", הרשומה הוסרה.
      if (!closedByBackRef.current) {
        window.history.back();
      }
    };
  }, [isOpen]);
};
