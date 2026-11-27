/**
 * שמירה של רשימת משימות או קניות בלי למחוק שדות שהגרסה הזו לא מכירה (v1.44.2).
 *
 * העורכים עובדים על הפריטים כפי שהמפענח מחזיר אותם (`parseChecklist`,
 * `parseShopping`), והמפענח מחזיר רק את השדות שהוא מכיר. עד 1.44.1 השמירה
 * כתבה את הפריטים האלה כמו שהם, ולכן כל שדה אחר - מגרסה עתידית של האפליקציה
 * (`completedAt`, `status`) או מהשרת - נמחק בעריכה הראשונה, **בכל הפריטים**
 * ולא רק בזה שנערך. תכנית העבודה כבר לא עושה את זה מאז 1.44.0 (`workplan.ts`).
 *
 * כאן העורך ממשיך לעבוד כרגיל, ורק השמירה עוברת דרך השורות הגולמיות:
 * - **פריט שהיה בתוכן:** השורה הגולמית שלו, ובה משתנים רק השדות שהעורך שינה
 *   בפועל (לעומת מה שהמפענח קרא ממנה). שדה לא מוכר נשאר; גם ערך שהמפענח לא
 *   הבין בשדה מוכר (למשל עדיפות מגרסה עתידית) נשאר, כל עוד לא נגעו בו.
 * - **פריט חדש:** כמו שהעורך בנה אותו.
 * - **פריט שהוסר מהרשימה:** נמחק. **הסדר:** של העורך (גרירה, מיון).
 *
 * שדה שהעורך קבע ל-`undefined` (ניקוי תאריך) נמחק מהשורה, כמו קודם.
 *
 * טהור - בלי React ובלי Firebase.
 */

import type { ParseResult } from './templateContent';

type Row = Record<string, unknown>;

/** השורות הגולמיות, או `null` כשהתוכן אינו מערך של אובייקטים (כמו `templateContent.ts`) */
const rawRows = (value: string): Row[] | null => {
  if (value.trim() === '') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || !parsed.every((row) => row && typeof row === 'object' && !Array.isArray(row))) {
    return null;
  }
  return parsed as Row[];
};

/**
 * התוכן לשמירה: `items` (מה שהעורך רוצה לשמור), על בסיס השורות הגולמיות של
 * `value` (התוכן שהעורך הציג). `parse` - המפענח של התבנית, שממנו הגיעו הפריטים.
 */
export const keepUnknownFields = <T extends { id: string }>(
  value: string,
  items: readonly T[],
  parse: (value: string) => ParseResult<T[]>
): string => {
  const raw = rawRows(value);
  const shown = parse(value);
  // תוכן שלא פוענח לא מוצג כרשימה, ואין שורות לשמור עליהן
  if (!raw || !shown.ok || shown.value.length !== raw.length) return JSON.stringify(items);

  // המזהה שהמפענח הציג לכל שורה (גם `item-<מיקום>` לשורה בלי מזהה). מזהה כפול - הראשון
  const byId = new Map<string, { raw: Row; shown: T }>();
  shown.value.forEach((item, index) => {
    if (!byId.has(item.id)) byId.set(item.id, { raw: raw[index], shown: item });
  });

  return JSON.stringify(
    items.map((item) => {
      const before = byId.get(item.id);
      if (!before) return item;
      const row: Row = { ...before.raw, id: item.id };
      const known = new Set([...Object.keys(item), ...Object.keys(before.shown)]);
      for (const key of known) {
        const next = (item as Row)[key];
        if (Object.is(next, (before.shown as Row)[key])) continue;
        if (next === undefined) delete row[key];
        else row[key] = next;
      }
      return row;
    })
  );
};
