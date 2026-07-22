/**
 * Zustand Store לניהול קטגוריות
 *
 * ניהול המנוי זהה לזה של `noteStore`: מאזין יחיד עם ספירת צרכנים,
 * כך שכמה קומפוננטות יכולות לצרוך את אותן קטגוריות בלי לפתוח
 * מאזינים מיותרים ובלי שאחת תסגור את המנוי של השאר.
 */

import { create } from 'zustand';
import { Unsubscribe } from 'firebase/firestore';
import * as categoryAPI from '@/services/api/categories';
import { getErrorMessage } from '@/utils/errors';
import { logger } from '@/utils/logger';
import type { Category, CategoryInput } from '@/types';

interface CategoryState {
  categories: Category[];
  isLoading: boolean;
  /** האם התקבלה כבר תשובה ראשונה מהשרת */
  hasLoaded: boolean;
  error: string | null;

  _unsubscribe: Unsubscribe | null;
  _subscribedUserId: string | null;
  _subscriberCount: number;

  subscribe: (userId: string) => void;
  unsubscribe: () => void;

  createCategory: (userId: string, name: string, color?: string) => Promise<void>;
  updateCategory: (categoryId: string, updates: Partial<CategoryInput>) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  clearError: () => void;
}

export const useCategoryStore = create<CategoryState>((set, get) => {
  const runWrite = async <T>(action: () => Promise<T>): Promise<T> => {
    set({ error: null });
    try {
      return await action();
    } catch (error) {
      set({ error: getErrorMessage(error) });
      throw error;
    }
  };

  return {
    categories: [],
    isLoading: false,
    // האם התקבלה כבר תשובה מהשרת. נחוץ בנפרד מ-`isLoading`, שמתחיל
    // כ-false לפני שהמנוי בכלל קם: בלעדיו אי אפשר להבחין בין "עוד לא
    // ביקשנו" לבין "ביקשנו ואין קטגוריות", והמסך נתקע על "טוען".
    hasLoaded: false,
    error: null,

    _unsubscribe: null,
    _subscribedUserId: null,
    _subscriberCount: 0,

    subscribe: (userId: string) => {
      const { _subscribedUserId, _subscriberCount, _unsubscribe } = get();

      if (_subscribedUserId === userId && _unsubscribe) {
        set({ _subscriberCount: _subscriberCount + 1 });
        return;
      }

      if (_unsubscribe) {
        _unsubscribe();
      }

      logger.debug('Subscribing to categories for user:', userId);
      // `hasLoaded` מתאפס יחד עם הרשימה. בלי זה הוא נשאר `true` ממנוי
      // קודם בזמן שהרשימה כבר רוקנה, וצרכן שמחכה לטעינה מקבל תשובה
      // שקרית: "נטען, ואין קטגוריות".
      set({
        isLoading: true,
        hasLoaded: false,
        categories: [],
        _subscribedUserId: userId,
        _subscriberCount: 1,
      });

      const unsubscribe = categoryAPI.subscribeToCategories(userId, (categories) => {
        set({ categories, isLoading: false, hasLoaded: true, error: null });
      });

      set({ _unsubscribe: unsubscribe });
    },

    unsubscribe: () => {
      const { _subscriberCount, _unsubscribe } = get();
      const remaining = Math.max(0, _subscriberCount - 1);

      if (remaining > 0) {
        set({ _subscriberCount: remaining });
        return;
      }

      if (_unsubscribe) {
        logger.debug('Last subscriber left, closing categories subscription');
        _unsubscribe();
      }

      set({
        categories: [],
        isLoading: false,
        hasLoaded: false,
        _unsubscribe: null,
        _subscribedUserId: null,
        _subscriberCount: 0,
      });
    },

    createCategory: async (userId, name, color) => {
      await runWrite(() => categoryAPI.createCategory(userId, name, color));
    },

    updateCategory: async (categoryId, updates) => {
      await runWrite(() => categoryAPI.updateCategory(categoryId, updates));
    },

    deleteCategory: async (categoryId) => {
      await runWrite(() => categoryAPI.deleteCategory(categoryId));
    },

    clearError: () => set({ error: null }),
  };
});
