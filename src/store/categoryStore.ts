/**
 * Zustand Store for Category Management
 */

import { create } from 'zustand';
import * as categoryAPI from '@/services/api/categories';
import type { Category } from '@/types';

interface CategoryState {
  // State
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  unsubscribe: (() => void) | null;
  currentUserId: string | null;

  // Actions
  setCategories: (categories: Category[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // CRUD Operations
  createCategory: (userId: string, name: string, color?: string) => Promise<void>;
  updateCategory: (categoryId: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;

  // Real-time subscription
  subscribeToCategories: (userId: string) => void;
  unsubscribeFromCategories: () => void;

  // Reset
  reset: () => void;
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  // Initial state
  categories: [],
  isLoading: false,
  error: null,
  unsubscribe: null,
  currentUserId: null,

  /**
   * Set categories
   */
  setCategories: (categories) => {
    set({ categories, isLoading: false, error: null });
  },

  /**
   * Set loading state
   */
  setLoading: (isLoading) => {
    set({ isLoading });
  },

  /**
   * Set error
   */
  setError: (error) => {
    set({ error, isLoading: false });
  },

  /**
   * Create a new category
   */
  createCategory: async (userId: string, name: string, color?: string) => {
    try {
      set({ isLoading: true, error: null });
      await categoryAPI.createCategory(userId, name, color);
      // Real-time listener will update the categories
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  /**
   * Update a category
   */
  updateCategory: async (categoryId: string, updates: Partial<Category>) => {
    try {
      set({ isLoading: true, error: null });
      await categoryAPI.updateCategory(categoryId, updates);
      // Real-time listener will update the categories
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  /**
   * Delete a category
   */
  deleteCategory: async (categoryId: string) => {
    try {
      set({ isLoading: true, error: null });
      await categoryAPI.deleteCategory(categoryId);
      // Real-time listener will update the categories
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  /**
   * Subscribe to real-time categories updates
   */
  subscribeToCategories: (userId: string) => {
    const { unsubscribe, currentUserId } = get();

    // If already subscribed to this user, do nothing
    if (currentUserId === userId && unsubscribe) {
      console.log('Already subscribed to user:', userId);
      return;
    }

    // Unsubscribe from previous subscription if exists
    if (unsubscribe) {
      unsubscribe();
    }

    console.log('Creating new subscription for user:', userId);
    set({ isLoading: true, currentUserId: userId });

    // Set a timeout to stop loading state if subscription takes too long
    const loadingTimeout = setTimeout(() => {
      set({ isLoading: false });
    }, 3000); // 3 seconds timeout

    const newUnsubscribe = categoryAPI.subscribeToCategories(userId, (categories) => {
      clearTimeout(loadingTimeout);
      set({ categories, isLoading: false, error: null });
    });

    set({ unsubscribe: newUnsubscribe });
  },

  /**
   * Unsubscribe from categories updates
   */
  unsubscribeFromCategories: () => {
    const { unsubscribe } = get();
    if (unsubscribe) {
      unsubscribe();
      set({ unsubscribe: null, currentUserId: null });
    }
  },

  /**
   * Reset store
   */
  reset: () => {
    const { unsubscribe } = get();
    if (unsubscribe) {
      unsubscribe();
    }
    set({
      categories: [],
      isLoading: false,
      error: null,
      unsubscribe: null,
      currentUserId: null,
    });
  },
}));
