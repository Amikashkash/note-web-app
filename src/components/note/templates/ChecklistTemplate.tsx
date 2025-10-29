/**
 * תבנית רשימת משימות - To-Do List
 */

import React, { useMemo } from 'react';
import { Button } from '@/components/common/Button';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
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
      return value ? JSON.parse(value) : [];
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

  const handleDeleteItem = (id: string) => {
    const updatedItems = items.filter((item) => item.id !== id);
    onChange(JSON.stringify(updatedItems));
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
          items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                item.completed
                  ? 'bg-green-50 border-green-200'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Checkbox */}
              <button
                type="button"
                onClick={() => handleToggleItem(item.id)}
                className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                  item.completed
                    ? 'bg-green-500 border-green-500'
                    : 'bg-white border-gray-300 hover:border-green-400'
                }`}
                disabled={readOnly}
              >
                {item.completed && <span className="text-white text-sm">✓</span>}
              </button>

              {/* טקסט המשימה */}
              {readOnly ? (
                <span
                  className={`flex-1 ${
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
                  placeholder="הזן משימה..."
                  className={`flex-1 px-2 py-1 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-300 rounded ${
                    item.completed ? 'line-through text-gray-500' : 'text-gray-700'
                  }`}
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
          ))
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
