/**
 * שירות תזכורות והתראות
 */

import type { Note } from '@/types/note';

/**
 * בקש הרשאה להתראות דפדפן
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

/**
 * בדוק אם הרשאות התראות מופעלות
 */
export const hasNotificationPermission = (): boolean => {
  if (!('Notification' in window)) {
    return false;
  }
  return Notification.permission === 'granted';
};

/**
 * שלח התראה מיידית
 */
export const showNotification = (title: string, options?: NotificationOptions): void => {
  if (!hasNotificationPermission()) {
    console.warn('No notification permission');
    return;
  }

  new Notification(title, {
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    ...options,
  });
};

/**
 * תזמן התראה לפתק
 */
export const scheduleNoteReminder = (note: Note): void => {
  if (!note.reminderTime || !note.reminderEnabled) {
    return;
  }

  const reminderDate = note.reminderTime.toDate();
  const now = new Date();
  const timeUntilReminder = reminderDate.getTime() - now.getTime();

  // אם התזכורת עברה, אל תתזמן
  if (timeUntilReminder <= 0) {
    console.warn('Reminder time has passed');
    return;
  }

  // תזמן התראה (עד 24 שעות מראש)
  if (timeUntilReminder <= 24 * 60 * 60 * 1000) {
    const timerId = setTimeout(() => {
      showNotification(note.title, {
        body: note.content.substring(0, 100),
        tag: `note-${note.id}`,
        requireInteraction: true,
        data: { noteId: note.id },
      });

      // הסר מ-localStorage
      removeScheduledReminder(note.id);
    }, timeUntilReminder) as unknown as number;

    // שמור timer ID ב-localStorage
    saveScheduledReminder(note.id, timerId, reminderDate);
  }
};

/**
 * בטל תזכורת מתוזמנת
 */
export const cancelNoteReminder = (noteId: string): void => {
  const reminders = getScheduledReminders();
  const reminder = reminders[noteId];

  if (reminder) {
    clearTimeout(reminder.timerId);
    removeScheduledReminder(noteId);
  }
};

/**
 * שמור תזכורת מתוזמנת ב-localStorage
 */
const saveScheduledReminder = (noteId: string, timerId: number, reminderDate: Date): void => {
  const reminders = getScheduledReminders();
  reminders[noteId] = {
    timerId,
    reminderDate: reminderDate.toISOString(),
  };
  localStorage.setItem('scheduledReminders', JSON.stringify(reminders));
};

/**
 * הסר תזכורת מתוזמנת מ-localStorage
 */
const removeScheduledReminder = (noteId: string): void => {
  const reminders = getScheduledReminders();
  delete reminders[noteId];
  localStorage.setItem('scheduledReminders', JSON.stringify(reminders));
};

/**
 * קבל כל התזכורות המתוזמנות
 */
const getScheduledReminders = (): Record<string, { timerId: number; reminderDate: string }> => {
  const stored = localStorage.getItem('scheduledReminders');
  return stored ? JSON.parse(stored) : {};
};

/**
 * אתחל מחדש תזכורות בעת טעינת האפליקציה
 */
export const reinitializeReminders = (notes: Note[]): void => {
  // נקה תזכורות ישנות
  const reminders = getScheduledReminders();
  Object.keys(reminders).forEach((noteId) => {
    clearTimeout(reminders[noteId].timerId);
  });
  localStorage.removeItem('scheduledReminders');

  // תזמן מחדש תזכורות פעילות
  notes.forEach((note) => {
    if (note.reminderEnabled && note.reminderTime) {
      scheduleNoteReminder(note);
    }
  });
};

/**
 * בדוק ותזמן תזכורות שמגיעות בקרוב (כל 5 דקות)
 */
export const startReminderChecker = (notes: Note[]): NodeJS.Timeout => {
  // תזמן מחדש בעת אתחול
  reinitializeReminders(notes);

  // בדוק כל 5 דקות
  return setInterval(() => {
    reinitializeReminders(notes);
  }, 5 * 60 * 1000); // 5 minutes
};
