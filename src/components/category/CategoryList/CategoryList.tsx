/**
 * CategoryList Component
 * Displays vertical scrolling list of categories
 */

import React from 'react';
import { useCategories } from '@/hooks/useCategories';
import { useNotes } from '@/hooks/useNotes';
import { CategoryItem } from '../CategoryItem/CategoryItem';

interface CategoryListProps {
  onCreateFirstCategory?: () => void;
  searchQuery?: string;
}

export const CategoryList: React.FC<CategoryListProps> = ({ onCreateFirstCategory, searchQuery = '' }) => {
  const { categories, isLoading } = useCategories();
  const { allNotes, isLoading: notesLoading } = useNotes();

  // Debug: Log when searching
  if (searchQuery.trim() && allNotes.length > 0) {
    console.log('🔍 v1.0.5 - Searching for:', searchQuery);
    console.log('📊 Total notes to search:', allNotes.length);
    console.log('📝 Sample note:', allNotes[0]);
  }

  // סינון קטגוריות לפי מחרוזת החיפוש
  // מחפש גם בשם הקטגוריה וגם בפתקים שלה (כותרת, תוכן, תגיות)
  const filteredCategories = categories.filter(category => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const categoryNameMatch = category.name.toLowerCase().includes(query);

    // אם הפתקים עדיין נטענים, הראה את הקטגוריה אם השם שלה תואם
    // כך המשתמש יראה תוצאות חלקיות במקום שום דבר
    if (notesLoading) {
      return categoryNameMatch;
    }

    // בדיקה אם יש פתקים בקטגוריה שתואמים לחיפוש
    const categoryNotes = allNotes.filter(note => note.categoryId === category.id);
    const hasMatchingNotes = categoryNotes.some(note => {
      const titleMatch = note.title.toLowerCase().includes(query);
      const contentMatch = note.content.toLowerCase().includes(query);
      const tagsMatch = note.tags?.some(tag => tag.toLowerCase().includes(query)) || false;

      // Debug: Log matches
      if (titleMatch || contentMatch || tagsMatch) {
        console.log(`✅ Match in "${category.name}":`, {
          noteTitle: note.title,
          titleMatch,
          contentMatch,
          tagsMatch
        });
      }

      return titleMatch || contentMatch || tagsMatch;
    });

    return categoryNameMatch || hasMatchingNotes;
  });

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
          onClick={onCreateFirstCategory}
          className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          צור קטגוריה ראשונה
        </button>
      </div>
    );
  }

  if (filteredCategories.length === 0 && searchQuery.trim()) {
    return (
      <div className="text-center p-4 sm:p-8 text-gray-500 dark:text-gray-400">
        <div className="text-4xl mb-4">🔍</div>
        <p className="text-sm sm:text-base">לא נמצאו תוצאות עבור "{searchQuery}"</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 sm:space-y-3">
      {filteredCategories.map((category) => (
        <CategoryItem
          key={category.id}
          category={category}
          searchQuery={searchQuery}
        />
      ))}
    </div>
  );
};
