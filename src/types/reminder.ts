/**
 * חוזה ההתראות בין השרת, ה-Service Worker והאפליקציה
 *
 * תזכורת שייכת למשימה בודדת ברשימת משימות, לא לפתק. טריגר בענן
 * (`functions/src/index.ts`) מתחזק מסמך תזכורת לכל משימה שיש לה תאריך
 * ושעה, ופונקציה מתוזמנת שולחת push במועד. ה-Service Worker רק מציג.
 *
 * שים לב: `functions/src/reminderPayload.ts` הוא מראה של `ReminderPushData`,
 * כי `functions/` היא חבילה נפרדת שלא יכולה לייבא מכאן. שינוי כאן מחייב
 * שינוי מקביל שם.
 */

/**
 * גוף ההתראה כפי שהוא מגיע ב-push.
 * כל השדות מחרוזות - FCM מעביר `data` כמפת מחרוזות בלבד.
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
}

/**
 * המעטפת ש-FCM עוטף בה הודעות data-only.
 * ה-SW מטפל באירוע `push` הגולמי ולכן רואה את המעטפת, לא רק את התוכן.
 */
export interface FcmPushEnvelope {
  data?: Partial<ReminderPushData>;
}
