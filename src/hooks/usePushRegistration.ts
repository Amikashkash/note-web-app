/**
 * Hook לרישום המכשיר לקבלת התראות push
 *
 * מופעל פעם אחת מ-`App`. רושם את המכשיר בכל התחברות, כי ה-token של FCM
 * מתחלף מדי פעם (ניקוי נתוני אתר, החלפת מכשיר, סבב מפתחות של הדפדפן) -
 * רישום חוזר מוודא שהרשומה בשרת תמיד מצביעה על ה-token הפעיל.
 *
 * אם ההרשאה טרם ניתנה אין מה לעשות כאן. הרישום יקרה ברגע שהמשתמש
 * יאשר התראות ב-`ReminderPicker`.
 */

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { registerDeviceForPush } from '@/services/notifications/fcmService';
import { hasNotificationPermission } from '@/services/notifications/notificationService';

export const usePushRegistration = (): void => {
  const userId = useAuthStore((state) => state.user?.uid);

  useEffect(() => {
    if (!userId) return;
    if (!hasNotificationPermission()) return;

    void registerDeviceForPush(userId);
  }, [userId]);
};
