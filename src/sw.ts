/**
 * Service Worker מותאם
 *
 * אחראי על שלושה דברים:
 * 1. קליטת שיתופים נכנסים (Web Share Target)
 * 2. אסטרטגיות cache לנכסים סטטיים
 * 3. הצגת התראות תזכורת שמגיעות ב-push
 */

/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import type { FcmPushEnvelope, ReminderPushData } from './types/reminder';

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
//
// ה-SW לא מתזמן דבר. תזמון מקומי (setTimeout) לא עובד כאן: הדפדפן הורג
// Service Worker לא פעיל אחרי שניות, ואיתו כל טיימר ממתין. במקום זאת
// פונקציה מתוזמנת בענן שולחת push במועד, וכאן רק מציגים אותו.

const showReminderNotification = async (data: ReminderPushData): Promise<void> => {
  try {
    await self.registration.showNotification(data.title || 'תזכורת', {
      body: data.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      // תג לפי מזהה הפתק: אם אותה תזכורת נשלחה פעמיים, ההתראה
      // השנייה מחליפה את הראשונה במקום להיערם לידה.
      tag: `note-${data.noteId}`,
      requireInteraction: true,
      data,
      actions: [
        { action: 'open', title: 'פתח פתק' },
        { action: 'close', title: 'סגור' },
      ],
    } as NotificationOptions);
  } catch (error) {
    console.error('SW: Error showing notification:', error);
  }
};

self.addEventListener('push', (event) => {
  if (!event.data) return;

  event.waitUntil(
    (async () => {
      let payload: FcmPushEnvelope & Partial<ReminderPushData>;

      try {
        payload = event.data!.json();
      } catch (error) {
        console.error('SW: Push payload is not valid JSON:', error);
        return;
      }

      // FCM עוטף הודעות data-only ב-`{ data: {...} }`. הנפילה לאובייקט
      // עצמו מכסה שליחה ידנית בבדיקות, שבה אין מעטפת.
      const data = payload.data ?? payload;

      if (!data.noteId) {
        console.warn('SW: Push received without noteId, ignoring');
        return;
      }

      await showReminderNotification({
        noteId: data.noteId,
        title: data.title ?? 'תזכורת',
        body: data.body ?? '',
        categoryId: data.categoryId ?? '',
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const data = event.notification.data as ReminderPushData | undefined;
  // בלי קטגוריה אין לאן לנווט חוץ מהבית - פתק תמיד מוצג בתוך קטגוריה
  const targetPath = data?.categoryId ? `/category/${data.categoryId}` : '/';

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // אם האפליקציה כבר פתוחה - מנווטים בה ומעבירים פוקוס,
      // במקום לפתוח חלון נוסף
      for (const client of clientList) {
        if (!client.url.startsWith(self.registration.scope)) continue;

        await client.focus();
        if ('navigate' in client) {
          await client.navigate(targetPath).catch(() => undefined);
        }
        return;
      }

      await self.clients.openWindow(targetPath);
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
