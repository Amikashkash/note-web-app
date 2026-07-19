/**
 * Hook לסנכרון תזכורות הפתקים אל ה-Service Worker
 *
 * מופעל פעם אחת מ-`App`. בכל שינוי ברשימת התזכורות הפעילות נשלחת
 * הרשימה המלאה ל-Service Worker, שמחליף את מה שמתוזמן אצלו.
 */

import { useEffect, useMemo } from 'react';
import { useNotes } from './useNotes';
import { hasNotificationPermission, syncReminders } from '@/services/notifications/notificationService';
import type { ScheduledReminder } from '@/types/reminder';

/** אורך מקסימלי לגוף ההתראה */
const BODY_PREVIEW_LENGTH = 100;

export const useNoteReminders = (): void => {
  const { allNotes } = useNotes();

  const activeReminders = useMemo<ScheduledReminder[]>(() => {
    const now = Date.now();

    return allNotes
      .filter((note) => note.reminderEnabled && note.reminderTime)
      .map((note) => ({
        noteId: note.id,
        title: note.title,
        body: note.content.slice(0, BODY_PREVIEW_LENGTH),
        reminderTime: note.reminderTime!.toMillis(),
      }))
      // תזכורות שמועדן חלף כבר לא רלוונטיות לתזמון
      .filter((reminder) => reminder.reminderTime > now);
  }, [allNotes]);

  // מפתח יציב לתוכן התזכורות: מונע שליחה מחדש בכל רינדור
  // כשהרשימה נבנתה מחדש אך תוכנה זהה.
  const remindersKey = useMemo(
    () =>
      activeReminders
        .map((reminder) => `${reminder.noteId}:${reminder.reminderTime}:${reminder.title}`)
        .sort()
        .join('|'),
    [activeReminders]
  );

  useEffect(() => {
    if (!hasNotificationPermission()) return;

    void syncReminders(activeReminders);
    // `activeReminders` מושמט בכוונה - `remindersKey` מייצג את תוכנו,
    // והוא זה שקובע מתי באמת צריך לסנכרן מחדש.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remindersKey]);
};
