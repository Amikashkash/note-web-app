/**
 * ⚠️ MIRROR - אל תערכו כאן בלבד.
 *
 * מקור: `src/types/template.ts` וה-`TemplateType` מ-`src/types/note.ts`
 * (האפליקציה). הטיפוסים שהמראות `templateContent.ts` ו-`render.ts`
 * צריכים, בלי שום תלות ב-Firebase.
 *
 * `ChecklistItem` מוגדר גם ב-`functions/src/reminders.ts` לצורך התזכורות.
 * לא מאחדים: הקבצים הקיימים לא נוגעים ב-notesCore (mcp-plan §4.2).
 */

/** סוגי התבניות שהאפליקציה יודעת ליצור */
export type TemplateType = 'plain' | 'checklist' | 'recipe' | 'shopping' | 'workplan' | 'accounting';

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
