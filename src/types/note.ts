/**
 * טיפוסים הקשורים לפתקים
 */

import { Timestamp } from 'firebase/firestore';

/**
 * סוגי התבניות שהאפליקציה יודעת ליצור.
 *
 * ב-Firestore עשויים לשבת פתקים עם סוג שכבר לא קיים כאן (למשל
 * `aisummary` שהוסר) - `getTemplateMeta` מטפל בהם דרך ברירת המחדל.
 */
export type TemplateType = 'plain' | 'checklist' | 'recipe' | 'shopping' | 'workplan' | 'accounting';

export interface Note {
  id: string;
  title: string;
  content: string;
  categoryId: string;
  templateType: TemplateType;
  tags: string[];
  color: string | null;
  order: number;
  userId: string;
  sharedWith: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isPinned: boolean;
  isArchived: boolean;
  /**
   * רגיש: מוסתר מ-Claude (שרת ה-MCP). רק הבעלים משנה אותו, רק מהאפליקציה.
   * הרגישות האפקטיבית כוללת גם את הקטגוריה - ראה `thinking/architecture-review.md` §12.
   */
  isSensitive: boolean;
  /**
   * קריאה בלבד ל-Claude: הוא רואה את הפתק אבל לא משנה אותו. רק הבעלים
   * משנה את הדגל, רק מהאפליקציה. האפליקציה עצמה עורכת כרגיל.
   */
  isReadOnly: boolean;
  /** `'mcp'` - הפתק נוצר ע"י Claude. נקבע רק בשרת; ה-rules חוסמים כתיבה שלו מהאפליקציה */
  createdVia?: 'mcp';
  archivedAt?: Timestamp;
  /** מי כתב אחרון. נקבע ע"י שכבת השמירה ונאכף ב-rules; חסר בפתקים ישנים */
  updatedBy?: string;
  /**
   * מונה גרסאות של התוכן (C-1): כל כתיבה של כותרת/תוכן/תבנית מעלה אותו
   * ב-1. פתק פתוח מזהה כך שינוי מרחוק. חסר בפתקים ישנים = 0.
   */
  revision: number;
}
// תזכורות אינן שדה של הפתק. הן שייכות למשימה בודדת ברשימת משימות,
// ומתוחזקות בקולקציה נפרדת ע"י טריגר בענן - ראה `functions/src/index.ts`.

export type NoteInput = Omit<
  Note,
  'id' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'isArchived' | 'archivedAt' | 'revision'
>;

/**
 * הנתונים שטופס הפתק מחזיר.
 * שדות הבעלות והסדר נקבעים ע"י שכבת השמירה ולא ע"י הטופס.
 */
export interface NoteFormData {
  title: string;
  content: string;
  templateType: TemplateType;
  tags: string[];
  color: string | null;
}
