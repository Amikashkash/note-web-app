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
      <div className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto bg-black/50 dark:bg-black/70">
        {/* Backdrop */}
        <div
          className="fixed inset-0 -z-10"
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div className="relative bg-white dark:bg-gray-800 rounded-none sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl sm:w-auto min-h-screen sm:min-h-0 sm:my-4 max-h-screen sm:max-h-[95vh] overflow-y-auto transition-colors"
          style={{
            WebkitOverflowScrolling: 'touch'
          } as React.CSSProperties}
        >
          {/* Header - only show if title is provided */}
          {title && (
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">{title}</h2>
              <button
                onClick={onClose}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
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
