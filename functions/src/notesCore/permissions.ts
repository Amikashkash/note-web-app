/**
 * טבלת ההרשאות של notesCore (mcp-plan §3.2.5).
 *
 * הכלל: **תת-קבוצה של `firestore.rules`, אף פעם לא יותר.** ה-Admin SDK
 * עוקף את ה-rules, ולכן כל מה שמותר כאן חייב להיות מותר גם שם לאותו
 * משתמש. הבדיקה "MCP permissions are a subset of the rules" ב-`tests/rules`
 * מריצה כל שדה מ-`NOTE_PATCH_FIELDS` מול ה-rules ונכשלת אם זה לא נכון.
 *
 * טהור: בלי Firestore, כדי שגם בדיקות ה-rules יוכלו לייבא אותו.
 */

import { InvalidError } from './errors';
import type { Access } from './model';

/** מה פעולה צריכה מהמשתמש ביחס למסמך */
export type Need = 'read' | 'write' | 'owner';

/** הקשר של המשתמש למסמך, או `null` אם אין לו גישה */
export const accessOf = (doc: { userId: string; sharedWith: readonly string[] }, uid: string): Access | null => {
  if (doc.userId === uid) return 'owner';
  if (doc.sharedWith.includes(uid)) return 'shared';
  return null;
};

export const satisfies = (access: Access, need: Need): boolean => access === 'owner' || need !== 'owner';

/**
 * השדות שכתיבה של notesCore רשאית לשנות, ומי. **allowlist**: כל שדה
 * שלא מופיע כאן נדחה, כולל שדות שיתווספו לפתק בעתיד.
 *
 * - `title`, `content`, `isPinned`: בעלים ושותף, כמו ב-rules.
 * - `isArchived`, `categoryId`: בעלים בלבד (החלטה). ה-rules מתירים לשותף
 *   לארכב, כך שכאן זה מחמיר יותר - ויהיה זהה אחרי R-2 בסקירה.
 *
 * אף פעם: `userId`, `sharedWith` (בעלות), `isSensitive` (§3.4 - רק
 * מהאפליקציה), `updatedBy`, `updatedAt`, `archivedAt` (נקבעים ע"י
 * שכבת השמירה, לא ע"י הקורא), `templateType` (המרה היא פעולה נפרדת).
 */
export const NOTE_PATCH_FIELDS = {
  title: 'write',
  content: 'write',
  isPinned: 'write',
  isArchived: 'owner',
  categoryId: 'owner',
} as const satisfies Record<string, Need>;

export type NotePatchField = keyof typeof NOTE_PATCH_FIELDS;

export interface NotePatch {
  title?: string;
  content?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  categoryId?: string;
}

/** אותן מגבלות כמו באפליקציה (`LENGTH_LIMITS.NOTE_TITLE`) ו-mcp-plan §3.3 */
export const LIMITS = {
  title: 50,
  content: 100 * 1024,
  id: 128,
} as const;

const isPatchField = (key: string): key is NotePatchField => Object.hasOwn(NOTE_PATCH_FIELDS, key);

const validateField = (key: NotePatchField, value: unknown): void => {
  switch (key) {
    case 'title':
      if (typeof value !== 'string' || value.length > LIMITS.title) throw new InvalidError('Invalid title');
      return;
    case 'content':
      if (typeof value !== 'string' || value.length > LIMITS.content) throw new InvalidError('Invalid content');
      return;
    case 'isPinned':
    case 'isArchived':
      if (typeof value !== 'boolean') throw new InvalidError(`Invalid ${key}`);
      return;
    case 'categoryId':
      if (typeof value !== 'string' || value.length === 0 || value.length > LIMITS.id || value.includes('/')) {
        throw new InvalidError('Invalid categoryId');
      }
      return;
  }
};

/**
 * עדכון לפתק, מסונן לפי ה-allowlist וההקשר של המשתמש.
 *
 * שדה לא מוכר, או שדה שההקשר לא מתיר, נדחה עם שגיאה ולא מושמט בשקט:
 * קורא שביקש לשנות `sharedWith` צריך לדעת שזה לא קרה. הודעת השגיאה
 * מזכירה רק את שמות השדות שהקורא עצמו שלח.
 */
export const sanitizeNotePatch = (patch: unknown, access: Access): NotePatch => {
  if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
    throw new InvalidError('Patch must be an object');
  }

  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  const refused = entries
    .map(([key]) => key)
    .filter((key) => !isPatchField(key) || !satisfies(access, NOTE_PATCH_FIELDS[key]));
  if (refused.length > 0) throw new InvalidError(`Fields not allowed: ${refused.join(', ')}`);
  if (entries.length === 0) throw new InvalidError('Empty patch');

  const clean: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    validateField(key as NotePatchField, value);
    clean[key] = value;
  }
  return clean as NotePatch;
};
