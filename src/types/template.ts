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
