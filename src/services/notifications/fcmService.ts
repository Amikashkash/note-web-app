/**
 * רישום המכשיר לקבלת התראות push
 *
 * כל מכשיר של המשתמש מקבל token מ-FCM ונשמר תחת
 * `users/{uid}/fcmTokens/{tokenId}`. הפונקציה המתוזמנת בענן שולפת משם
 * את היעדים כשמגיע מועד תזכורת.
 */

import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, isPushConfigured, vapidKey } from '@/services/firebase/config';
import { hasNotificationPermission } from './notificationService';
import { logger } from '@/utils/logger';

/**
 * ה-token משמש כמזהה המסמך כדי שרישום חוזר של אותו מכשיר יידרוס את
 * הרשומה הקיימת במקום לייצר כפילויות. הוא מקודד כי מזהה מסמך ב-Firestore
 * לא יכול להכיל '/', ו-token מבוסס base64 עלול להכיל אותו.
 */
const toTokenDocId = (token: string): string => encodeURIComponent(token);

const tokenDocRef = (userId: string, token: string) =>
  doc(db, 'users', userId, 'fcmTokens', toTokenDocId(token));

/**
 * שליפת ה-token של המכשיר הנוכחי.
 * מחזיר `null` כשההתראות לא נתמכות, לא מורשות או לא מוגדרות.
 */
const getDeviceToken = async (): Promise<string | null> => {
  if (!isPushConfigured) {
    logger.warn('Push notifications are not configured - VITE_FIREBASE_VAPID_KEY is missing');
    return null;
  }

  if (!hasNotificationPermission()) return null;
  if (!(await isSupported())) {
    logger.debug('Firebase Messaging is not supported in this browser');
    return null;
  }

  try {
    // ה-SW נרשם על ידי vite-plugin-pwa. מוסרים אותו במפורש כדי ש-FCM
    // ישתמש בו במקום לחפש `firebase-messaging-sw.js` שלא קיים כאן.
    const registration = await navigator.serviceWorker.ready;

    const token = await getToken(getMessaging(), {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    return token || null;
  } catch (error) {
    logger.error('Error retrieving FCM token:', error);
    return null;
  }
};

/**
 * רישום המכשיר הנוכחי לקבלת התראות עבור המשתמש.
 * בטוח לקריאה חוזרת - אותו מכשיר תמיד נכתב לאותו מסמך.
 */
export const registerDeviceForPush = async (userId: string): Promise<boolean> => {
  const token = await getDeviceToken();
  if (!token) return false;

  try {
    await setDoc(
      tokenDocRef(userId, token),
      {
        token,
        userAgent: navigator.userAgent,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    logger.debug('Device registered for push notifications');
    return true;
  } catch (error) {
    logger.error('Error saving FCM token:', error);
    return false;
  }
};

/**
 * ביטול רישום המכשיר.
 *
 * נקרא בהתנתקות: בלי זה, מכשיר משותף היה ממשיך לקבל את התזכורות של
 * המשתמש הקודם גם אחרי שמשתמש אחר התחבר בו.
 */
export const unregisterDeviceForPush = async (userId: string): Promise<void> => {
  if (!isPushConfigured) return;

  try {
    if (!(await isSupported())) return;

    const messaging = getMessaging();
    const registration = await navigator.serviceWorker.ready;

    // קוראים את ה-token לפני המחיקה מ-FCM, כדי לדעת איזה מסמך למחוק
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      await deleteDoc(tokenDocRef(userId, token)).catch((error) => {
        logger.warn('Could not delete FCM token document:', error);
      });
      await deleteToken(messaging);
    }
  } catch (error) {
    // כישלון כאן לא צריך לחסום התנתקות
    logger.warn('Error unregistering device for push:', error);
  }
};
