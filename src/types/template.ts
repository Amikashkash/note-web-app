/**
 * טיפוסים של תוכן התבניות
 *
 * תוכן הפתק נשמר ב-Firestore כמחרוזת JSON, והטיפוסים כאן מתארים את
 * המבנה שלה לכל סוג תבנית. הם יושבים ב-`types` ולא בקומפוננטות כדי
 * שגם קוד שאינו UI (כמו פונקציות השיתוף) יוכל להשתמש בהם בלי לייבא
 * קומפוננטת React.
 */

/** שורה בטבלת חשבונאות */
export interface AccountingRow {
  id: string;
  description: string;
  amount: number;
  /** תאריך כמחרוזת בפורמט של שדה הקלט (YYYY-MM-DD) */
  date: string;
}

/** סעיף בתכנית עבודה */
export interface WorkPlanSection {
  id: string;
  header: string;
  content: string;
}

/** מרווחי חזרה נתמכים לתזכורת. חסר = תזכורת חד-פעמית. */
export type RepeatRule = 'daily' | 'weekly' | 'monthly' | 'yearly';

/** משימה ברשימת משימות */
export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string; // תאריך יעד בפורמט YYYY-MM-DD
  dueTime?: string; // שעת יעד בפורמט HH:MM
  repeat?: RepeatRule; // חזרה תקופתית, ראה `functions/src/recurrence.ts`
}

/** פריט ברשימת קניות */
export interface ShoppingItem {
  id: string;
  name: string;
  quantity: string;
  checked: boolean;
}

/** מתכון */
export interface RecipeData {
  servings: string;
  prepTime: string;
  cookTime: string;
  ingredients: string[];
  instructions: string[];
}
