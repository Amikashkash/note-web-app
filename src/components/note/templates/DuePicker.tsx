/**
 * בורר תאריך / שעה של משימה: אייקון, ומעליו קלט שקוף של המערכת (v1.44.1).
 *
 * עד 1.44.0 הקלט היה `absolute left-0 w-8` על **כל** המיכל. ב-RTL האייקון
 * ראשון (ימין) וה-X שני (שמאל), ולכן עם ערך הקלט זז מתחת ל-X וכיסה רק 70%
 * מהאייקון. ובנוסף, קלט תאריך שקוף נפתח רק כשהנגיעה פוגעת בכפתור הפנימי
 * שלו, ומיקום הכפתור הזה תלוי בפריסה הפנימית של הדפדפן (רוחב, ערך, RTL).
 * התוצאה: נגיעה באייקון פתחה את הבורר לפעמים, ולפעמים לא.
 *
 * עכשיו:
 * - הקלט בתוך תיבה משלו עם האייקון (`inset-0`), ומכסה בדיוק אותו. ה-X מחוץ לה.
 * - נגיעה קוראת ל-`showPicker()`, כך שהבורר נפתח בכל נקודה בקלט ולא רק על
 *   הכפתור הפנימי. דפדפן בלי `showPicker` - ההתנהגות הרגילה של הקלט.
 * - אזור הנגיעה 32px, גדול מהאייקון (20px), בלי לשנות את הפריסה (שוליים שליליים).
 *   הרווח ל-X (8px) גדול מההרחבה (6px), כך שהם לא נוגעים זה בזה.
 */

import React from 'react';
import { X, type LucideIcon } from 'lucide-react';

interface DuePickerProps {
  inputId: string;
  type: 'date' | 'time';
  value: string;
  Icon: LucideIcon;
  colorClass: string;
  title: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

/** פותח את בורר המערכת. `showPicker` חסר בדפדפנים ישנים, וזורק כשהוא כבר פתוח */
const openPicker = (input: HTMLInputElement) => {
  try {
    input.showPicker?.();
  } catch {
    // ההתנהגות הרגילה של הקלט נשארת
  }
};

export const DuePicker: React.FC<DuePickerProps> = ({
  inputId,
  type,
  value,
  Icon,
  colorClass,
  title,
  onChange,
  onClear,
}) => (
  <div className="flex-shrink-0 flex items-center gap-2">
    <span className={`relative grid place-items-center h-8 w-8 -m-1.5 ${colorClass}`} title={title} data-due-picker={type}>
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
      <input
        id={inputId}
        type={type}
        value={value}
        aria-label={title}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => openPicker(event.currentTarget)}
        className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
      />
    </span>
    {value && (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClear();
        }}
        className="text-ink-3-light dark:text-ink-3-dark hover:text-danger"
        title={type === 'date' ? 'הסר תאריך' : 'הסר שעה'}
        aria-label={type === 'date' ? 'הסר תאריך' : 'הסר שעה'}
      >
        <X size={14} strokeWidth={2} />
      </button>
    )}
  </div>
);
