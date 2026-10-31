/**
 * האקורדיון של מסך הבית (סבב 3, v1.40.0): קטגוריה אחת פתוחה בכל פעם.
 *
 * איזו קטגוריה פתוחה נזכר **במכשיר**, לכל משתמש: זה מצב תצוגה ולא נתון,
 * ולא שווה כתיבה לשרת בכל פתיחה. רק מזהה נשמר - לא שם ולא תוכן.
 */

const openKey = (userId: string) => `home.openCategory.${userId}`;

interface KeyValueStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const browserStorage = (): KeyValueStorage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // גישה ל-localStorage עצמה זורקת כשהוא חסום (למשל עוגיות כבויות)
    return null;
  }
};

/** הקטגוריה שהייתה פתוחה אחרונה במכשיר הזה. `null` - אף אחת */
export const readOpenCategory = (userId: string, storage = browserStorage()): string | null => {
  try {
    return storage?.getItem(openKey(userId)) || null;
  } catch {
    return null;
  }
};

/**
 * שמירה של הקטגוריה הפתוחה. כישלון (מקום, חסימה) לא מדווח: מה שנפגע הוא רק
 * איזו קטגוריה תיפתח בפעם הבאה, והמסך עצמו ממשיך לעבוד.
 */
export const writeOpenCategory = (
  userId: string,
  categoryId: string | null,
  storage = browserStorage()
): void => {
  try {
    if (categoryId) storage?.setItem(openKey(userId), categoryId);
    else storage?.removeItem(openKey(userId));
  } catch {
    // ראה למעלה
  }
};

/** לחיצה על שורה: פותחת אותה (וסוגרת את הקודמת), או סוגרת אם היא הפתוחה */
export const toggleOpen = (openId: string | null, categoryId: string): string | null =>
  openId === categoryId ? null : categoryId;

/**
 * הפתק שעודכן אחרון - לשורה השנייה של קטגוריה מקופלת. שוויון: הראשון ברשימה.
 */
export const latestNote = <T extends { updatedAt: { toMillis: () => number } }>(
  notes: readonly T[]
): T | null =>
  notes.reduce<T | null>(
    (latest, note) => (latest === null || note.updatedAt.toMillis() > latest.updatedAt.toMillis() ? note : latest),
    null
  );
