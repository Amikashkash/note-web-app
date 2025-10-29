/**
 * CategoryList Component
 * Displays vertical scrolling list of categories
 */

import React, { useState } from 'react';
import { useCategories } from '@/hooks/useCategories';
import { CategoryItem } from '../CategoryItem/CategoryItem';
import { CategoryForm } from '../CategoryForm/CategoryForm';
import type { Category } from '@/types';

export const CategoryList: React.FC = () => {
  const { categories, isLoading, removeCategory } = useCategories();
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setShowForm(true);
  };

  const handleDelete = async (categoryId: string) => {
    if (confirm('האם אתה בטוח שברצונך למחוק קטגוריה זו?')) {
      try {
        await removeCategory(categoryId);
      } catch (error) {
        console.error('Error deleting category:', error);
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingCategory(null);
  };

  if (isLoading && categories.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        <p className="mb-4">עדיין אין קטגוריות</p>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          צור קטגוריה ראשונה
        </button>

        {showForm && (
          <CategoryForm
            onClose={handleFormClose}
            editCategory={editingCategory}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {categories.map((category) => (
        <CategoryItem
          key={category.id}
          category={category}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ))}

      {showForm && (
        <CategoryForm
          onClose={handleFormClose}
          editCategory={editingCategory}
        />
      )}
    </div>
  );
};
