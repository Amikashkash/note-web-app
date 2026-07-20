/**
 * חוזה ה-payload שנשלח ב-push אל ה-Service Worker.
 *
 * חשוב: זהו מראה של `src/types/reminder.ts` בצד הלקוח. אי אפשר לייבא
 * ממנו ישירות כי `functions/` היא חבילה נפרדת עם tsconfig משלה, ולכן
 * כל שינוי כאן חייב להיעשות גם שם.
 *
 * כל הערכים מחרוזות בכוונה - FCM מעביר `data` כמפת מחרוזות בלבד,
 * וכל ערך שאינו מחרוזת היה עובר המרה שקטה.
 */
export interface ReminderPushData {
  noteId: string;
  /** המשימה שהתזכורת שייכת לה */
  itemId: string;
  /** כותרת ההתראה - טקסט המשימה */
  title: string;
  /** גוף ההתראה - שם הפתק, כהקשר */
  body: string;
  categoryId: string;
  [key: string]: string;
}
