/**
 * דף ניהול קטגוריות - עריכה ומחיקה של קטגוריות
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategories } from '@/hooks/useCategories';
import { useNotes } from '@/hooks/useNotes';
import { CategoryForm } from '@/components/category/CategoryForm/CategoryForm';
import { Button } from '@/components/common';
import type { Category } from '@/types';

export const CategoriesManagement: React.FC = () => {
  const navigate = useNavigate();
  const { categories, isLoading, removeCategory } = useCategories();
  const { allNotes } = useNotes();
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setShowForm(true);
  };

  const handleDelete = async (categoryId: string) => {
    // בדיקת כמות פתקים בקטגוריה
    const categoryNotes = allNotes.filter(note => note.categoryId === categoryId);

    if (categoryNotes.length > 0) {
      alert(`לא ניתן למחוק קטגוריה זו כי יש בה ${categoryNotes.length} פתקים. יש למחוק תחילה את כל הפתקים.`);
      return;
    }

    if (confirm('האם אתה בטוח שברצונך למחוק קטגוריה זו?')) {
      try {
        await removeCategory(categoryId);
      } catch (error) {
        console.error('Error deleting category:', error);
        alert('שגיאה במחיקת הקטגוריה');
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingCategory(null);
  };

  const getCategoryNotesCount = (categoryId: string) => {
    return allNotes.filter(note => note.categoryId === categoryId).length;
  };

  if (isLoading && categories.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
            >
              ← חזרה
            </Button>
            <h1 className="text-2xl font-bold text-primary">ניהול קטגוריות</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          {categories.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              <p>אין קטגוריות עדיין</p>
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((category) => {
                const notesCount = getCategoryNotesCount(category.id);
                const hasNotes = notesCount > 0;

                return (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-r-4 hover:bg-gray-100 transition-colors"
                    style={{ borderRightColor: category.color }}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {category.icon && <span className="text-2xl">{category.icon}</span>}
                      <div>
                        <h3 className="font-semibold text-gray-800">{category.name}</h3>
                        <p className="text-sm text-gray-500">
                          {notesCount} פתקים
                          {hasNotes && ' (יש למחוק את הפתקים לפני מחיקת הקטגוריה)'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(category)}
                      >
                        ✎ ערוך
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(category.id)}
                        className={hasNotes ? 'opacity-50 cursor-not-allowed' : ''}
                        disabled={hasNotes}
                      >
                        🗑 מחק
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Category Form Modal */}
      {showForm && (
        <CategoryForm
          onClose={handleFormClose}
          editCategory={editingCategory}
        />
      )}
    </div>
  );
};

export default CategoriesManagement;
