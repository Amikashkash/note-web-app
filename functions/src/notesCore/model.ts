/**
 * הטיפוסים ש-notesCore מחזיר: אובייקטים פשוטים, בלי Timestamp של Firestore.
 * תאריכים כמחרוזות ISO, או `null` כשהמסמך לא מחזיק תאריך (פתקים ישנים).
 *
 * `isSensitive` לא מופיע בטיפוסים הציבוריים: מה שיוצא מ-`UserScope`
 * כבר עבר את `isVisibleToMcp`, ולכן הוא תמיד לא רגיש.
 */

/** הקשר של המשתמש המבקש למסמך */
export type Access = 'owner' | 'shared';

/** פתק כפי שהוא ב-Firestore, מנורמל. פנימי ל-notesCore */
export interface NoteRecord {
  id: string;
  title: string;
  content: string;
  categoryId: string;
  /** מחרוזת ולא `TemplateType`: ב-Firestore יש גם תבניות שהוסרו */
  templateType: string;
  tags: string[];
  color: string | null;
  order: number;
  userId: string;
  sharedWith: string[];
  isPinned: boolean;
  isArchived: boolean;
  isSensitive: boolean;
  /** הדגל של הפתק עצמו. האפקטיבי (כולל הקטגוריה) ב-`Note.isReadOnly` */
  isReadOnly: boolean;
  /** `'mcp'` כשהפתק נוצר ע"י Claude */
  createdVia: 'mcp' | null;
  /** מונה גרסאות התוכן (C-1). כל כותב מעלה ב-1. חסר = 0 */
  revision: number;
  createdAt: string | null;
  updatedAt: string | null;
  archivedAt: string | null;
  updatedBy: string | null;
}

/** קטגוריה כפי שהיא ב-Firestore, מנורמלת. פנימי ל-notesCore */
export interface CategoryRecord {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  order: number;
  userId: string;
  sharedWith: string[];
  isSensitive: boolean;
  /** קריאה בלבד ל-Claude: אין יצירה בקטגוריה, והפתקים בה לקריאה בלבד */
  isReadOnly: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * פתק גלוי. `isReadOnly` כאן הוא **האפקטיבי**: הדגל של הפתק או של
 * הקטגוריה שלו. כלי עריכה (שלב 2ב) מסרבים לפיו.
 */
export type Note = Omit<NoteRecord, 'isSensitive'> & { access: Access };

export type Category = Omit<CategoryRecord, 'isSensitive'> & { access: Access };

export type VersionReason = 'archive' | 'template' | 'move' | 'restore' | 'writer' | 'time';

/** גרסה שמורה של פתק (`notes/{id}/versions`, צעד B6) */
export interface NoteVersion {
  id: string;
  title: string;
  content: string;
  templateType: string;
  tags: string[];
  color: string | null;
  categoryId: string;
  isArchived: boolean;
  authoredBy: string | null;
  authoredAt: string | null;
  replacedBy: string | null;
  reason: VersionReason;
  capturedAt: string | null;
}
