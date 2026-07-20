/**
 * Hook לבקשת הרשאת התראות ורישום המכשיר
 *
 * נקרא ברגע שהמשתמש קובע שעה למשימה - זו הפעולה שמשמעותה "אני רוצה
 * שיזכירו לי", וזו גם פעולת משתמש אמיתית, מה שהדפדפן דורש כדי להציג
 * בקשת הרשאה.
 *
 * הבקשה מוצגת פעם אחת בלבד לכל מצב: אם המשתמש כבר אישר, `requestNotificationPermission`
 * מחזיר מיד ואין הבהוב מיותר.
 */

import { useCallback, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
  isNotificationSupported,
  requestNotificationPermission,
} from '@/services/notifications/notificationService';
import { registerDeviceForPush } from '@/services/notifications/fcmService';

interface NotificationOptIn {
  /** אזהרה להצגה למשתמש, או `null` כשהכל תקין */
  warning: string | null;
  /** מבקש הרשאה ורושם את המכשיר. בטוח לקריאה חוזרת. */
  ensureEnabled: () => Promise<void>;
}

export const useNotificationOptIn = (): NotificationOptIn => {
  const userId = useAuthStore((state) => state.user?.uid);
  const [warning, setWarning] = useState<string | null>(null);

  const ensureEnabled = useCallback(async () => {
    if (!isNotificationSupported()) {
      setWarning('הדפדפן שלך לא תומך בהתראות. המועד יישמר אך לא תוצג התראה.');
      return;
    }

    const permission = await requestNotificationPermission();

    if (permission !== 'granted') {
      setWarning(
        'ההתראות חסומות בדפדפן. המועד יישמר, אך כדי לקבל התראה יש לאפשר התראות בהגדרות האתר.'
      );
      return;
    }

    setWarning(null);

    if (!userId) return;

    // רישום מיידי: בלעדיו המכשיר לא מוכר לשרת עד הטעינה הבאה של
    // האפליקציה, ותזכורת שנקבעה עכשיו לא הייתה מגיעה לשום מקום.
    const registered = await registerDeviceForPush(userId);
    if (!registered) {
      setWarning('לא הצלחנו לרשום את המכשיר להתראות. המועד יישמר, אך ייתכן שלא תגיע התראה.');
    }
  }, [userId]);

  return { warning, ensureEnabled };
};
