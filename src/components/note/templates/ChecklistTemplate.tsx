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
import { CalendarDays, Clock, Trash2, X, type LucideIcon } from 'lucide-react';
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
  Icon: LucideIcon;
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
  Icon,
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
      className={`cursor-pointer pointer-events-none ${colorClass}`}
      title={title}
    >
      <Icon size={20} strokeWidth={1.75} />
    </label>
    {value && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClear();
        }}
        className="text-ink-3-light dark:text-ink-3-dark hover:text-danger relative z-20"
        title={type === 'date' ? 'הסר תאריך' : 'הסר שעה'}
      >
        <X size={14} strokeWidth={2} />
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
   * רשימת משימות ריקה מקבלת שורה ראשונה אוטומטית.
   *
   * רשימה בלי משימה אחת לפחות היא חסרת משמעות, ולכן הלחיצה על "הוסף
   * משימה" רק כדי להתחיל הייתה מיותרת. בכוונה בלי פוקוס: פתיחת פתק
   * קיים הייתה מקפיצה את המקלדת בנייד בכל פעם.
   */
  useEffect(() => {
    if (readOnly || items.length > 0) return;

    onChange(
      JSON.stringify([{ id: Date.now().toString(), text: '', completed: false }])
    );
  }, [readOnly, items.length, onChange]);

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
        <div className="bg-brand-soft dark:bg-brand-soft-dark p-3 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-ink-light dark:text-ink-dark">התקדמות:</span>
            <span className="text-sm font-bold text-brand-text dark:text-brand-text-dark">
              {completedCount} / {totalCount} ({Math.round(completedPercent)}%)
            </span>
          </div>
          <div className="w-full bg-hairline-light dark:bg-hairline-dark rounded-full h-2">
            <div
              className="bg-brand h-2 rounded-full transition-all duration-300"
              style={{ width: `${completedPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* רשימת משימות */}
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-center p-8 text-ink-3-light dark:text-ink-3-dark bg-raised-light dark:bg-raised-dark rounded-lg">
            אין משימות עדיין
          </div>
        ) : (
          items.map((item) => {
            const dateStatus = getDateStatus(item.dueDate, item.dueTime);
            const dueLabel = formatDueLabel(item.dueDate, item.dueTime);

            const borderColor = item.completed
              ? 'border-success/30'
              : dateStatus
              ? DATE_STATUS_BORDER_CLASS[dateStatus]
              : 'border-hairline-light dark:border-hairline-dark';

            const dateColor = item.dueDate && dateStatus
              ? DATE_STATUS_TEXT_CLASS[dateStatus]
              : 'text-ink-3-light dark:text-ink-3-dark';

            return (
              <div
                key={item.id}
                className={`flex flex-col gap-2 p-3 rounded-lg border-2 transition-all ${
                  item.completed
                    ? 'bg-success/10 ' + borderColor
                    : 'bg-surface-light dark:bg-surface-dark ' +
                      borderColor +
                      ' hover:border-ink-3-light dark:hover:border-ink-3-dark'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => handleToggleItem(item.id, item.completed)}
                    className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                      item.completed
                        ? 'bg-success border-success dark:bg-success-dark dark:border-success-dark'
                        : 'bg-surface-light dark:bg-raised-dark border-hairline-light dark:border-hairline-dark hover:border-success dark:hover:border-success-dark'
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
                            ? 'line-through text-ink-3-light dark:text-ink-3-dark'
                            : 'text-ink-light dark:text-ink-dark'
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
                        className={`w-full px-2 py-1 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-brand/40 rounded ${
                          item.completed
                            ? 'line-through text-ink-3-light dark:text-ink-3-dark'
                            : 'text-ink-light dark:text-ink-dark'
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
                        Icon={CalendarDays}
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
                      Icon={Clock}
                      colorClass={item.dueTime ? 'text-brand-text' : 'text-ink-3-light dark:text-ink-3-dark'}
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
                      className="flex-shrink-0 text-danger dark:text-danger-dark hover:opacity-80 text-lg"
                      title="מחק משימה"
                    >
                      <Trash2 size={18} strokeWidth={1.75} />
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
