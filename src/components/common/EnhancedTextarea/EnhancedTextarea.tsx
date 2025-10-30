/**
 * Textarea משופר עם תכונות עיצוב טקסט
 * תומך ב:
 * - מספור אוטומטי (1. 2. 3.)
 * - bullet points אוטומטי (* או -)
 * - הדגשת טקסט (Ctrl+B)
 * - טקסט נטוי (Ctrl+I)
 */

import React, { useRef, KeyboardEvent } from 'react';

interface EnhancedTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  rows?: number;
}

export const EnhancedTextarea: React.FC<EnhancedTextareaProps> = ({
  value,
  onChange,
  placeholder = 'התחל לכתוב...',
  className = '',
  disabled = false,
  rows = 10,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * טיפול בלחיצה על Enter - המשך מספור או bullets
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+B - הדגשה
    if (e.ctrlKey && e.key === 'b') {
      e.preventDefault();
      insertFormatting('**', '**');
      return;
    }

    // Ctrl+I - נטוי
    if (e.ctrlKey && e.key === 'i') {
      e.preventDefault();
      insertFormatting('*', '*');
      return;
    }

    // Enter - המשך מספור או bullets
    if (e.key === 'Enter' && !e.shiftKey) {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = value.substring(0, cursorPos);
      const lines = textBeforeCursor.split('\n');
      const currentLine = lines[lines.length - 1];

      // בדיקה למספור (1. 2. וכו')
      const numberMatch = currentLine.match(/^(\d+)\.\s/);
      if (numberMatch) {
        e.preventDefault();
        const nextNumber = parseInt(numberMatch[1]) + 1;
        const newText = value.substring(0, cursorPos) + `\n${nextNumber}. ` + value.substring(cursorPos);
        onChange(newText);

        // הזזת הסמן למיקום הנכון
        setTimeout(() => {
          const newPos = cursorPos + nextNumber.toString().length + 3;
          textarea.setSelectionRange(newPos, newPos);
        }, 0);
        return;
      }

      // בדיקה ל-bullets (* או -)
      const bulletMatch = currentLine.match(/^(\*|-)\s/);
      if (bulletMatch) {
        e.preventDefault();
        const bullet = bulletMatch[1];
        const newText = value.substring(0, cursorPos) + `\n${bullet} ` + value.substring(cursorPos);
        onChange(newText);

        // הזזת הסמן למיקום הנכון
        setTimeout(() => {
          const newPos = cursorPos + 3;
          textarea.setSelectionRange(newPos, newPos);
        }, 0);
        return;
      }

      // אם השורה הנוכחית היא רק מספור/bullet ללא תוכן - בטל אותה
      if (currentLine.match(/^(\d+\.|[\*-])\s*$/)) {
        e.preventDefault();
        const lineStartPos = cursorPos - currentLine.length;
        const newText = value.substring(0, lineStartPos) + '\n' + value.substring(cursorPos);
        onChange(newText);

        setTimeout(() => {
          textarea.setSelectionRange(lineStartPos + 1, lineStartPos + 1);
        }, 0);
        return;
      }
    }
  };

  /**
   * הוספת עיצוב לטקסט מסומן
   */
  const insertFormatting = (prefix: string, suffix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    // אם יש טקסט מסומן
    if (selectedText) {
      const newText = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end);
      onChange(newText);

      // החזרת הסמן למיקום הנכון
      setTimeout(() => {
        textarea.setSelectionRange(start + prefix.length, end + prefix.length);
        textarea.focus();
      }, 0);
    } else {
      // אם אין טקסט מסומן - הוסף סימנים והכנס את הסמן ביניהם
      const newText = value.substring(0, start) + prefix + suffix + value.substring(end);
      onChange(newText);

      setTimeout(() => {
        const newPos = start + prefix.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      }, 0);
    }
  };

  /**
   * כפתורי עיצוב
   */
  const FormatButton: React.FC<{ label: string; onClick: () => void; title: string }> = ({ label, onClick, title }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  );

  return (
    <div className="w-full">
      {/* סרגל כלים */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-2 pb-2 border-b border-gray-200">
        <div className="flex gap-2">
          <FormatButton
            label="מודגש"
            onClick={() => insertFormatting('**', '**')}
            title="טקסט מודגש"
          />
          <FormatButton
            label="נטוי"
            onClick={() => insertFormatting('*', '*')}
            title="טקסט נטוי"
          />
        </div>
        <div className="hidden sm:block h-6 w-px bg-gray-300"></div>
        <span className="text-xs text-gray-500">
          טיפים: 1. למספור | * לנקודות
        </span>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={`
          w-full px-4 py-3
          border border-gray-300 rounded-lg
          focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
          disabled:bg-gray-100 disabled:cursor-not-allowed
          resize-y
          font-sans
          ${className}
        `}
        style={{ direction: 'rtl', textAlign: 'right' }}
      />

      {/* הסבר קצר */}
      <div className="mt-2 text-xs text-gray-500 space-y-1">
        <p>💡 מספור אוטומטי: התחל שורה עם "1. " ולחץ Enter</p>
        <p>💡 נקודות: התחל שורה עם "* " ולחץ Enter</p>
        <p>💡 הדגשה: סמן טקסט ולחץ על כפתור "מודגש"</p>
      </div>
    </div>
  );
};
