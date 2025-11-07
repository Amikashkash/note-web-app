/**
 * שירות תזכורות והתראות - Service Worker Based
 * Uses Service Worker for more reliable notification support in PWA
 */

import type { Note } from '@/types/note';

/**
 * Get the active Service Worker registration
 */
const getServiceWorkerRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) {
    console.warn('❌ Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    console.log('✅ Service Worker ready:', registration);
    return registration;
  } catch (error) {
    console.error('❌ Error getting Service Worker registration:', error);
    return null;
  }
};

/**
 * Send a message to the Service Worker
 */
const sendMessageToServiceWorker = async (
  type: string,
  data: any
): Promise<{ success: boolean }> => {
  const registration = await getServiceWorkerRegistration();

  if (!registration || !registration.active) {
    console.error('❌ No active Service Worker');
    return { success: false };
  }

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();

    messageChannel.port1.onmessage = (event) => {
      resolve(event.data);
    };

    if (registration.active) {
      registration.active.postMessage(
        { type, data },
        [messageChannel.port2]
      );
    } else {
      resolve({ success: false });
      return;
    }

    // Timeout after 5 seconds
    setTimeout(() => {
      resolve({ success: false });
    }, 5000);
  });
};

/**
 * בקש הרשאה להתראות דפדפן
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.warn('❌ This browser does not support notifications');
    alert('הדפדפן שלך לא תומך בהתראות. נסה Chrome, Edge או Firefox.');
    return false;
  }

  // Check if Service Worker is available
  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    console.warn('❌ Service Worker not available for notifications');
    alert('אין תמיכה בהתראות. אנא וודא ש-Service Worker פעיל.');
    return false;
  }

  console.log('🔔 Current notification permission:', Notification.permission);

  if (Notification.permission === 'granted') {
    console.log('✅ Notification permission already granted');

    // Show test notification
    try {
      await registration.showNotification('✅ התראות מופעלות', {
        body: 'התראות עובדות כעת! תקבל התראה כשתזכורת מגיעה.',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'test-notification',
        requireInteraction: false,
      });

      // Auto-close test notification after 3 seconds
      setTimeout(async () => {
        const notifications = await registration.getNotifications({ tag: 'test-notification' });
        notifications.forEach(notification => notification.close());
      }, 3000);
    } catch (error) {
      console.error('❌ Test notification failed:', error);
    }

    return true;
  }

  if (Notification.permission !== 'denied') {
    console.log('🔔 Requesting notification permission...');
    const permission = await Notification.requestPermission();
    console.log('🔔 Permission result:', permission);

    if (permission === 'granted') {
      console.log('✅ Permission granted!');

      // Show test notification
      try {
        await registration.showNotification('✅ התראות מופעלות', {
          body: 'התראות עובדות כעת! תקבל התראה כשתזכורת מגיעה.',
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: 'test-notification',
          requireInteraction: false,
        });

        // Auto-close test notification after 3 seconds
        setTimeout(async () => {
          const notifications = await registration.getNotifications({ tag: 'test-notification' });
          notifications.forEach(notification => notification.close());
        }, 3000);
      } catch (error) {
        console.error('❌ Test notification failed:', error);
      }

      return true;
    } else {
      console.warn('⚠️ Permission denied or dismissed');
      alert('התראות נדחו. כדי לקבל התראות, עליך לאשר בהגדרות הדפדפן.');
      return false;
    }
  }

  console.warn('❌ Notification permission was previously denied');
  alert('התראות נחסמו. אנא אפשר התראות בהגדרות הדפדפן.');
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
 * שלח התראה מיידית באמצעות Service Worker
 */
export const showNotification = async (
  title: string,
  options?: {
    body?: string;
    tag?: string;
    data?: any;
  }
): Promise<void> => {
  if (!hasNotificationPermission()) {
    console.warn('❌ No notification permission');
    console.warn('💡 Current permission status:', Notification.permission);
    return;
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    console.error('❌ No Service Worker registration');
    return;
  }

  console.log('🔔 Showing notification via Service Worker:', title);

  try {
    await registration.showNotification(title, {
      body: options?.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: options?.tag || `notification-${Date.now()}`,
      requireInteraction: false,
      silent: false,
      data: options?.data || {},
    } as NotificationOptions);

    console.log('✅ Notification shown successfully');
  } catch (error) {
    console.error('❌ Failed to show notification:', error);
  }
};

/**
 * תזמן התראה לפתק באמצעות Service Worker
 */
export const scheduleNoteReminder = async (note: Note): Promise<void> => {
  if (!note.reminderTime || !note.reminderEnabled) {
    console.log('⏭️ Skipping note (no reminder):', note.title);
    return;
  }

  const reminderDate = note.reminderTime.toDate();
  const now = new Date();
  const timeUntilReminder = reminderDate.getTime() - now.getTime();

  console.log('⏰ Scheduling reminder for:', note.title);
  console.log('  - Reminder date:', reminderDate.toLocaleString('he-IL'));
  console.log('  - Time until reminder:', Math.round(timeUntilReminder / 1000 / 60), 'minutes');

  // אם התזכורת עברה, אל תתזמן
  if (timeUntilReminder <= 0) {
    console.warn('⚠️ Reminder time has passed for:', note.title);
    return;
  }

  // Check permission
  if (!hasNotificationPermission()) {
    console.warn('❌ No notification permission');
    return;
  }

  // Send to Service Worker for scheduling
  const result = await sendMessageToServiceWorker('SCHEDULE_REMINDER', {
    noteId: note.id,
    title: note.title,
    body: note.content.substring(0, 100),
    reminderTime: reminderDate.getTime(),
  });

  if (result.success) {
    console.log('✅ Reminder scheduled successfully in Service Worker');
    // Save to localStorage as backup
    saveScheduledReminder(note.id, reminderDate);
  } else {
    console.error('❌ Failed to schedule reminder in Service Worker');
  }
};

/**
 * בטל תזכורת מתוזמנת
 */
export const cancelNoteReminder = async (noteId: string): Promise<void> => {
  console.log('🗑️ Cancelling reminder for note:', noteId);

  // Send to Service Worker
  const result = await sendMessageToServiceWorker('CANCEL_REMINDER', {
    noteId,
  });

  if (result.success) {
    console.log('✅ Reminder cancelled in Service Worker');
  }

  // Remove from localStorage
  removeScheduledReminder(noteId);
};

/**
 * שמור תזכורת מתוזמנת ב-localStorage (backup)
 */
const saveScheduledReminder = (noteId: string, reminderDate: Date): void => {
  const reminders = getScheduledReminders();
  reminders[noteId] = {
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
const getScheduledReminders = (): Record<string, { reminderDate: string }> => {
  const stored = localStorage.getItem('scheduledReminders');
  return stored ? JSON.parse(stored) : {};
};

/**
 * אתחל מחדש תזכורות בעת טעינת האפליקציה
 * Re-schedules all active reminders in the Service Worker
 */
export const reinitializeReminders = async (notes: Note[]): Promise<void> => {
  console.log('🔄 Reinitializing reminders...');

  // Clear old reminders from localStorage
  localStorage.removeItem('scheduledReminders');

  // Re-schedule all active reminders
  const schedulePromises = notes
    .filter((note) => note.reminderEnabled && note.reminderTime)
    .map((note) => scheduleNoteReminder(note));

  await Promise.all(schedulePromises);

  console.log(`✅ Reinitialized ${schedulePromises.length} reminders`);
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
