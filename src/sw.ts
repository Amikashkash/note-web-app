/**
 * Service Worker מותאם
 *
 * אחראי על שלושה דברים:
 * 1. קליטת שיתופים נכנסים (Web Share Target)
 * 2. אסטרטגיות cache לנכסים סטטיים
 * 3. תזמון והצגה של התראות תזכורת
 */

/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import type { ReminderMessage, ReminderMessageResult, ScheduledReminder } from './types/reminder';

// ==================== קליטת שיתוף נכנס ====================
// חייב להירשם לפני מסלולי Workbox כדי לתפוס בקשות POST

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'POST' || url.pathname !== '/share') {
    return;
  }

  event.respondWith(
    (async () => {
      const origin = self.location.origin;

      try {
        const formData = await event.request.formData();
        const shareData = {
          title: formData.get('title') ?? '',
          text: formData.get('text') ?? '',
          url: formData.get('url') ?? '',
          timestamp: Date.now(),
        };

        // התוכן המשותף עלול להיות גדול מדי ל-query string, ולכן נשמר
        // ב-cache ומועבר לדף בעזרת מזהה קצר.
        const shareId = `share-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        const cache = await caches.open('share-data-cache');

        await cache.put(
          new Request(`/share-data/${shareId}`),
          new Response(JSON.stringify(shareData), {
            headers: { 'Content-Type': 'application/json' },
          })
        );

        return Response.redirect(`${origin}/share?shareId=${shareId}`, 303);
      } catch (error) {
        console.error('SW: Error handling share POST:', error);
        return Response.redirect(`${origin}/share`, 303);
      }
    })()
  );
});

// ==================== Cache ====================

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ניווטים - רשת תחילה, עם נפילה ל-cache אם הרשת איטית
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'pages-cache',
      networkTimeoutSeconds: 3,
      plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
    })
  )
);

// גופנים של Google - כמעט ולא משתנים
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
  'GET'
);

// קבצים מ-Firebase Storage
registerRoute(
  /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
  new NetworkFirst({
    cacheName: 'firebase-storage-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
  'GET'
);

// שים לב: אין כאן מסלול ל-firestore.googleapis.com בכוונה.
// ה-SDK של Firestore מנהל בעצמו חיבור מתמשך ושכבת מטמון offline משלו,
// ועטיפה שלו ב-Workbox רק פוגעת בסנכרון בזמן אמת. (בגרסה קודמת היה כאן
// מסלול עם `maxEntries: 0` שנועד "לא לשמור" - אבל ערך 0 פשוט מתעלמים
// ממנו, כך שהתגובות דווקא כן נשמרו ב-cache.)

// ==================== התראות ====================

/** טיימרים פעילים, לפי מזהה פתק */
const scheduledTimers = new Map<string, number>();

const showReminderNotification = async (reminder: ScheduledReminder): Promise<void> => {
  try {
    await self.registration.showNotification(reminder.title, {
      body: reminder.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: `note-${reminder.noteId}`,
      requireInteraction: true,
      data: { noteId: reminder.noteId },
      actions: [
        { action: 'open', title: 'פתח פתק' },
        { action: 'close', title: 'סגור' },
      ],
    } as NotificationOptions);
  } catch (error) {
    console.error('SW: Error showing notification:', error);
  }
};

/**
 * מחליף את כל התזכורות המתוזמנות ברשימה חדשה.
 *
 * החלפה מלאה (ולא הוספה/ביטול פרטני) מונעת מצב שבו טיימר של פתק שנמחק
 * או שהתזכורת שלו בוטלה נשאר תלוי ומצוץ בכל זאת.
 */
const syncReminders = (reminders: ScheduledReminder[]): number => {
  for (const timerId of scheduledTimers.values()) {
    clearTimeout(timerId);
  }
  scheduledTimers.clear();

  const now = Date.now();
  let scheduled = 0;

  for (const reminder of reminders) {
    const delay = reminder.reminderTime - now;

    if (delay <= 0) {
      void showReminderNotification(reminder);
      continue;
    }

    const timerId = self.setTimeout(() => {
      scheduledTimers.delete(reminder.noteId);
      void showReminderNotification(reminder);
    }, delay);

    scheduledTimers.set(reminder.noteId, timerId);
    scheduled += 1;
  }

  return scheduled;
};

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const message = event.data as ReminderMessage | undefined;
  if (message?.type !== 'SYNC_REMINDERS') return;

  const scheduled = syncReminders(message.reminders ?? []);

  const result: ReminderMessageResult = { success: true, scheduled };
  event.ports[0]?.postMessage(result);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // אם האפליקציה כבר פתוחה - מעבירים אליה פוקוס במקום לפתוח חלון נוסף
      for (const client of clientList) {
        if (client.url.startsWith(self.registration.scope)) {
          return client.focus();
        }
      }

      await self.clients.openWindow('/');
    })()
  );
});

// ==================== מחזור חיים ====================

self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

export {};
