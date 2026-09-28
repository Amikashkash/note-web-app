/**
 * סימון "הפתק פתוח כאן" ורשימת העורכים הפתוחים האחרים.
 *
 * - בפתיחה: סימון. כל 30 שניות: רענון, רק כשהטאב גלוי (מסך כבוי או טאב
 *   ברקע לא כותבים; הסימון פג אחרי דקה, וחוזר מיד כשחוזרים לטאב).
 * - בסגירה ובעזיבת הדף: מחיקה. אם לא הספיקה - הסימון פג לבד.
 * - תקלה בכתיבה (offline, אין הרשאה) לא מפריעה לעריכה: זו שכבת נוחות.
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { announcePresence, leavePresence, subscribeToPresence } from '@/services/api/notePresence';
import { logger } from '@/utils/logger';
import { activeOthers, deviceLabel, PRESENCE_REFRESH_MS, type PresenceEntry } from '@/utils/presence';

/**
 * מזהה הסימון: קבוע לטאב ולפתק (sessionStorage), כדי שרענון הדף יחליף את
 * הסימון שלו ולא ישאיר סימון "יתום" שנראה כמו "פתוח במחשב אחר שלך" עד
 * שיפוג. טאב אחר (או מכשיר אחר) - מזהה אחר.
 */
const sessionIdFor = (noteId: string): string => {
  const key = `notePresence:${noteId}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
};

export const useNotePresence = (noteId: string): { others: PresenceEntry[]; myUid: string | null } => {
  const uid = useAuthStore((state) => state.user?.uid ?? null);
  const sessionId = useMemo(() => sessionIdFor(noteId), [noteId]);
  const [entries, setEntries] = useState<PresenceEntry[]>([]);
  const [now, setNow] = useState(() => Date.now());

  // הסימון שלנו
  useEffect(() => {
    if (!uid) return;
    const device = deviceLabel(navigator.userAgent);
    let timer: ReturnType<typeof setInterval> | null = null;

    const announce = () =>
      announcePresence(noteId, sessionId, uid, device).catch((error) =>
        logger.debug('Presence announce failed (ignored):', error)
      );
    const leave = () => leavePresence(noteId, sessionId).catch(() => undefined);

    const start = () => {
      if (timer !== null) return;
      void announce();
      timer = setInterval(announce, PRESENCE_REFRESH_MS);
    };
    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', leave);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', leave);
      void leave();
    };
  }, [noteId, sessionId, uid]);

  // הסימונים של כולם
  useEffect(() => {
    if (!uid) return;
    return subscribeToPresence(noteId, setEntries, (error) => logger.debug('Presence listener failed:', error));
  }, [noteId, uid]);

  // סימון שהפסיק להתרענן צריך להיעלם גם בלי שינוי במסמכים
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(tick);
  }, []);

  return { others: activeOthers(entries, sessionId, now), myUid: uid };
};
