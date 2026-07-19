/**
 * שירות תזכורות והתראות
 *
 * התזמון עצמו מתבצע ב-Service Worker (ראה `src/sw.ts`), כי הוא ממשיך
 * לפעול גם כשהטאב לא בפוקוס. השירות כאן אחראי רק על:
 * בדיקת תמיכה והרשאות, ושליחת רשימת התזכורות הפעילות ל-SW.
 *
 * מגבלה ידועה: הדפדפן רשאי לכבות Service Worker לא פעיל, ואז טיימרים
 * שממתינים מתאפסים. התזכורות מסונכרנות מחדש בכל טעינת אפליקציה ובכל
 * שינוי בפתקים, כך שהמצב מתקן את עצמו - אבל תזכורת למועד רחוק עלולה
 * לא לצוץ אם האפליקציה לא נפתחה בינתיים. פתרון מלא דורש Push מהשרת.
 */

import type { ReminderMessage, ReminderMessageResult, ScheduledReminder } from '@/types/reminder';
import { logger } from '@/utils/logger';

/** זמן המתנה מקסימלי לתשובה מה-Service Worker */
const SW_RESPONSE_TIMEOUT_MS = 5000;

export const isNotificationSupported = (): boolean =>
  typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;

export const getNotificationPermission = (): NotificationPermission =>
  isNotificationSupported() ? Notification.permission : 'denied';

export const hasNotificationPermission = (): boolean =>
  getNotificationPermission() === 'granted';

/**
 * בקשת הרשאה להתראות.
 * מחזיר את הסטטוס ולא מציג הודעות בעצמו - הצגת המשוב היא באחריות הממשק.
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!isNotificationSupported()) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;

  try {
    return await Notification.requestPermission();
  } catch (error) {
    logger.error('Error requesting notification permission:', error);
    return 'denied';
  }
};

/**
 * שליחת הודעה ל-Service Worker והמתנה לאישור
 */
const sendToServiceWorker = async (
  message: ReminderMessage
): Promise<ReminderMessageResult> => {
  if (!('serviceWorker' in navigator)) {
    return { success: false };
  }

  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.ready;
  } catch (error) {
    logger.error('Service Worker not ready:', error);
    return { success: false };
  }

  const worker = registration.active;
  if (!worker) {
    logger.warn('No active Service Worker');
    return { success: false };
  }

  return new Promise<ReminderMessageResult>((resolve) => {
    const channel = new MessageChannel();

    // מבטיחים שהתשובה תיפתר פעם אחת בלבד ושהטיימר תמיד ינוקה,
    // כדי לא להשאיר טיימרים תלויים אחרי שהתקבלה תשובה.
    const timeoutId = setTimeout(() => {
      logger.warn('Service Worker did not respond in time');
      settle({ success: false });
    }, SW_RESPONSE_TIMEOUT_MS);

    let settled = false;
    const settle = (result: ReminderMessageResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      channel.port1.close();
      resolve(result);
    };

    channel.port1.onmessage = (event: MessageEvent<ReminderMessageResult>) => {
      settle(event.data ?? { success: false });
    };

    worker.postMessage(message, [channel.port2]);
  });
};

/**
 * סנכרון רשימת התזכורות הפעילות אל ה-Service Worker.
 * הרשימה מחליפה במלואה את מה שמתוזמן כרגע, כך שאין צורך
 * לעקוב אחרי ביטולים בנפרד.
 */
export const syncReminders = async (reminders: ScheduledReminder[]): Promise<boolean> => {
  if (!hasNotificationPermission()) {
    logger.debug('Skipping reminder sync - no notification permission');
    return false;
  }

  const result = await sendToServiceWorker({ type: 'SYNC_REMINDERS', reminders });

  if (result.success) {
    logger.debug(`Synced ${result.scheduled ?? 0} reminders to Service Worker`);
  }

  return result.success;
};
