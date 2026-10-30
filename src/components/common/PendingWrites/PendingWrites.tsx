/**
 * "ממתין לחיבור" (v1.35.0): יש שינויים בפתקים שעוד לא הגיעו לשרת. הם שמורים
 * במכשיר (persistence) ויישלחו כשהחיבור יחזור, גם אם האפליקציה תיסגר.
 * פשוט בכוונה - שורת המצב המלאה בעורך היא צעד 6 בסבב 2.
 */

import { useEffect, useState } from 'react';
import { CloudOff } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { subscribeToPendingNoteWrites } from '@/services/api/notes';
import { createDelayedFlag } from '@/utils/delayedFlag';
import { PENDING_WRITES_BADGE_DELAY_MS } from '@/utils/constants';

export const PendingWrites: React.FC = () => {
  const uid = useAuthStore((state) => state.user?.uid);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const flag = createDelayedFlag({
      delayMs: PENDING_WRITES_BADGE_DELAY_MS,
      onChange: setShown,
      setTimer: (callback, ms) => window.setTimeout(callback, ms),
      clearTimer: (handle) => window.clearTimeout(handle as number),
    });
    const unsubscribe = subscribeToPendingNoteWrites(uid, flag.set);
    return () => {
      unsubscribe();
      flag.stop();
      setShown(false);
    };
  }, [uid]);

  if (!shown) return null;

  return (
    <div
      role="status"
      dir="rtl"
      className="fixed bottom-4 inset-x-0 mx-auto w-fit z-[90] flex items-center gap-2 px-4 py-2 rounded-full shadow-lg bg-slate-800 text-white text-sm dark:bg-slate-200 dark:text-slate-900"
    >
      <CloudOff size={16} strokeWidth={2} aria-hidden />
      ממתין לחיבור · השינויים שמורים במכשיר
    </div>
  );
};
