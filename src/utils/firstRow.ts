import type { ParseResult } from './templateContent';

/**
 * מה שהעורך מציג (בלי מצב עריכה, v1.39.0): רשימה או תכנית חדשה - תוכן ריק
 * לגמרי - מוצגת עם שורה ראשונה ריקה, **בלי לכתוב**. פתיחה של פתק לא כותבת
 * כלום; השורה נשמרת עם השינוי הראשון של המשתמש. `[]` (הכל נמחק) נשאר ריק,
 * תוכן שלא פוענח לא מוצג כרשימה (ולא נדרס), ובצפייה בלבד אין שורה מדומה.
 */
export const withFirstRow = <T>(
  value: string,
  parsed: ParseResult<T[]>,
  readOnly: boolean,
  firstRow: T
): T[] => {
  if (!parsed.ok) return [];
  return value === '' && !readOnly ? [firstRow] : parsed.value;
};
