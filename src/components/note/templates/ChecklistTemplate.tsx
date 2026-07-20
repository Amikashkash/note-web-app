/**
 * תבנית רשימת משימות - To-Do List
 */

import React, { useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/common/Button';
import { useNotificationOptIn } from '@/hooks/useNotificationOptIn';

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
      // Ensure it's an array
      if (!Array.isArray(parsed)) {
        return [];
      }
      // Validate each item has required properties
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

  const handleAddItem = () => {
    const newId = Date.now().toString();
    const newItem: ChecklistItem = {
      id: newId,
      text: '',
      completed: false,
    };
    const updatedItems = [...items, newItem];
    onChange(JSON.stringify(updatedItems));
    pendingFocusIdRef.current = newId;
  };

  const handleToggleItem = (id: string) => {
    const updatedItems = items.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    onChange(JSON.stringify(updatedItems));
  };

  const handleUpdateText = (id: string, text: string) => {
    const updatedItems = items.map((item) =>
      item.id === id ? { ...item, text } : item
    );
    onChange(JSON.stringify(updatedItems));
  };

  const handleUpdateDueDate = (id: string, dueDate: string) => {
    const updatedItems = items.map((item) =>
      item.id === id ? { ...item, dueDate: dueDate || undefined } : item
    );
    onChange(JSON.stringify(updatedItems));
  };

  const handleUpdateDueTime = (id: string, dueTime: string) => {
    const updatedItems = items.map((item) =>
      item.id === id ? { ...item, dueTime: dueTime || undefined } : item
    );
    onChange(JSON.stringify(updatedItems));

    // שעה היא מה שהופך תאריך יעד לתזכורת אמיתית, ולכן זו הנקודה לבקש
    // הרשאה. תאריך לבדו נשאר ויזואלי ולא מצדיק בקשה.
    if (dueTime) {
      void ensureEnabled();
    }
  };

  const handleDeleteItem = (id: string) => {
    const updatedItems = items.filter((item) => item.id !== id);
    onChange(JSON.stringify(updatedItems));
  };

  // פונקציה לקבוע את מצב התאריך (עבר/קרוב/עתידי)
  const getDateStatus = (dueDate?: string): 'overdue' | 'soon' | 'future' | null => {
    if (!dueDate) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue'; // עבר
    if (diffDays <= 1) return 'soon'; // היום או מחר
    return 'future'; // עתידי
  };

  const completedCount = items.filter((item) => item.completed).length;
  const totalCount = items.length;

  return (
    <div className="space-y-3">
      {/* התקדמות */}
      {totalCount > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">התקדמות:</span>
            <span className="text-sm font-bold text-blue-600 dark:text-blue-300">
              {completedCount} / {totalCount} ({Math.round((completedCount / totalCount) * 100)}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
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
            const dateStatus = getDateStatus(item.dueDate);
            const borderColor = !item.completed && dateStatus === 'overdue'
              ? 'border-red-300 dark:border-red-700'
              : !item.completed && dateStatus === 'soon'
              ? 'border-yellow-300 dark:border-yellow-700'
              : item.completed
              ? 'border-green-200 dark:border-green-800'
              : 'border-gray-200 dark:border-gray-600';

            return (
              <div
                key={item.id}
                className={`flex flex-col gap-2 p-3 rounded-lg border-2 transition-all ${
                  item.completed
                    ? 'bg-green-50 dark:bg-green-900/20 ' + borderColor
                    : 'bg-white dark:bg-gray-700 ' + borderColor + ' hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => handleToggleItem(item.id)}
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
                        className={`${
                          item.completed ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-200'
                        }`}
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
                          item.completed ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-200'
                        }`}
                      />
                    )}
                  </div>

                  {/* תאריך */}
                  {readOnly ? (
                    item.dueDate && (
                      <span
                        className={`flex-shrink-0 text-sm ${
                          dateStatus === 'overdue'
                            ? 'text-red-600'
                            : dateStatus === 'soon'
                            ? 'text-yellow-600'
                            : 'text-blue-600'
                        }`}
                        title={`יעד: ${new Date(item.dueDate).toLocaleDateString('he-IL')}${item.dueTime ? ` ${item.dueTime}` : ''}`}
                      >
                        📅
                      </span>
                    )
                  ) : (
                    <div className="relative flex-shrink-0 flex items-center gap-1">
                      <input
                        id={`date-${item.id}`}
                        type="date"
                        value={item.dueDate || ''}
                        onChange={(e) => handleUpdateDueDate(item.id, e.target.value)}
                        className="absolute left-0 top-0 w-8 h-8 opacity-0 cursor-pointer"
                        style={{ zIndex: 10 }}
                      />
                      <label
                        htmlFor={`date-${item.id}`}
                        className={`cursor-pointer text-lg pointer-events-none ${
                          item.dueDate
                            ? dateStatus === 'overdue'
                              ? 'text-red-600'
                              : dateStatus === 'soon'
                              ? 'text-yellow-600'
                              : 'text-blue-600'
                            : 'text-gray-400'
                        }`}
                        title={item.dueDate ? `יעד: ${new Date(item.dueDate).toLocaleDateString('he-IL')}${item.dueTime ? ` ${item.dueTime}` : ''}` : 'הוסף תאריך יעד'}
                      >
                        📅
                      </label>
                      {item.dueDate && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateDueDate(item.id, '');
                            handleUpdateDueTime(item.id, '');
                          }}
                          className="text-xs text-gray-400 hover:text-red-600 relative z-20"
                          title="הסר תאריך"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}

                  {/* שעה (מוצג רק אם יש תאריך ובמצב עריכה) */}
                  {!readOnly && item.dueDate && (
                    <div className="relative flex-shrink-0 flex items-center gap-1">
                      <input
                        id={`time-${item.id}`}
                        type="time"
                        value={item.dueTime || ''}
                        onChange={(e) => handleUpdateDueTime(item.id, e.target.value)}
                        className="absolute left-0 top-0 w-8 h-8 opacity-0 cursor-pointer"
                        style={{ zIndex: 10 }}
                      />
                      <label
                        htmlFor={`time-${item.id}`}
                        className={`cursor-pointer text-lg pointer-events-none ${
                          item.dueTime ? 'text-blue-600' : 'text-gray-400'
                        }`}
                        title={item.dueTime ? `שעה: ${item.dueTime}` : 'הוסף שעה'}
                      >
                        🕐
                      </label>
                      {item.dueTime && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateDueTime(item.id, '');
                          }}
                          className="text-xs text-gray-400 hover:text-red-600 relative z-20"
                          title="הסר שעה"
                        >
                          ✕
                        </button>
                      )}
                    </div>
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
