/**
 * קומפוננטת אינפוט כללית
 * תומכת בסוגים שונים, שגיאות, ולייבלים
 * תומך בהצגה/הסתרה של סיסמה
 */

import React, { useState } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  showPasswordToggle?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  showPasswordToggle = false,
  type,
  className = '',
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const inputStyles = error
    ? 'border-danger dark:border-danger-dark focus:ring-danger/40 focus:border-danger'
    : 'border-hairline-light dark:border-hairline-dark focus:ring-brand/40 focus:border-brand';

  const inputType = showPasswordToggle && showPassword ? 'text' : type;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-body-sm font-medium text-ink-2-light dark:text-ink-2-dark mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        {/* text-body הוא 16px בכוונה: גופן קטן מזה גורם ל-iOS לזום
            אוטומטי על השדה בעת מיקוד, וזה קופץ למשתמש בפרצוף. */}
        <input
          type={inputType}
          className={`
            w-full h-11 px-3
            bg-surface-light dark:bg-surface-dark
            text-body text-ink-light dark:text-ink-dark
            border rounded-lg
            transition-colors duration-200
            focus:outline-none focus:ring-2
            disabled:bg-raised-light dark:disabled:bg-raised-dark disabled:cursor-not-allowed
            ${showPasswordToggle ? 'pe-10' : ''}
            ${inputStyles}
            ${className}
          `}
          {...props}
        />
        {showPasswordToggle && type === 'password' && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-ink-3-light dark:text-ink-3-dark hover:text-ink-light dark:hover:text-ink-dark focus:outline-none"
            tabIndex={-1}
          >
            {showPassword ? (
              // Eye slash icon (hide)
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
              </svg>
            ) : (
              // Eye icon (show)
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1 text-caption text-danger dark:text-danger-dark">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-caption text-ink-3-light dark:text-ink-3-dark">{helperText}</p>
      )}
    </div>
  );
};
