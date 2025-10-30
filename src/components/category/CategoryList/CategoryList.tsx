/**
 * CategoryList Component
 * Displays vertical scrolling list of categories
 */

import React, { useState } from 'react';
import { useCategories } from '@/hooks/useCategories';
import { CategoryItem } from '../CategoryItem/CategoryItem';
import { CategoryForm } from '../CategoryForm/CategoryForm';

export const CategoryList: React.FC = () => {
  const { categories, isLoading } = useCategories();
  const [showForm, setShowForm] = useState(false);

  if (isLoading && categories.length === 0) {
    return (
      <div className="flex items-center justify-center p-4 sm:p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-center p-4 sm:p-8 text-gray-500">
        <p className="mb-4 text-sm sm:text-base">עדיין אין קטגוריות</p>
        <button
          onClick={() => setShowForm(true)}
          className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          צור קטגוריה ראשונה
        </button>

        {showForm && (
          <CategoryForm onClose={() => setShowForm(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 sm:space-y-3">
      {categories.map((category) => (
        <CategoryItem
          key={category.id}
          category={category}
        />
      ))}
    </div>
  );
};
