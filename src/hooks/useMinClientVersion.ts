/**
 * קריאת `config/app.minClientVersion` (D4a): בפתיחה (מאזין חי), בחזרה
 * לאפליקציה שהייתה ברקע, ובחזרת החיבור. נקרא פעם אחת, מ-`App`.
 *
 * המאזין לבדו כמעט מספיק, אבל אחרי שינה ארוכה של הטלפון הוא עלול להחזיק
 * ערך ישן עד שיתחבר מחדש. הקריאה מהשרת בחזרה ובחזרת החיבור סוגרת את
 * הפער, כדי שהחסימה תיכנס **לפני** שהמשתמש מתחיל לערוך.
 *
 * כישלון בקריאה (offline, רשת) לא משנה את המצב: נשארים עם הערך האחרון
 * שנקרא, ובפתיחה ראשונה בלי רשת - בלי חסימה (ראו CLAUDE_GUIDELINES).
 */

import { useEffect } from 'react';
import { fetchMinClientVersion, subscribeToMinClientVersion } from '@/services/api/appConfig';
import { useAppVersionStore } from '@/store/appVersionStore';
import { logger } from '@/utils/logger';

export const useMinClientVersion = (): void => {
  const setMinClientVersion = useAppVersionStore((state) => state.setMinClientVersion);

  useEffect(() => {
    const unsubscribe = subscribeToMinClientVersion(setMinClientVersion, (error) =>
      logger.warn('Could not read config/app:', error)
    );

    const recheck = () => {
      if (document.visibilityState !== 'visible') return;
      fetchMinClientVersion()
        .then(setMinClientVersion)
        .catch((error: unknown) => logger.debug('config/app recheck failed (offline?):', error));
    };
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('online', recheck);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('online', recheck);
    };
  }, [setMinClientVersion]);
};
