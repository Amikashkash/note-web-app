/**
 * בדיקת תמיכה והרשאות להתראות
 *
 * התזמון עצמו לא מתבצע כאן ולא בדפדפן בכלל: פונקציה מתוזמנת בענן
 * (`functions/src/index.ts`) שולחת push במועד התזכורת, וה-Service Worker
 * מציג אותו. הרישום של המכשיר ל-push נמצא ב-`fcmService`.
 */

import { logger } from '@/utils/logger';

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
