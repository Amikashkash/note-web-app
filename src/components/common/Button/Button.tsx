/**
 * קומפוננטת כפתור כללית
 *
 * גובה קבוע ולא ריפוד אנכי: `h-11` הוא 44px, המינימום המקובל למטרת
 * מגע. ריפוד לבדו נותן גבהים שונים לפי גודל הטקסט, וכפתורים באותה
 * שורה יוצאים לא מיושרים.
 *
 * הווריאנט `outline` הפך ל-ghost - טקסט בצבע המותג עם רקע בריחוף,
 * בלי מסגרת. מסגרת `border-2` על 25 כפתורים באפליקציה יצרה רעש
 * ויזואלי שהתחרה בתוכן.
 */

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'teal';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  disabled,
  children,
  className = '',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-smooth disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles = {
    primary: 'bg-brand dark:bg-brand-dark text-white shadow-e1 hover:bg-brand-2 dark:hover:bg-brand-2-dark',
    secondary:
      'bg-surface-light dark:bg-raised-dark border border-hairline-light dark:border-hairline-dark text-ink-light dark:text-ink-dark hover:bg-raised-light dark:hover:bg-hairline-dark',
    danger: 'bg-danger dark:bg-danger-dark text-white shadow-e1 hover:opacity-90',
    // פעולה חיובית - הוספה, אישור, קנייה
    teal: 'bg-teal-fill dark:bg-teal-dark text-white dark:text-ink-dark shadow-e1 hover:opacity-90',
    outline:
      'text-brand-text dark:text-brand-text-dark hover:bg-raised-light dark:hover:bg-raised-dark',
  };

  const sizeStyles = {
    sm: 'h-9 px-4 text-body-sm',
    md: 'h-11 px-5 text-body',
    lg: 'h-12 px-6 text-body',
  };

  const widthStyles = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyles} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>טוען...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};
