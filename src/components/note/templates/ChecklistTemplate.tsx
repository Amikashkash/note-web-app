/**
 * תבנית רשימת משימות - To-Do List
 *
 * המשימות נשמרות כ-JSON במחרוזת אחת (`value`), ולכן כל שינוי בונה מחדש
 * את כל הרשימה ומוסר אותה ב-`onChange`. חשוב: `items` נגזר מ-`value`
 * ולכן הוא מתעדכן רק ברינדור הבא - שתי קריאות עדכון באותו אירוע היו
 * מתבססות על אותו מצב ישן, והשנייה הייתה דורסת את הראשונה. לכן כל
 * פעולה חייבת להסתכם בקריאה אחת ל-`updateItem`.
 */

import React, { useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/common/Button';
import { useNotificationOptIn } from '@/hooks/useNotificationOptIn';
import {
  getDateStatus,
  formatDueLabel,
  DATE_STATUS_TEXT_CLASS,
  DATE_STATUS_BORDER_CLASS,
} from './dueDate';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string; // תאריך יעד בפורמט YYYY-MM-DD
  dueTime?: string; // שעת יעד בפורמט HH:MM
}

interface ChecklistTemplateProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

interface DuePickerProps {
  inputId: string;
  type: 'date' | 'time';
  value: string;
  icon: string;
  colorClass: string;
  title: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

/**
 * בורר תאריך/שעה: הקלט עצמו שקוף ופרוס מעל האייקון, כדי שלחיצה על
 * האייקון תפתח את בורר המערכת. אותו מבנה שימש פעמיים - לתאריך ולשעה.
 */
const DuePicker: React.FC<DuePickerProps> = ({
  inputId,
  type,
  value,
  icon,
  colorClass,
  title,
  onChange,
  onClear,
}) => (
  <div className="relative flex-shrink-0 flex items-center gap-1">
    <input
      id={inputId}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="absolute left-0 top-0 w-8 h-8 opacity-0 cursor-pointer"
      style={{ zIndex: 10 }}
    />
    <label
      htmlFor={inputId}
      className={`cursor-pointer text-lg pointer-events-none ${colorClass}`}
      title={title}
    >
      {icon}
    </label>
    {value && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClear();
        }}
        className="text-xs text-gray-400 hover:text-red-600 relative z-20"
        title={type === 'date' ? 'הסר תאריך' : 'הסר שעה'}
      >
        ✕
      </button>
    )}
  </div>
);

