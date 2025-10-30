/**
 * Custom Hook for Category Management
 * Provides easy access to category operations
 */

import { useEffect } from 'react';
import { useCategoryStore } from '@/store/categoryStore';
import { useAuth } from './useAuth';

export const useCategories = () => {
  const { user } = useAuth();
  const {
    categories,
    isLoading,
    error,
    createCategory,
    updateCategory,
    deleteCategory,
    subscribeToCategories,
    unsubscribeFromCategories,
  } = useCategoryStore();

  /**
   * Subscribe to categories when user is authenticated
   */
  useEffect(() => {
    if (user?.uid) {
      subscribeToCategories(user.uid);
    }

    return () => {
      unsubscribeFromCategories();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  /**
   * Create a new category
   */
  const addCategory = async (name: string, color?: string) => {
    if (!user?.uid) {
      throw new Error('User not authenticated');
    }
    await createCategory(user.uid, name, color);
  };

  /**
   * Update a category
   */
  const editCategory = async (categoryId: string, name?: string, color?: string, icon?: string) => {
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;
    if (icon !== undefined) updates.icon = icon;

    await updateCategory(categoryId, updates);
  };

  /**
   * Delete a category
   */
  const removeCategory = async (categoryId: string) => {
    await deleteCategory(categoryId);
  };

  return {
    // State
    categories,
    isLoading,
    error,

    // Actions
    addCategory,
    editCategory,
    removeCategory,
  };
};
