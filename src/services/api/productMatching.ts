/**
 * התאמת מוצרים להשלמה אוטומטית
 *
 * מופרד מ-`products.ts` כי אלו פונקציות טהורות בלי שום גישה לרשת -
 * מה שגם מאפשר לבדוק אותן בלי Firebase.
 */

export interface RememberedProduct {
  name: string;
  useCount: number;
}

/** מספר ההצעות שמוצגות בכל רגע */
const MAX_SUGGESTIONS = 6;

/**
 * צורה מנורמלת לצורך השוואה וזיהוי.
 * רווחים כפולים ואותיות גדולות לא הופכים מוצר לחדש.
 */
export const normalizeProductName = (name: string): string =>
  name.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * דירוג הצעות לפי מה שהוקלד.
 *
 * מוצר שמתחיל במה שהוקלד מדורג לפני מוצר שרק מכיל אותו - "חלב" צריך
 * לקפוץ לפני "שקדי חלב" כשמקלידים "חל". בתוך כל קבוצה, לפי תדירות.
 */
export const rankSuggestions = (
  products: RememberedProduct[],
  query: string,
  exclude: string[] = []
): RememberedProduct[] => {
  const normalizedQuery = normalizeProductName(query);
  if (normalizedQuery.length === 0) return [];

  const excluded = new Set(exclude.map(normalizeProductName));

  return products
    .filter((product) => {
      const name = normalizeProductName(product.name);
      return !excluded.has(name) && name.includes(normalizedQuery);
    })
    .sort((a, b) => {
      const aStarts = normalizeProductName(a.name).startsWith(normalizedQuery);
      const bStarts = normalizeProductName(b.name).startsWith(normalizedQuery);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return b.useCount - a.useCount;
    })
    .slice(0, MAX_SUGGESTIONS);
};
