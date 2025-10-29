/**
 * CategoryForm Component
 * Form for creating/editing categories
 */

import React, { useState, useEffect } from 'react';
import { useCategories } from '@/hooks/useCategories';
import { Modal } from '@/components/common/Modal/Modal';
import { Input } from '@/components/common/Input/Input';
import { Button } from '@/components/common/Button/Button';
import { AVAILABLE_COLORS } from '@/utils/constants';
import type { Category } from '@/types';

interface CategoryFormProps {
  onClose: () => void;
  editCategory?: Category | null;
}

export const CategoryForm: React.FC<CategoryFormProps> = ({ onClose, editCategory }) => {
  const { addCategory, editCategory: updateCategory } = useCategories();

  const [name, setName] = useState(editCategory?.name || '');
  const [color, setColor] = useState(editCategory?.color || AVAILABLE_COLORS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editCategory) {
      setName(editCategory.name);
      setColor(editCategory.color);
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
        await updateCategory(editCategory.id, name, color);
      } else {
        // Create new category
        await addCategory(name, color);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'שגיאה בשמירת הקטגוריה');
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    ? 'border-gray-800 scale-110'
                    : 'border-gray-300 hover:scale-105'
                }`}
                style={{ backgroundColor: colorOption }}
                title={colorOption}
              />
            ))}
          </div>
        </div>

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
