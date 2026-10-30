/**
 * התנתקות שלא זורקת שינויים (v1.35.0): ההחלטה. התצוגה ב-`SignOutDialog`.
 * קודם מחכים שהכתיבות הממתינות יגיעו לשרת; אם לא - המשתמש בוחר.
 */

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/services/firebase/config';
import { pendingWritesSettle } from '@/services/firebase/localData';

type Phase = 'idle' | 'checking' | 'pending' | 'leaving';

export const useSafeSignOut = () => {
  const { signOut } = useAuth();
  const [phase, setPhase] = useState<Phase>('idle');

  const leave = async (keepLocalData: boolean) => {
    setPhase('leaving');
    try {
      await signOut({ keepLocalData });
    } finally {
      // מחיקה טוענת את הדף מחדש; אם נשארנו כאן - השארנו נתונים, או שנכשל
      setPhase('idle');
    }
  };

  const start = async () => {
    setPhase('checking');
    if (await pendingWritesSettle(db)) await leave(false);
    else setPhase('pending');
  };

  return {
    phase,
    start,
    stay: () => setPhase('idle'),
    keepAndLeave: () => leave(true),
    deleteAndLeave: () => leave(false),
  };
};
