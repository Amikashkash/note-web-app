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
  archivedAt?: Timestamp;
  reminderTime?: Timestamp | null;
  reminderEnabled?: boolean;
}

export type NoteInput = Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'isArchived' | 'archivedAt'>;

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
  reminderTime?: Date | null;
  reminderEnabled?: boolean;
}
