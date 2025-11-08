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
   * נרמול מספור - מתקן את המספרים ברשימה ממוספרת
   */
  const normalizeNumbering = (text: string): string => {
    const lines = text.split('\n');
    let currentNumber = 0;
    let inNumberedList = false;

    const normalizedLines = lines.map((line) => {
      const numberMatch = line.match(/^(\d+)\.\s(.*)$/);

      if (numberMatch) {
        // מצאנו שורה ממוספרת
        inNumberedList = true;
        currentNumber++;
        return `${currentNumber}. ${numberMatch[2]}`;
      } else if (line.trim() === '' && inNumberedList) {
        // שורה רק אם סיימה רשימה ממוספרת
        currentNumber = 0;
        inNumberedList = false;
        return line;
      } else if (inNumberedList && !line.match(/^(\d+)\./)) {
        // שורה שאינה ממוספרת סיימה את הרשימה
        currentNumber = 0;
        inNumberedList = false;
        return line;
      }

      return line;
    });

    return normalizedLines.join('\n');
  };

  /**
   * טיפול בשינוי טקסט - עם נרמול מספור
   */
  const handleChange = (newValue: string) => {
    // נרמול המספור
    const normalized = normalizeNumbering(newValue);
    onChange(normalized);
  };

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

        // הזזת הסמן למיקום הנכון וגלילה
        setTimeout(() => {
          const newPos = cursorPos + nextNumber.toString().length + 3;
          textarea.setSelectionRange(newPos, newPos);
          // גלילה כדי להראות את הסמן
          const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight);
          const cursorLine = newText.substring(0, newPos).split('\n').length;
          textarea.scrollTop = Math.max(0, (cursorLine - 3) * lineHeight);
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

        // הזזת הסמן למיקום הנכון וגלילה
        setTimeout(() => {
          const newPos = cursorPos + 3;
          textarea.setSelectionRange(newPos, newPos);
          // גלילה כדי להראות את הסמן
          const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight);
          const cursorLine = newText.substring(0, newPos).split('\n').length;
          textarea.scrollTop = Math.max(0, (cursorLine - 3) * lineHeight);
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

      // Enter רגיל - גלילה אוטומטית כדי להראות את השורה החדשה
      setTimeout(() => {
        if (!textarea) return;
        // גלילה כדי להראות את הסמן בשורה החדשה
        const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight) || 20;
        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = textarea.value.substring(0, cursorPos);
        const cursorLine = textBeforeCursor.split('\n').length;

        // גלול כך שהסמן יהיה 3 שורות מלמעלה של ה-textarea
        const scrollTarget = Math.max(0, (cursorLine - 3) * lineHeight);
        textarea.scrollTop = scrollTarget;
      }, 0);
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
   * טיפול בהדבקה ידנית (למובייל)
   */
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = value.substring(0, start) + text + value.substring(end);

      onChange(newText);

      // החזרת הסמן למיקום הנכון
      setTimeout(() => {
        const newPos = start + text.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      }, 0);
    } catch (err) {
      console.error('Failed to read clipboard:', err);
      // אם אין הרשאה, נסה להשתמש ב-execCommand (fallback ישן)
      try {
        document.execCommand('paste');
      } catch (e) {
        alert('לא ניתן להדביק. אנא נסה שוב או השתמש בתפריט ההדבקה של הדפדפן.');
      }
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
      className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded border border-gray-300 dark:border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200"
    >
      {label}
    </button>
  );

  return (
    <div className="w-full">
      {/* סרגל כלים */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-2 flex-wrap">
          <FormatButton
            label="📋 הדבק"
            onClick={handlePaste}
            title="הדבק טקסט מהלוח (מיועד למובייל)"
          />
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
        <div className="hidden sm:block h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          טיפים: 1. למספור | * לנקודות
        </span>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={`
          w-full px-4 py-3
          border border-gray-300 dark:border-gray-600 rounded-lg
          bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
          focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
          disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
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
