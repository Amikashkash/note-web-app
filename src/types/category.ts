/**
 * טיפוסים הקשורים לקטגוריות
 */

import { Timestamp } from 'firebase/firestore';

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  order: number;
  userId: string;
  sharedWith: string[];
  /** רגיש: הקטגוריה וכל הפתקים בה מוסתרים מ-Claude. רק הבעלים משנה */
  isSensitive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CategoryInput = Omit<Category, 'id' | 'createdAt' | 'updatedAt'>;
