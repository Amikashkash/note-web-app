/**
 * פתקים ששותפו איתי בלי הקטגוריה שלהם
 *
 * דף הבית מרנדר קטגוריות, וכל קטגוריה מציגה את הפתקים שלה. פתק שמישהו
 * שיתף איתי בלי לשתף גם את הקטגוריה מגיע למכשיר ונשמר בזיכרון - אבל
 * ה-`categoryId` שלו מצביע על קטגוריה שאינה נראית לי, ולכן אין תחת מה
 * לרנדר אותו. עד עכשיו הוא פשוט נעלם.
 *
 * ההוק מאתר בדיוק את הפתקים האלה, כדי שיוצגו במקטע נפרד.
 */

import { useMemo } from 'react';
import { useNotes } from './useNotes';
import { useCategories } from './useCategories';
import { useAuthStore } from '@/store/authStore';
import type { Note } from '@/types/note';

export const useOrphanSharedNotes = (): Note[] => {
  const userId = useAuthStore((state) => state.user?.uid);
  const { allNotes } = useNotes();
  const { categories } = useCategories();

  const visibleCategoryIds = useMemo(
    () => new Set(categories.map((category) => category.id)),
    [categories]
  );

  return useMemo(() => {
    if (!userId) return [];

    return allNotes.filter(
      (note) =>
        // בבעלות מישהו אחר - פתק שלי תמיד מגיע עם הקטגוריה שלי
        note.userId !== userId &&
        !note.isArchived &&
        !visibleCategoryIds.has(note.categoryId)
    );
  }, [allNotes, userId, visibleCategoryIds]);
};
