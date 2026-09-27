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
  /** קריאה בלבד ל-Claude: הוא רואה את הקטגוריה, אבל לא יוצר בה פתקים. רק הבעלים משנה */
  isReadOnly: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** דגלים שרק הבעלים קובע: רגישה (מוסתרת מ-Claude) וקריאה בלבד ל-Claude */
export interface CategoryFlags {
  isSensitive?: boolean;
  isReadOnly?: boolean;
}

export type CategoryInput = Omit<Category, 'id' | 'createdAt' | 'updatedAt'>;
