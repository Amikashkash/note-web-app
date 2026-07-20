/**
 * חוזה ההתראות בין השרת, ה-Service Worker והאפליקציה
 *
 * התזמון מתבצע בפונקציה מתוזמנת בענן (`functions/src/index.ts`), שמעירה
 * את המכשיר ב-push. ה-Service Worker רק מקבל ומציג - הוא לא מתזמן כלום.
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
  title: string;
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
