/**
 * תבנית רשימת משימות - To-Do List
 */

import React, { useMemo } from 'react';
import { Button } from '@/components/common/Button';

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
  const items = useMemo<ChecklistItem[]>(() => {
    try {
      const parsed = value ? JSON.parse(value) : [];
      // Ensure it's an array
      if (!Array.isArray(parsed)) {
        return [];
      }
      // Validate each item has required properties
      return parsed.map((item, index) => ({
        id: item.id || `item-${Date.now()}-${index}`,
        text: item.text || '',
        completed: item.completed || false,
        dueDate: item.dueDate,
        dueTime: item.dueTime,
      }));
    } catch {
      return [];
    }
  }, [value]);

  const handleAddItem = () => {
    const newItem: ChecklistItem = {
      id: Date.now().toString(),
      text: '',
      completed: false,
    };
    const updatedItems = [...items, newItem];
    onChange(JSON.stringify(updatedItems));
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
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">התקדמות:</span>
            <span className="text-sm font-bold text-blue-600">
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
          <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-lg">
            אין משימות עדיין
          </div>
        ) : (
          items.map((item) => {
            const dateStatus = getDateStatus(item.dueDate);
            const borderColor = !item.completed && dateStatus === 'overdue'
              ? 'border-red-300'
              : !item.completed && dateStatus === 'soon'
              ? 'border-yellow-300'
              : item.completed
              ? 'border-green-200'
              : 'border-gray-200';

            return (
              <div
                key={item.id}
                className={`flex flex-col gap-2 p-3 rounded-lg border-2 transition-all ${
                  item.completed
                    ? 'bg-green-50 ' + borderColor
                    : 'bg-white ' + borderColor + ' hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => handleToggleItem(item.id)}
                    className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                      item.completed
                        ? 'bg-green-500 border-green-500'
                        : 'bg-white border-gray-300 hover:border-green-400'
                    }`}
                  >
                    {item.completed && <span className="text-white text-sm">✓</span>}
                  </button>

                  {/* טקסט המשימה */}
                  <div className="flex-1">
                    {readOnly ? (
                      <span
                        className={`${
                          item.completed ? 'line-through text-gray-500' : 'text-gray-700'
                        }`}
                      >
                        {item.text}
                      </span>
                    ) : (
                      <input
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
                          item.completed ? 'line-through text-gray-500' : 'text-gray-700'
                        }`}
                      />
                    )}
                  </div>

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

                {/* תאריך יעד */}
                <div className="flex items-center gap-2 mr-9">
                  {readOnly ? (
                    item.dueDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <span
                          className={`px-2 py-0.5 rounded-full ${
                            dateStatus === 'overdue'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
                              : dateStatus === 'soon'
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                          }`}
                        >
                          {dateStatus === 'overdue' && '🔴 '}
                          {dateStatus === 'soon' && '🟡 '}
                          {dateStatus === 'future' && '📅 '}
                          {new Date(item.dueDate).toLocaleDateString('he-IL', {
                            day: 'numeric',
                            month: 'short',
                          })}
                          {item.dueTime && ` • ${item.dueTime}`}
                        </span>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600">תאריך:</label>
                        <input
                          type="date"
                          value={item.dueDate || ''}
                          onChange={(e) => handleUpdateDueDate(item.id, e.target.value)}
                          className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-300"
                        />
                        {item.dueDate && (
                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateDueDate(item.id, '');
                              handleUpdateDueTime(item.id, '');
                            }}
                            className="text-xs text-gray-500 hover:text-red-600"
                            title="הסר תאריך"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      {item.dueDate && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-600">שעה:</label>
                          <input
                            type="time"
                            value={item.dueTime || ''}
                            onChange={(e) => handleUpdateDueTime(item.id, e.target.value)}
                            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-300"
                          />
                          {item.dueTime && (
                            <button
                              type="button"
                              onClick={() => handleUpdateDueTime(item.id, '')}
                              className="text-xs text-gray-500 hover:text-red-600"
                              title="הסר שעה"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* כפתור הוספת משימה */}
      {!readOnly && (
        <Button type="button" onClick={handleAddItem} size="sm" variant="outline" className="w-full">
          + הוסף משימה
        </Button>
      )}
    </div>
  );
};
