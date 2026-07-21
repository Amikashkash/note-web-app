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
import { Trash2 } from 'lucide-react';
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
  const quantityRef = useRef<HTMLInputElement | null>(null);

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
        <div className="bg-teal/10 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-ink-light dark:text-ink-dark">
              התקדמות בקניות:
            </span>
            <span className="text-sm font-bold text-teal dark:text-teal-dark">
              {checkedCount} / {totalCount} ({Math.round(checkedPercent)}%)
            </span>
          </div>
          <div className="w-full bg-hairline-light dark:bg-hairline-dark rounded-full h-2">
            <div
              className="bg-teal-fill h-2 rounded-full transition-all duration-300"
              style={{ width: `${checkedPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* הוספה מהירה */}
      {!readOnly && (
        <div className="space-y-2 bg-raised-light dark:bg-raised-dark p-2 rounded-lg">
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
              // "הבא" ולא "סיום": כאן Enter מעביר לכמות ולא מוסיף.
              // המקלדת מציגה חץ מעבר, וזו בדיוק הפעולה הנכונה.
              enterKeyHint="next"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  // מעבר לכמות, לא הוספה: המקצב הוא מוצר ← כמות ← הוספה,
                  // ואותו Enter עושה את אותו דבר בכל שלב.
                  if (draft.trim()) quantityRef.current?.focus();
                } else if (e.key === 'Escape') {
                  setDraft('');
                }
              }}
              placeholder="🛒 מוצר..."
              className="flex-1 min-w-0 px-3 py-2 text-sm bg-surface-light dark:bg-surface-dark border border-hairline-light dark:border-hairline-dark rounded-md text-ink-light dark:text-ink-dark focus:outline-none focus:ring-2 focus:ring-brand/40"
            />

            <input
              ref={quantityRef}
              type="text"
              value={quantityDraft}
              onChange={(e) => setQuantityDraft(e.target.value)}
              // סוף המקצב - כאן Enter מוסיף, ו-`addItem` מחזיר את הפוקוס
              // לשדה המוצר כך שאפשר להמשיך ישר לבא.
              enterKeyHint="done"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addItem(draft);
                } else if (e.key === 'Escape') {
                  quickAddRef.current?.focus();
                }
              }}
              placeholder="כמות"
              className="w-16 flex-shrink-0 px-2 py-2 text-sm bg-surface-light dark:bg-surface-dark border border-hairline-light dark:border-hairline-dark rounded-md text-ink-light dark:text-ink-dark focus:outline-none focus:ring-2 focus:ring-brand/40"
            />

            {/* גיבוי ל-Enter, שלא כל מקלדת בנייד משדרת כאירוע מקש */}
            <button
              type="button"
              onClick={() => addItem(draft)}
              disabled={draft.trim().length === 0}
              className="flex-shrink-0 px-3 py-2 text-sm font-medium rounded-md bg-teal-fill text-white hover:opacity-90 disabled:bg-hairline-light dark:disabled:bg-hairline-dark disabled:text-ink-3-light dark:disabled:text-ink-3-dark"
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
                  onClick={() => {
                    // משלים את שם המוצר ועובר לכמות, ולא מוסיף מיד.
                    // כך בחירה מההצעות נכנסת לאותו מקצב כמו הקלדה, ואפשר
                    // לתת כמות למוצר מוצע - קודם זה היה מחייב להקליד את
                    // הכמות לפני הבחירה.
                    setDraft(product.name);
                    setNotice(null);
                    quantityRef.current?.focus();
                  }}
                  className="px-3 py-1.5 text-sm rounded-full bg-surface-light dark:bg-surface-dark border border-hairline-light dark:border-hairline-dark text-ink-light dark:text-ink-dark hover:bg-teal/10 dark:hover:bg-raised-dark"
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
        <div className="text-center p-8 text-ink-3-light dark:text-ink-3-dark bg-raised-light dark:bg-raised-dark rounded-lg">
          אין פריטים ברשימה
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                item.checked
                  ? 'bg-success/10 border-success/30'
                  : 'bg-surface-light dark:bg-surface-dark border-hairline-light dark:border-hairline-dark hover:border-ink-3-light dark:hover:border-ink-3-dark'
              }`}
            >
              <button
                type="button"
                onClick={() => updateItem(item.id, { checked: !item.checked })}
                className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                  item.checked
                    ? 'bg-success border-success dark:bg-success-dark dark:border-success-dark'
                    : 'bg-surface-light dark:bg-raised-dark border-hairline-light dark:border-hairline-dark hover:border-success'
                }`}
              >
                {item.checked && <span className="text-white text-sm">✓</span>}
              </button>

              {readOnly ? (
                <span
                  className={`flex-1 text-sm ${
                    item.checked
                      ? 'line-through text-ink-3-light dark:text-ink-3-dark'
                      : 'text-ink-light dark:text-ink-dark'
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
                  className={`flex-1 min-w-0 px-2 py-1 text-sm bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-brand/40 rounded ${
                    item.checked
                      ? 'line-through text-ink-3-light dark:text-ink-3-dark'
                      : 'text-ink-light dark:text-ink-dark'
                  }`}
                />
              )}

              {readOnly ? (
                item.quantity && (
                  <span className="text-sm text-ink-2-light dark:text-ink-2-dark">
                    ({item.quantity})
                  </span>
                )
              ) : (
                <input
                  type="text"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, { quantity: e.target.value })}
                  placeholder="כמות"
                  className="w-16 sm:w-20 flex-shrink-0 px-2 py-1 text-xs sm:text-sm bg-surface-light dark:bg-raised-dark border border-hairline-light dark:border-hairline-dark rounded text-ink-light dark:text-ink-dark focus:outline-none focus:ring-1 focus:ring-brand/40"
                />
              )}

              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  className="flex-shrink-0 text-danger dark:text-danger-dark hover:opacity-80 text-lg"
                  title="מחק פריט"
                >
                  <Trash2 size={18} strokeWidth={1.75} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
