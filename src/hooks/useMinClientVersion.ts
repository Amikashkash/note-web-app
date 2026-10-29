/**
 * קריאת `config/app.minClientVersion` (D4a). נקרא פעם אחת, מ-`App`.
 *
 * שני מקורות:
 * - **מאזין חי**: תופס שינוי תוך שניות כשהחיבור תקין.
 * - **קריאה מהשרת** (`utils/minVersionChecker.ts`): בפתיחה, בכל חזרה
 *   לאפליקציה, בחזרת החיבור, כל כמה דקות כשהדף גלוי, ולפני כתיבה כשהבדיקה
 *   האחרונה ישנה. כישלון → ניסיון חוזר.
 *
 * עד v1.33.1 הייתה קריאה אחת בחזרה, בלי ניסיון חוזר. אחרי שינה של הטלפון
 * היא נכשלה בשקט (החיבור של Firestore עוד לא קם), והמאזין התעורר רק אחרי
 * backoff ארוך - והחסימה לא הופיעה. ראו שם.
 *
 * אירועי "חזרה": `visibilitychange` לגלוי, `pageshow` (שחזור מ-bfcache,
 * ובחלק מגרסאות iOS במקום visibilitychange), `focus`, ו-`resume` (Chrome,
 * אחרי `freeze`). כמה מהם מגיעים יחד; הבודק מאחד אותם.
 *
 * כישלון בקריאה לא משנה את המצב: נשארים עם הערך האחרון שנקרא, ובפתיחה
 * ראשונה בלי רשת - בלי חסימה (ראו CLAUDE_GUIDELINES).
 */

import { useEffect } from 'react';
import { fetchMinClientVersion, subscribeToMinClientVersion } from '@/services/api/appConfig';
import { useAppVersionStore } from '@/store/appVersionStore';
import { createMinVersionChecker } from '@/utils/minVersionChecker';
import { logger } from '@/utils/logger';

export const useMinClientVersion = (): void => {
  useEffect(() => {
    const { setMinClientVersion, recordCheck } = useAppVersionStore.getState();

    const unsubscribe = subscribeToMinClientVersion(setMinClientVersion, (error) =>
      logger.warn('Could not read config/app:', error)
    );

    const checker = createMinVersionChecker({
      fetch: fetchMinClientVersion,
      onValue: setMinClientVersion,
      onResult: ({ ok, at, reason }) => {
        recordCheck({ ok, at });
        if (!ok) logger.debug(`config/app check failed (${reason}), will retry`);
      },
      isVisible: () => document.visibilityState === 'visible',
      now: () => Date.now(),
      setTimer: (callback, ms) => window.setTimeout(callback, ms),
      clearTimer: (handle) => window.clearTimeout(handle as number),
    });

    const onResume = () => {
      if (document.visibilityState === 'visible') checker.check('resume');
    };
    const onOnline = () => checker.check('online');

    document.addEventListener('visibilitychange', onResume);
    document.addEventListener('resume', onResume);
    window.addEventListener('pageshow', onResume);
    window.addEventListener('focus', onResume);
    window.addEventListener('online', onOnline);
    useAppVersionStore.setState({ onWriteAttempt: () => checker.check('write') });
    checker.check('start');

    return () => {
      unsubscribe();
      checker.stop();
      document.removeEventListener('visibilitychange', onResume);
      document.removeEventListener('resume', onResume);
      window.removeEventListener('pageshow', onResume);
      window.removeEventListener('focus', onResume);
      window.removeEventListener('online', onOnline);
      useAppVersionStore.setState({ onWriteAttempt: () => {} });
    };
  }, []);
};
