/**
 * Modal Component
 * Reusable modal dialog
 */

import React, { useEffect, useId } from 'react';
import { Portal } from '../Portal/Portal';
import { useModalHistory } from '@/hooks/useModalHistory';

interface ModalProps {
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * החלוניות הפתוחות, מהתחתונה לעליונה. Escape סוגר רק את העליונה - כמו "חזור"
 * (`useModalHistory`). קודם כל חלונית האזינה ל-Escape בעצמה, וחלונית מעל
 * פתק (טיפים, שיתוף, היסטוריה) סגרה גם את הפתק שמתחתיה.
 */
const openModals: string[] = [];

export const Modal: React.FC<ModalProps> = ({ onClose, title, children }) => {
  const modalId = useId();
  // כאן ולא בכל חלונית בנפרד: כל החלוניות באפליקציה עוברות דרך הרכיב
  // הזה, ואף אחת לא עוקפת אותו. חיבור במקום אחד מבטיח שגם חלונית
  // שתיווצר בעתיד תתנהג נכון מול כפתור "חזור" בלי לזכור לחבר אותה.
  // הרכיב מרונדר רק כשהחלונית פתוחה, ולכן `isOpen` תמיד אמת.
  useModalHistory(true, onClose);

  useEffect(() => {
    openModals.push(modalId);
    return () => {
      const index = openModals.lastIndexOf(modalId);
      if (index !== -1) openModals.splice(index, 1);
    };
  }, [modalId]);

  // Close on Escape key - רק החלונית העליונה
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openModals[openModals.length - 1] === modalId) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      // חלונית פנימית שנסגרת לא משחררת את הגלילה מתחת לחלונית שעדיין פתוחה.
      // בלי תלות בסדר ה-cleanup: "אין אחרת פתוחה", בין אם זו כבר הוסרה ובין אם לא
      if (openModals.every((id) => id === modalId)) document.body.style.overflow = 'unset';
    };
  }, [onClose, modalId]);

  return (
    <Portal>
      {/* בנייד החלונית עוגנת לתחתית כגיליון (bottom sheet) ולא ממלאת
          את המסך: זו התנהגות מוכרת במגע, והפינות המעוגלות למעלה מרמזות
          שאפשר לסגור. במסך רחב היא נשארת חלונית ממורכזת. */}
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 dark:bg-black/70">
        {/* Backdrop */}
        <div
          className="fixed inset-0 -z-10"
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div className="relative bg-surface-light dark:bg-surface-dark rounded-t-2xl sm:rounded-xl shadow-e3 w-full sm:max-w-4xl sm:w-auto max-h-[92vh] sm:max-h-[95vh] overflow-y-auto transition-colors"
          style={{
            WebkitOverflowScrolling: 'touch'
          } as React.CSSProperties}
        >
          {/* Header - only show if title is provided */}
          {title && (
            <div className="flex items-center justify-between p-4 border-b border-hairline-light dark:border-hairline-dark sticky top-0 bg-surface-light dark:bg-surface-dark z-10">
              <h2 className="text-h1 text-ink-light dark:text-ink-dark">{title}</h2>
              <button
                onClick={onClose}
                className="h-11 w-11 -m-2 grid place-items-center rounded-xl text-ink-3-light dark:text-ink-3-dark hover:text-ink-light dark:hover:text-ink-dark hover:bg-raised-light dark:hover:bg-raised-dark transition-colors"
                aria-label="סגור"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Content */}
          <div className="p-4 sm:p-6">
            {children}
          </div>
        </div>
      </div>
    </Portal>
  );
};
