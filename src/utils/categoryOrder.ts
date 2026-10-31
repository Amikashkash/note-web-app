/**
 * הסדר האישי של הקטגוריות במסך הבית (סבב 3, v1.40.0).
 *
 * הסדר נשמר אצל המשתמש (`users/{uid}/preferences/home`), לא על מסמך הקטגוריה:
 * קטגוריה משותפת מסודרת אצל כל אחד בנפרד, וגרירה אצל נמען לא נוגעת בבעלים.
 */

/** כמה מזהים לכל היותר נשמרים. זהה לגבול ב-`firestore.rules` */
export const MAX_CATEGORY_ORDER = 500;

/**
 * הקטגוריות לפי הסדר השמור. קטגוריות שלא ברשימה (חדשות, או ששותפו מאז)
 * באות אחריהן, בסדר שבו התקבלו (`order` של הקטגוריה, כמו לפני הסדר האישי).
 * מזהים של קטגוריות שכבר לא קיימות - מתעלמים מהם.
 */
export const applyCategoryOrder = <T extends { id: string }>(
  categories: T[],
  order: readonly string[]
): T[] => {
  const rank = new Map<string, number>();
  order.forEach((id, index) => {
    if (!rank.has(id)) rank.set(id, index);
  });
  const known = categories.filter((category) => rank.has(category.id));
  const unknown = categories.filter((category) => !rank.has(category.id));
  known.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  return [...known, ...unknown];
};

/**
 * הסדר החדש אחרי הזזת `activeId` למקום של `overId`, מתוך הסדר המוצג.
 * `null` - אין שינוי (אותו מקום, או מזהה שלא ברשימה).
 */
export const moveCategory = (
  shownIds: readonly string[],
  activeId: string,
  overId: string
): string[] | null => {
  const from = shownIds.indexOf(activeId);
  const to = shownIds.indexOf(overId);
  if (from === -1 || to === -1 || from === to) return null;
  const next = [...shownIds];
  next.splice(from, 1);
  next.splice(to, 0, activeId);
  return next.slice(0, MAX_CATEGORY_ORDER);
};

/** קריאת הסדר מהמסמך. כל דבר אחר מרשימת מחרוזות נחשב "אין סדר" */
export const parseCategoryOrder = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
