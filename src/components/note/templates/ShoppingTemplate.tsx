/**
 * תבנית רשימת קניות - Shopping List
 */

import React, { useMemo } from 'react';
import { Button } from '@/components/common/Button';

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: string;
  checked: boolean;
  category: string;
}

interface ShoppingTemplateProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

const CATEGORIES = ['פירות וירקות', 'מוצרי חלב', 'בשר ודגים', 'לחם ומאפים', 'שימורים', 'משקאות', 'אחר'];

export const ShoppingTemplate: React.FC<ShoppingTemplateProps> = ({
  value,
  onChange,
  readOnly = false,
}) => {
  const items = useMemo<ShoppingItem[]>(() => {
    try {
      return value ? JSON.parse(value) : [];
    } catch {
      return [];
    }
  }, [value]);

  const handleAddItem = () => {
    const newItem: ShoppingItem = {
      id: Date.now().toString(),
      name: '',
      quantity: '',
      checked: false,
      category: 'אחר',
    };
    const updatedItems = [...items, newItem];
    onChange(JSON.stringify(updatedItems));
  };

  const handleToggleItem = (id: string) => {
    const updatedItems = items.map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    onChange(JSON.stringify(updatedItems));
  };

  const handleUpdateItem = (id: string, field: keyof ShoppingItem, newValue: string | boolean) => {
    const updatedItems = items.map((item) =>
      item.id === id ? { ...item, [field]: newValue } : item
    );
    onChange(JSON.stringify(updatedItems));
  };

  const handleDeleteItem = (id: string) => {
    const updatedItems = items.filter((item) => item.id !== id);
    onChange(JSON.stringify(updatedItems));
  };

  const checkedCount = items.filter((item) => item.checked).length;
  const totalCount = items.length;

  // קיבוץ לפי קטגוריות
  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, ShoppingItem[]> = {};
    items.forEach((item) => {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    });
    return grouped;
  }, [items]);

  return (
    <div className="space-y-3">
      {/* התקדמות */}
      {totalCount > 0 && (
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">התקדמות בקניות:</span>
            <span className="text-sm font-bold text-green-600">
              {checkedCount} / {totalCount} ({Math.round((checkedCount / totalCount) * 100)}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(checkedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* רשימת קניות */}
      {items.length === 0 ? (
        <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-lg">
          אין פריטים ברשימה
        </div>
      ) : readOnly ? (
        /* תצוגת קריאה - מקובץ לפי קטגוריות */
        <div className="space-y-4">
          {Object.entries(itemsByCategory).map(([category, categoryItems]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">
                {category}
              </h4>
              <div className="space-y-2">
                {categoryItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded ${
                      item.checked ? 'bg-green-50' : 'bg-gray-50'
                    }`}
                  >
                    <span className={`flex-1 ${item.checked ? 'line-through text-gray-500' : ''}`}>
                      {item.name}
                    </span>
                    {item.quantity && (
                      <span className="text-sm text-gray-600">({item.quantity})</span>
                    )}
                    {item.checked && <span className="text-green-600">✓</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* תצוגת עריכה */
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all ${
                item.checked
                  ? 'bg-green-50 border-green-200'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Checkbox */}
              <button
                type="button"
                onClick={() => handleToggleItem(item.id)}
                className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                  item.checked
                    ? 'bg-green-500 border-green-500'
                    : 'bg-white border-gray-300 hover:border-green-400'
                }`}
              >
                {item.checked && <span className="text-white text-sm">✓</span>}
              </button>

              {/* שם הפריט */}
              <input
                type="text"
                value={item.name}
                onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                placeholder="פריט..."
                className={`flex-1 px-2 py-1 text-sm bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-300 rounded ${
                  item.checked ? 'line-through text-gray-500' : 'text-gray-700'
                }`}
              />

              {/* כמות */}
              <input
                type="text"
                value={item.quantity}
                onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value)}
                placeholder="כמות"
                className="w-20 px-2 py-1 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-300"
              />

              {/* קטגוריה */}
              <select
                value={item.category}
                onChange={(e) => handleUpdateItem(item.id, 'category', e.target.value)}
                className="px-2 py-1 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-300"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* מחיקה */}
              <button
                type="button"
                onClick={() => handleDeleteItem(item.id)}
                className="flex-shrink-0 text-red-600 hover:text-red-800 text-lg"
                title="מחק פריט"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}

      {/* כפתור הוספת פריט */}
      {!readOnly && (
        <Button type="button" onClick={handleAddItem} size="sm" variant="outline" className="w-full">
          🛒 הוסף פריט
        </Button>
      )}
    </div>
  );
};
