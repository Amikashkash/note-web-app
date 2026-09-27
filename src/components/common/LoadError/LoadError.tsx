/**
 * הודעת שגיאת טעינה עם "נסה שוב" (ST-1)
 *
 * קודם, כשמאזין נכשל (למשל permission-denied), הממשק הציג רשימה ריקה -
 * "עדיין אין קטגוריות" - כאילו הכל נמחק. כאן השגיאה מוצגת כשגיאה.
 */

import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface LoadErrorProps {
  message: string;
  onRetry?: () => void;
  /** פס צר מעל תוכן שכן נטען, במקום בלוק שתופס את המקום */
  compact?: boolean;
}

export const LoadError: React.FC<LoadErrorProps> = ({ message, onRetry, compact = false }) => (
  <div
    role="alert"
    className={`flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft dark:bg-danger-soft-dark text-ink-light dark:text-ink-dark ${
      compact ? 'p-3 mb-3' : 'p-4 sm:p-6'
    }`}
  >
    <AlertTriangle size={20} strokeWidth={1.75} className="flex-shrink-0 mt-0.5 text-danger dark:text-danger-dark" />
    <div className="flex-1 min-w-0 space-y-2">
      <p className="text-body-sm">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 text-body-sm font-medium text-danger dark:text-danger-dark hover:underline"
        >
          <RotateCw size={14} strokeWidth={2} />
          נסה שוב
        </button>
      )}
    </div>
  </div>
);
