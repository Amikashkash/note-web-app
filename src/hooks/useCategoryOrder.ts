/**
 * הסדר האישי של הקטגוריות במסך הבית (סבב 3, v1.40.0). ראה `utils/categoryOrder.ts`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { saveCategoryOrder, subscribeToCategoryOrder } from '@/services/api/homePreferences';
import { applyCategoryOrder, moveCategory } from '@/utils/categoryOrder';
import { getErrorMessage } from '@/utils/errors';

interface LoadedOrder {
  /** של מי הסדר - כדי שסדר של משתמש קודם לא יוצג אחרי החלפת משתמש */
  userId: string;
  ids: string[];
}

export const useCategoryOrder = <T extends { id: string }>(categories: T[]) => {
  const userId = useAuthStore((state) => state.user?.uid);
  const [loaded, setLoaded] = useState<LoadedOrder | null>(null);

  useEffect(() => {
    if (!userId) return;
    return subscribeToCategoryOrder(
      userId,
      (ids) => setLoaded({ userId, ids }),
      // בלי הסדר האישי מוצג סדר ברירת המחדל - הקטגוריות עצמן לא נפגעות
      () => setLoaded({ userId, ids: [] })
    );
  }, [userId]);

  const current = loaded && loaded.userId === userId ? loaded : null;

  const ordered = useMemo(
    () => applyCategoryOrder(categories, current?.ids ?? []),
    [categories, current]
  );

  /**
   * הזזת קטגוריה. הסדר המוצג מתעדכן מהמנוי (הכתיבה המקומית מגיעה מיד, גם
   * offline). אם השרת דוחה, ה-SDK מחזיר את הסדר הקודם והמשתמש מקבל הודעה.
   */
  const reorder = useCallback(
    (activeId: string, overId: string) => {
      if (!userId) return;
      const next = moveCategory(
        ordered.map((category) => category.id),
        activeId,
        overId
      );
      if (!next) return;
      saveCategoryOrder(userId, next).catch((error) => window.alert(getErrorMessage(error)));
    },
    [ordered, userId]
  );

  return { ordered, orderLoaded: current !== null, reorder };
};
