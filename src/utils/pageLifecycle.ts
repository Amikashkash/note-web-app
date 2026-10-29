/**
 * "הדף עומד להיעלם": מעבר לאפליקציה אחרת, נעילת מסך, סגירת לשונית.
 *
 * ב-PWA במובייל אין unmount כשהמערכת שולחת את האפליקציה לרקע ואחר כך
 * הורגת אותה - ולכן flush ב-unmount לבדו מאבד את מה שהמתין ב-debounce.
 * הסימנים האמינים:
 * - `visibilitychange` ל-`hidden`: נעילת מסך, מעבר אפליקציה, מעבר לשונית.
 *   ב-iOS זה לעתים קרובות האירוע **היחיד** שמגיע לפני הקפאה.
 * - `pagehide`: סגירה, ניווט, ו-bfcache.
 * - `freeze` (Chrome): הדפדפן מקפיא לשונית ברקע.
 * אותה פעולה יכולה לקרות פעמיים (hidden ואחריו pagehide) - הקורא חייב
 * להיות אידמפוטנטי. flush של debouncer ריק לא עושה כלום, אז זה בסדר.
 *
 * טהור מבחינת תלות: המטרות מוזרקות, כדי לבדוק בלי DOM.
 */

interface VisibilitySource extends EventTarget {
  visibilityState: string;
}

export const onPageHidden = (
  callback: () => void,
  doc: VisibilitySource = document,
  win: EventTarget = window
): (() => void) => {
  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') callback();
  };
  doc.addEventListener('visibilitychange', onVisibility);
  doc.addEventListener('freeze', callback);
  win.addEventListener('pagehide', callback);
  return () => {
    doc.removeEventListener('visibilitychange', onVisibility);
    doc.removeEventListener('freeze', callback);
    win.removeEventListener('pagehide', callback);
  };
};
