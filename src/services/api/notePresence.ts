/**
 * סימוני "הפתק פתוח" ב-Firestore (`notes/{noteId}/presence/{sessionId}`).
 *
 * עלות, כשפתק פתוח (הכל ב-`useNotePresence`):
 * - כתיבה אחת בפתיחה, אחת כל 30 שניות **רק כשהטאב גלוי**, ומחיקה בסגירה.
 *   ה-rules קוראים את הפתק בכל כתיבה (`get`), כלומר עוד קריאה לכל אחת.
 * - מאזין אחד לסימונים של הפתק: קריאה בפתיחה ועוד אחת לכל רענון של
 *   עורך פתוח (כולל שלנו).
 * פתק פתוח 5 דקות: בערך 12 כתיבות ו-25 קריאות. זניח בהיקף אישי.
 *
 * בנוסף, "מקליד עכשיו" (`typedAt`, v1.39.0): כתיבה אחת לכל היותר כל 15
 * שניות בזמן הקלדה (`utils/presence.ts`). דקה של הקלדה = 4 כתיבות, ועוד 4
 * קריאות של ה-rules ו-4 עדכונים למאזינים. בלי הקלדה - אפס.
 *
 * סימון שלא נמחק (טאב שנהרג) פשוט מפסיק להתרענן, ונחשב סגור אחרי דקה.
 * `expiresAt` הוא רק לניקוי (TTL). הזמן הקובע הוא `refreshedAt` של השרת,
 * ולחסימת Claude - `typedAt`.
 */

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import { PRESENCE_TTL_MS, type PresenceEntry } from '@/utils/presence';

const presenceRef = (noteId: string, sessionId: string) => doc(db, 'notes', noteId, 'presence', sessionId);

/**
 * `merge`: הרענון לא מוחק את `typedAt` - אחרת רענון שקורה בזמן הקלדה היה
 * משחרר את החסימה של Claude מוקדם מדי.
 */
export const announcePresence = (noteId: string, sessionId: string, uid: string, device: string): Promise<void> =>
  setDoc(
    presenceRef(noteId, sessionId),
    {
      uid,
      device,
      refreshedAt: serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + PRESENCE_TTL_MS),
    },
    { merge: true }
  );

/** "מקליד עכשיו": גם מרענן את הסימון. זמן השרת - ה-rules לא מקבלים זמן אחר */
export const signalTyping = (noteId: string, sessionId: string, uid: string, device: string): Promise<void> =>
  setDoc(
    presenceRef(noteId, sessionId),
    {
      uid,
      device,
      refreshedAt: serverTimestamp(),
      typedAt: serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + PRESENCE_TTL_MS),
    },
    { merge: true }
  );

export const leavePresence = (noteId: string, sessionId: string): Promise<void> =>
  deleteDoc(presenceRef(noteId, sessionId));

export const subscribeToPresence = (
  noteId: string,
  onChange: (entries: PresenceEntry[]) => void,
  onError: (error: unknown) => void
): Unsubscribe =>
  onSnapshot(
    collection(db, 'notes', noteId, 'presence'),
    (snapshot) =>
      onChange(
        snapshot.docs.map((entry) => {
          const refreshedAt = entry.get('refreshedAt');
          return {
            sessionId: entry.id,
            uid: String(entry.get('uid') ?? ''),
            device: String(entry.get('device') ?? ''),
            refreshedAt: refreshedAt instanceof Timestamp ? refreshedAt.toDate() : null,
          };
        })
      ),
    onError
  );
