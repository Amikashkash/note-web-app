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

/** סטטוס של סעיף (v1.44.0). מוצג רק כשהמעקב פעיל בפתק (`workplanStatus`) */
export type SectionStatus = 'open' | 'active' | 'done';

/**
 * סעיף בתכנית עבודה.
 *
 * v1.44.0 - שדות אופציונליים, בלי מיגרציה: סעיף ישן (`id`, `header`,
 * `content`) נשאר כמו שהוא, והתוכן הקיים שלו הוא היומן.
 */
export interface WorkPlanSection {
  id: string;
  header: string;
  /** היומן: שורות מתוארכות ("10/11 העברה אחת") וכל טקסט חופשי */
  content: string;
  /** "מצב ותובנות": המצב הקבוע ("2 זכרים, 5 נקבות"), מוצמד מעל היומן */
  state?: string;
  status?: SectionStatus;
  /** מתי הסעיף השתנה לאחרונה (מילישניות). "לפני כמה זמן" - מכאן, לא מפענוח תאריכים בטקסט */
  updatedAt?: number;
}

/** מרווחי חזרה נתמכים לתזכורת. חסר = תזכורת חד-פעמית. */
export type RepeatRule = 'daily' | 'weekly' | 'monthly' | 'yearly';

/** עדיפות של משימה. חסר = רגילה (אין ערך 'normal' שמור) */
export type TaskPriority = 'urgent' | 'low';

/** משימה ברשימת משימות */
export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string; // תאריך יעד בפורמט YYYY-MM-DD
  dueTime?: string; // שעת יעד בפורמט HH:MM
  repeat?: RepeatRule; // חזרה תקופתית, ראה `functions/src/recurrence.ts`
  priority?: TaskPriority;
  /** בסיס של סדרה חודשית/שנתית שהתקצצה, ראו `functions/src/recurringTasks.ts` */
  repeatBase?: string;
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
