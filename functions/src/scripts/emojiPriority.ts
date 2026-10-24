/**
 * מיגרציה של 🔴 בתחילת משימה לשדה `priority: 'urgent'` (שלב 3 בסבב 1).
 *
 * טהור - בלי Firestore. הסקריפט שמריץ אותו: `migrateEmojiPriority.ts`.
 *
 * הכללים:
 * - רק 🔴 (עם או בלי U+FE0F, פעם אחת או כמה) **בתחילת** הטקסט, אחרי רווחים.
 *   🔴 באמצע הטקסט נשאר כמו שהוא.
 * - משימה שכבר יש לה `priority` לא נוגעים בה - ההחלטה שלה כבר התקבלה.
 * - משימה שכל הטקסט שלה הוא 🔴 לא משתנה: משימה ריקה גרועה מאימוג'י.
 * - כל שדה אחר של השורה, וכל שורה אחרת, נשארים בדיוק כמו שהם.
 */

type Row = Record<string, unknown>;

const LEADING_RED = /^\s*(?:\u{1F534}️?\s*)+/u;

export interface EmojiPriorityResult {
  /** השורות אחרי המיגרציה. אותו מערך כשאין שינוי */
  rows: Row[];
  /** כמה משימות קיבלו `priority: 'urgent'` */
  migrated: number;
  /** משימות עם 🔴 בהתחלה שלא שונו (כבר יש עדיפות, או שהטקסט הוא רק האימוג'י) */
  skipped: number;
}

export const migrateEmojiPriority = (rows: Row[]): EmojiPriorityResult => {
  let migrated = 0;
  let skipped = 0;
  const next = rows.map((row) => {
    const text = typeof row.text === 'string' ? row.text : '';
    const match = LEADING_RED.exec(text);
    if (!match) return row;
    const rest = text.slice(match[0].length);
    if (row.priority !== undefined || rest.trim() === '') {
      skipped += 1;
      return row;
    }
    migrated += 1;
    return { ...row, text: rest, priority: 'urgent' };
  });
  return { rows: migrated > 0 ? next : rows, migrated, skipped };
};
