/**
 * CategoryForm Component
 * Form for creating/editing categories
 */

import React, { useState, useEffect } from 'react';
import { Lock, PenOff } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useCategories } from '@/hooks/useCategories';
import { Modal } from '@/components/common/Modal/Modal';
import { Input } from '@/components/common/Input/Input';
import { Button } from '@/components/common/Button/Button';
import { getErrorMessage } from '@/utils/errors';
import { AVAILABLE_COLORS } from '@/utils/constants';
import type { Category } from '@/types';

interface CategoryFormProps {
  onClose: () => void;
  editCategory?: Category | null;
}

export const CategoryForm: React.FC<CategoryFormProps> = ({ onClose, editCategory }) => {
  const { addCategory, editCategory: updateCategory } = useCategories();
  const currentUid = useAuthStore((state) => state.user?.uid);

  // רק הבעלים מסמן רגישה או קריאה בלבד (ה-rules דוחים את זה משותף).
  // קטגוריה חדשה - מי שיוצר אותה הוא הבעלים.
  const canSetFlags = !editCategory || editCategory.userId === currentUid;
  const [isSensitive, setIsSensitive] = useState(editCategory?.isSensitive ?? false);
  const [isReadOnly, setIsReadOnly] = useState(editCategory?.isReadOnly ?? false);

  const [name, setName] = useState(editCategory?.name || '');
  const [color, setColor] = useState(editCategory?.color || AVAILABLE_COLORS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editCategory) {
      setName(editCategory.name);
      setColor(editCategory.color);
      setIsSensitive(editCategory.isSensitive);
      setIsReadOnly(editCategory.isReadOnly);
    }
  }, [editCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('שם הקטגוריה לא יכול להיות ריק');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (editCategory) {
        // Update existing category
        // דגל נשלח רק כשהשתנה - כך שותף שעורך שם או צבע לא נוגע בו
        const changed = (current: boolean, stored: boolean) =>
          canSetFlags && current !== stored ? current : undefined;
        await updateCategory(editCategory.id, name, color, undefined, {
          isSensitive: changed(isSensitive, editCategory.isSensitive),
          isReadOnly: changed(isReadOnly, editCategory.isReadOnly),
        });
      } else {
        // Create new category
        await addCategory(name, color, { isSensitive, isReadOnly });
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={editCategory ? 'ערוך קטגוריה' : 'קטגוריה חדשה'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name Input */}
        <Input
          label="שם הקטגוריה"
          type="text"
          placeholder="לדוגמה: עבודה, אישי, רעיונות..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
          disabled={isLoading}
          autoFocus
        />

        {/* Color Picker */}
        <div>
          <label className="block text-sm font-medium text-ink-light dark:text-ink-dark mb-2">
            בחר צבע
          </label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_COLORS.map((colorOption) => (
              <button
                key={colorOption}
                type="button"
                onClick={() => setColor(colorOption)}
                className={`w-10 h-10 rounded-full border-2 transition-all ${
                  color === colorOption
                    ? 'border-ink-light dark:border-ink-dark scale-110'
                    : 'border-hairline-light dark:border-hairline-dark hover:scale-105'
                }`}
                style={{ backgroundColor: colorOption }}
                title={colorOption}
              />
            ))}
          </div>
        </div>

        {/* רגישה (C6) */}
        {canSetFlags && (
          <label className="flex items-start gap-3 p-3 rounded-lg bg-raised-light dark:bg-raised-dark cursor-pointer">
            <input
              type="checkbox"
              checked={isSensitive}
              onChange={(e) => setIsSensitive(e.target.checked)}
              disabled={isLoading}
              className="mt-1 h-4 w-4 accent-brand"
            />
            <span className="text-body-sm text-ink-light dark:text-ink-dark">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Lock size={14} strokeWidth={2} />
                רגישה - מוסתרת מ-Claude
              </span>
              <span className="block text-caption text-ink-3-light dark:text-ink-3-dark mt-1">
                Claude לא יראה את הקטגוריה ואת כל הפתקים בה, גם כאלה שיתווספו בהמשך. מה שכבר
                נקרא בשיחה קודמת לא נמחק ממנה, וזו לא הצפנה.
              </span>
            </span>
          </label>
        )}

        {/* קריאה בלבד ל-Claude */}
        {canSetFlags && (
          <label className="flex items-start gap-3 p-3 rounded-lg bg-raised-light dark:bg-raised-dark cursor-pointer">
            <input
              type="checkbox"
              checked={isReadOnly}
              onChange={(e) => setIsReadOnly(e.target.checked)}
              disabled={isLoading}
              className="mt-1 h-4 w-4 accent-brand"
            />
            <span className="text-body-sm text-ink-light dark:text-ink-dark">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <PenOff size={14} strokeWidth={2} />
                קריאה בלבד ל-Claude
              </span>
              <span className="block text-caption text-ink-3-light dark:text-ink-3-dark mt-1">
                Claude יכול לקרוא את הקטגוריה והפתקים בה, אבל לא ליצור בה פתקים חדשים. באפליקציה
                הכל נשאר ניתן לעריכה.
              </span>
            </span>
          </label>
        )}

        {/* Buttons */}
        <div className="flex gap-2 pt-4">
          <Button
            type="submit"
            fullWidth
            isLoading={isLoading}
          >
            {editCategory ? 'שמור שינויים' : 'צור קטגוריה'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            ביטול
          </Button>
        </div>
      </form>
    </Modal>
  );
};