export const ChecklistTemplate: React.FC<ChecklistTemplateProps> = ({
  value,
  onChange,
  readOnly = false,
}) => {
  // מזהה המשימה שצריכה לקבל פוקוס אחרי הרינדור הבא.
  // ref ולא state: זו פעולת DOM בלבד ואינה משפיעה על מה שמוצג,
  // ולכן אין סיבה לגרור בגללה רינדור נוסף.
  const pendingFocusIdRef = useRef<string | null>(null);
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const { warning: notificationWarning, ensureEnabled } = useNotificationOptIn();

  const items = useMemo<ChecklistItem[]>(() => {
    try {
      const parsed = value ? JSON.parse(value) : [];
      if (!Array.isArray(parsed)) return [];

      // מזהה הנגזר מהמיקום ברשימה - יציב בין פענוחים של אותו תוכן,
      // בניגוד ל-Date.now() שהופך את הפענוח ללא-דטרמיניסטי
      return parsed.map((item, index) => ({
        id: item.id || `item-${index}`,
        text: item.text || '',
        completed: item.completed || false,
        dueDate: item.dueDate,
        dueTime: item.dueTime,
      }));
    } catch {
      return [];
    }
  }, [value]);

  // רץ אחרי כל רינדור, כי אי אפשר לדעת מראש מתי שדה המשימה החדשה יצורף ל-DOM
  useEffect(() => {
    const pendingId = pendingFocusIdRef.current;
    if (!pendingId) return;

    const input = inputRefs.current[pendingId];
    if (input) {
      input.focus();
      pendingFocusIdRef.current = null;
    }
  });

  const commit = (updated: ChecklistItem[]) => onChange(JSON.stringify(updated));

  /**
   * עדכון משימה בודדת. נקודת המעבר היחידה לשינוי פריט - קריאה אחת
   * לאירוע, כדי שלא ייווצר מצב שבו עדכון שני מתבסס על מצב שכבר התיישן.
   */
  const updateItem = (id: string, patch: Partial<ChecklistItem>) => {
    commit(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleAddItem = () => {
    const newId = Date.now().toString();
    commit([...items, { id: newId, text: '', completed: false }]);
    pendingFocusIdRef.current = newId;
  };

  const handleToggleItem = (id: string, completed: boolean) => {
    updateItem(id, { completed: !completed });
  };

  const handleUpdateText = (id: string, text: string) => {
    updateItem(id, { text });
  };

  const handleUpdateDueDate = (id: string, dueDate: string) => {
    updateItem(id, { dueDate: dueDate || undefined });
  };

  const handleUpdateDueTime = (id: string, dueTime: string) => {
    updateItem(id, { dueTime: dueTime || undefined });

    // שעה היא מה שהופך תאריך יעד לתזכורת אמיתית, ולכן זו הנקודה לבקש
    // הרשאה. תאריך לבדו נשאר ויזואלי ולא מצדיק בקשה.
    if (dueTime) {
      void ensureEnabled();
    }
  };

  /** ניקוי התאריך מסיר גם את השעה - שעה בלי תאריך היא חסרת משמעות */
  const handleClearDue = (id: string) => {
    updateItem(id, { dueDate: undefined, dueTime: undefined });
  };

  const handleDeleteItem = (id: string) => {
    commit(items.filter((item) => item.id !== id));
  };

  const completedCount = items.filter((item) => item.completed).length;
  const totalCount = items.length;
  const completedPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* התקדמות */}
      {totalCount > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">התקדמות:</span>
            <span className="text-sm font-bold text-blue-600 dark:text-blue-300">
              {completedCount} / {totalCount} ({Math.round(completedPercent)}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${completedPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* רשימת משימות */}
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-center p-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg">
            אין משימות עדיין
          </div>
        ) : (
          items.map((item) => {
            const dateStatus = getDateStatus(item.dueDate, item.dueTime);
            const dueLabel = formatDueLabel(item.dueDate, item.dueTime);

            const borderColor = item.completed
              ? 'border-green-200 dark:border-green-800'
              : dateStatus
              ? DATE_STATUS_BORDER_CLASS[dateStatus]
              : 'border-gray-200 dark:border-gray-600';

            const dateColor = item.dueDate && dateStatus
              ? DATE_STATUS_TEXT_CLASS[dateStatus]
              : 'text-gray-400';

            return (
              <div
                key={item.id}
                className={`flex flex-col gap-2 p-3 rounded-lg border-2 transition-all ${
                  item.completed
                    ? 'bg-green-50 dark:bg-green-900/20 ' + borderColor
                    : 'bg-white dark:bg-gray-700 ' +
                      borderColor +
                      ' hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => handleToggleItem(item.id, item.completed)}
                    className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                      item.completed
                        ? 'bg-green-500 border-green-500 dark:bg-green-600 dark:border-green-600'
                        : 'bg-white dark:bg-gray-600 border-gray-300 dark:border-gray-500 hover:border-green-400 dark:hover:border-green-500'
                    }`}
                  >
                    {item.completed && <span className="text-white text-sm">✓</span>}
                  </button>

                  {/* טקסט המשימה */}
                  <div className="flex-1">
                    {readOnly ? (
                      <span
                        className={
                          item.completed
                            ? 'line-through text-gray-500 dark:text-gray-400'
                            : 'text-gray-700 dark:text-gray-200'
                        }
                      >
                        {item.text}
                      </span>
                    ) : (
                      <input
                        ref={(el) => {
                          inputRefs.current[item.id] = el;
                        }}
                        type="text"
                        value={item.text}
                        onChange={(e) => handleUpdateText(item.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddItem();
                          }
                        }}
                        placeholder="הזן משימה..."
                        className={`w-full px-2 py-1 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-300 rounded ${
                          item.completed
                            ? 'line-through text-gray-500 dark:text-gray-400'
                            : 'text-gray-700 dark:text-gray-200'
                        }`}
                      />
                    )}
                  </div>

                  {/* תאריך */}
                  {readOnly
                    ? item.dueDate && (
                        <span className={`flex-shrink-0 text-sm ${dateColor}`} title={dueLabel}>
                          📅
                        </span>
                      )
                    : (
                      <DuePicker
                        inputId={`date-${item.id}`}
                        type="date"
                        value={item.dueDate || ''}
                        icon="📅"
                        colorClass={dateColor}
                        title={dueLabel}
                        onChange={(next) => handleUpdateDueDate(item.id, next)}
                        onClear={() => handleClearDue(item.id)}
                      />
                    )}

                  {/* שעה - רלוונטית רק כשיש תאריך, והיא זו שמפעילה תזכורת */}
                  {!readOnly && item.dueDate && (
                    <DuePicker
                      inputId={`time-${item.id}`}
                      type="time"
                      value={item.dueTime || ''}
                      icon="🕐"
                      colorClass={item.dueTime ? 'text-blue-600' : 'text-gray-400'}
                      title={item.dueTime ? `שעה: ${item.dueTime}` : 'הוסף שעה'}
                      onChange={(next) => handleUpdateDueTime(item.id, next)}
                      onClear={() => handleUpdateDueTime(item.id, '')}
                    />
                  )}

                  {/* כפתור מחיקה */}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      className="flex-shrink-0 text-red-600 hover:text-red-800 text-lg"
                      title="מחק משימה"
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* משוב על הרשאת התראות - מוצג רק כשמשהו חוסם תזכורת */}
      {!readOnly && notificationWarning && (
        <p className="text-xs text-amber-700 dark:text-amber-400">⚠️ {notificationWarning}</p>
      )}

      {/* כפתור הוספת משימה */}
      {!readOnly && (
        <Button type="button" onClick={handleAddItem} size="sm" variant="outline" className="w-full">
          + הוסף משימה
        </Button>
      )}
    </div>
  );
};
