/**
 * טיפוסים משותפים לאפליקציה ול-Service Worker
 *
 * שני הצדדים מייבאים מכאן, כך ששינוי בפרוטוקול ההודעות נתפס בקומפילציה
 * ולא בזמן ריצה.
 */

/** תזכורת מתוזמנת בודדת */
export interface ScheduledReminder {
  noteId: string;
  title: string;
  body: string;
  /** מועד ההתראה כ-epoch milliseconds */
  reminderTime: number;
}

/** הודעות שהאפליקציה שולחת ל-Service Worker */
export type ReminderMessage = {
  type: 'SYNC_REMINDERS';
  /** רשימת התזכורות הפעילות במלואה - מחליפה את מה שמתוזמן כרגע */
  reminders: ScheduledReminder[];
};

export interface ReminderMessageResult {
  success: boolean;
  scheduled?: number;
}
