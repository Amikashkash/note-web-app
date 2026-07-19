/**
 * Hook לניהול קטגוריות
 *
 * נרשם למנוי המשותף כל עוד הקומפוננטה חיה; המנוי עצמו מנוהל
 * ב-`categoryStore` עם ספירת צרכנים.
 */

import { useCallback, useEffect } from 'react';
import { useCategoryStore } from '@/store/categoryStore';
import { useAuthStore } from '@/store/authStore';
import type { CategoryInput } from '@/types';

export const useCategories = () => {
  const userId = useAuthStore((state) => state.user?.uid);

  const categories = useCategoryStore((state) => state.categories);
  const isLoading = useCategoryStore((state) => state.isLoading);
  const error = useCategoryStore((state) => state.error);
  const subscribe = useCategoryStore((state) => state.subscribe);
  const unsubscribe = useCategoryStore((state) => state.unsubscribe);
  const createCategory = useCategoryStore((state) => state.createCategory);
  const updateCategory = useCategoryStore((state) => state.updateCategory);
  const deleteCategory = useCategoryStore((state) => state.deleteCategory);

  useEffect(() => {
    if (!userId) return;

    subscribe(userId);
    return () => unsubscribe();
  }, [userId, subscribe, unsubscribe]);

  const addCategory = useCallback(
    async (name: string, color?: string) => {
      if (!userId) throw new Error('משתמש לא מחובר');
      await createCategory(userId, name, color);
    },
    [createCategory, userId]
  );

  const editCategory = useCallback(
    async (categoryId: string, name?: string, color?: string, icon?: string) => {
      const updates: Partial<CategoryInput> = {};
      if (name !== undefined) updates.name = name;
      if (color !== undefined) updates.color = color;
      if (icon !== undefined) updates.icon = icon;

      await updateCategory(categoryId, updates);
    },
    [updateCategory]
  );

  return {
    categories,
    isLoading,
    error,
    addCategory,
    editCategory,
    removeCategory: deleteCategory,
  };
};
