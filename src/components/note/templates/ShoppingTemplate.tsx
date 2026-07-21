/**
 * תבנית רשימת קניות - Shopping List
 *
 * ההוספה נעשית משדה אחד בראש הרשימה: מקלידים, לוחצים Enter, והשדה
 * מתנקה ומוכן לבא. הזרימה הקודמת - ללחוץ "הוסף פריט", לקבל שורה ריקה
 * ואז להקליד - עלתה פעולה מיותרת לכל מוצר.
 *
 * המוצרים נזכרים בין רשימות (`useProductSuggestions`) ומוצעים תוך כדי
 * הקלדה. הקטגוריה שהייתה כאן הוסרה: היא דרשה בחירה ידנית בתפריט לכל
 * מוצר ושורה שלמה נוספת, בתמורה לקיבוץ שהופיע רק בתצוגת קריאה.
 */

import React, { useMemo, useRef, useState } from 'react';
import { useProductSuggestions } from '@/hooks/useProductSuggestions';
import { normalizeProductName } from '@/services/api/productMatching';

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: string;
  checked: boolean;
}

interface ShoppingTemplateProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export const ShoppingTemplate: React.FC<ShoppingTemplateProps> = ({
  value,
  onChange,
  readOnly = false,
}) => {
  const [draft, setDraft] = useState('');
  const [quantityDraft, setQuantityDraft] = useState('');
  /** משוב קצר על הוספה שלא יצרה שורה חדשה */
  const [notice, setNotice] = useState<string | null>(null);
  const quickAddRef = useRef<HTMLInputElement | null>(null);

  const items = useMemo<ShoppingItem[]>(() => {
    try {
      const parsed = value ? JSON.parse(value) : [];
      if (!Array.isArray(parsed)) return [];

      // מזהה הנגזר מהמיקום ברשימה - יציב בין פענוחים של אותו תוכן,
      // בניגוד ל-Date.now() שהופך את הפענוח ללא-דטרמיניסטי.
      // שדה `category` של רשימות ישנות פשוט לא נקרא.
      return parsed.map((item, index) => ({
        id: item.id || `item-${index}`,
        name: item.name || '',
        quantity: item.quantity || '',
        checked: item.checked || false,
      }));
    } catch {
      return [];
    }
  }, [value]);

  const existingNames = useMemo(() => items.map((item) => item.name), [items]);
  const { suggestions, remember } = useProductSuggestions(draft, existingNames);

  const commit = (updated: ShoppingItem[]) => onChange(JSON.stringify(updated));

  /** קריאה אחת לאירוע, כדי ששני עדכונים לא יתבססו על מצב שהתיישן */
  const updateItem = (id: string, patch: Partial<ShoppingItem>) => {
    commit(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  /**
   * הוספת מוצר, או עדכון כמות אם הוא כבר ברשימה.
   *
   * הוספה כפולה של אותו מוצר כמעט תמיד טעות - בסופר רוצים שורה אחת עם
   * כמות, לא שתי שורות זהות. לכן מוצר קיים לא משוכפל: אם צוינה כמות היא
   * מעדכנת את השורה הקיימת, ובכל מקרה מוצגת הודעה קצרה כדי שההוספה
   * שלא קרתה לא תיראה כמו תקלה.
   */
  const addItem = (name: string, itemQuantity: string = quantityDraft) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const normalized = normalizeProductName(trimmed);
    const existing = items.find((item) => normalizeProductName(item.name) === normalized);
    const trimmedQuantity = itemQuantity.trim();

    if (existing) {
      if (trimmedQuantity) {
        updateItem(existing.id, { quantity: trimmedQuantity });
        setNotice(`${existing.name} — הכמות עודכנה`);
      } else {
        setNotice(`${existing.name} כבר ברשימה`);
      }
    } else {
      commit([
        ...items,
        {
          id: Date.now().toString(),
          name: trimmed,
          quantity: trimmedQuantity,
          checked: false,
        },
      ]);
      remember(trimmed);
      setNotice(null);
    }

    setDraft('');
    setQuantityDraft('');

    // החזרת הפוקוס לשדה המוצר משאירה את המקלדת פתוחה ומאפשרת להמשיך
    // ישר למוצר הבא, בלי לסגור אותה ובלי לגלול לרשימה.
    quickAddRef.current?.focus();
  };

  const handleDeleteItem = (id: string) => {
    commit(items.filter((item) => item.id !== id));
  };

  const checkedCount = items.filter((item) => item.checked).length;
  const totalCount = items.length;
  const checkedPercent = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* התקדמות */}
      {totalCount > 0 && (
        <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              התקדמות בקניות:
            </span>
            <span className="text-sm font-bold text-green-600 dark:text-green-300">
              {checkedCount} / {totalCount} ({Math.round(checkedPercent)}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${checkedPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* הוספה מהירה */}
      {!readOnly && (
        <div className="space-y-2 bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">
          {/* מוצר וכמות באותה שורה: הכמות הייתה מחייבת לסגור את המקלדת,
              לגלול לשורה שנוספה, למלא אותה, ולחזור למעלה. */}
          <div className="flex items-center gap-2">
            <input
              ref={quickAddRef}
              type="text"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setNotice(null);
              }}
              // מבקש מקלדת עם מקש "סיום" במקום חץ מעבר-לשדה-הבא
              enterKeyHint="done"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  // מוסיף את מה שהוקלד ולא את ההצעה הראשונה: בחירת הצעה
                  // היא הקשה מפורשת עליה, אחרת Enter היה מוסיף לפעמים
                  // מוצר שלא התכוונת אליו.
                  addItem(draft);
                } else if (e.key === 'Escape') {
                  setDraft('');
                }
              }}
              placeholder="🛒 מוצר..."
              className="flex-1 min-w-0 px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-400"
            />

            <input
              type="text"
              value={quantityDraft}
              onChange={(e) => setQuantityDraft(e.target.value)}
              enterKeyHint="done"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addItem(draft);
                }
              }}
              placeholder="כמות"
              className="w-16 flex-shrink-0 px-2 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-400"
            />

            {/* גיבוי ל-Enter, שלא כל מקלדת בנייד משדרת כאירוע מקש */}
            <button
              type="button"
              onClick={() => addItem(draft)}
              disabled={draft.trim().length === 0}
              className="flex-shrink-0 px-3 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:text-gray-500 dark:disabled:text-gray-400"
              title="הוסף מוצר"
            >
              הוסף
            </button>
          </div>

          {/* ההצעות בזרימה רגילה ולא כשכבה צפה: שכבה מוחלטת נחתכה בתוך
              חלון הפתק הגלילי, ובנייד לא הייתה נגישה כלל. */}
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((product) => (
                <button
                  key={product.name}
                  type="button"
                  onClick={() => addItem(product.name)}
                  className="px-3 py-1.5 text-sm rounded-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-gray-600"
                >
                  {product.name}
                </button>
              ))}
            </div>
          )}

          {notice && (
            <p className="text-xs text-amber-700 dark:text-amber-400">{notice}</p>
          )}
        </div>
      )}

      {/* הרשימה */}
      {items.length === 0 ? (
        <div className="text-center p-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg">
          אין פריטים ברשימה
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                item.checked
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <button
                type="button"
                onClick={() => updateItem(item.id, { checked: !item.checked })}
                className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                  item.checked
                    ? 'bg-green-500 border-green-500 dark:bg-green-600 dark:border-green-600'
                    : 'bg-white dark:bg-gray-600 border-gray-300 dark:border-gray-500 hover:border-green-400'
                }`}
              >
                {item.checked && <span className="text-white text-sm">✓</span>}
              </button>

              {readOnly ? (
                <span
                  className={`flex-1 text-sm ${
                    item.checked
                      ? 'line-through text-gray-500 dark:text-gray-400'
                      : 'text-gray-700 dark:text-gray-200'
                  }`}
                >
                  {item.name}
                </span>
              ) : (
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(item.id, { name: e.target.value })}
                  placeholder="פריט..."
                  className={`flex-1 min-w-0 px-2 py-1 text-sm bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-green-300 rounded ${
                    item.checked
                      ? 'line-through text-gray-500 dark:text-gray-400'
                      : 'text-gray-700 dark:text-gray-200'
                  }`}
                />
              )}

              {readOnly ? (
                item.quantity && (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    ({item.quantity})
                  </span>
                )
              ) : (
                <input
                  type="text"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, { quantity: e.target.value })}
                  placeholder="כמות"
                  className="w-16 sm:w-20 flex-shrink-0 px-2 py-1 text-xs sm:text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-green-300"
                />
              )}

              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  className="flex-shrink-0 text-red-600 hover:text-red-800 text-lg"
                  title="מחק פריט"
                >
                  🗑
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
