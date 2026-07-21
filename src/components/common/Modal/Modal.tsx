/**
 * Modal Component
 * Reusable modal dialog
 */

import React, { useEffect } from 'react';
import { Portal } from '../Portal/Portal';

interface ModalProps {
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ onClose, title, children }) => {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

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
