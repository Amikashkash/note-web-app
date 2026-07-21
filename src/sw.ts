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

// גיליון הסגנונות של Google Fonts - כמעט ולא משתנה
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

// קובצי הגופן עצמם, שמוגשים מדומיין אחר.
//
// בלי המסלול הזה נשמר רק גיליון הסגנונות: הוא מפנה לקבצי woff2
// ב-gstatic, ואלה היו נטענים מהרשת בכל פעם. במצב לא מקוון הגופן היה
// נכשל והממשק היה נופל לגופן המערכת - בדיוק כשהאפליקציה אמורה להיראות
// זהה. סטטוס 0 בכוונה: אלה תגובות opaque של cross-origin.
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-files-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
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
      // תג לפי משימה ולא לפי פתק: שתי משימות באותו פתק שמועדן קרוב
      // צריכות שתי התראות נפרדות, אחרת השנייה הייתה מחליפה את הראשונה.
      tag: `task-${data.noteId}-${data.itemId}`,
      requireInteraction: true,
      data,
      // בלי כפתורי פעולה בכוונה.
      //
      // הקשה על גוף ההודעה עובדת בכל מקום, כי מערכת ההפעלה עצמה מפעילה
      // את האפליקציה ורק אז המטפל כאן רץ. כפתור פעולה לא מפעיל אותה
      // באנדרואיד, וכל האחריות נופלת על `clients.openWindow()` - קריאה
      // שלא אמינה בהפעלת PWA מותקנת שאינה רצה. כפתור "פתח פתק" לא הוסיף
      // שום יכולת מעבר להקשה על ההודעה, אבל כן הציע מסלול שנכשל.
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
        itemId: data.itemId ?? '',
        title: data.title ?? 'תזכורת',
        body: data.body ?? '',
        categoryId: data.categoryId ?? '',
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // התראות חדשות כבר לא מציגות כפתורים, אבל `requireInteraction` משאיר
  // התראות ישנות על המסך עד שנוגעים בהן - כולל כאלה שנוצרו לפני השינוי
  // ועדיין מציגות "סגור". הבדיקה נשארת כדי שלחיצה עליהן לא תפתח את הפתק.
  if (event.action === 'close') return;

  const data = event.notification.data as ReminderPushData | undefined;

  // הפתק מועבר כפרמטר ולא כנתיב: אין מסלול ייעודי לפתק בודד, והוא נפתח
  // כחלונית בתוך תצוגת הקטגוריה. בלי קטגוריה אין לאן לנווט חוץ מהבית.
  const targetPath = data?.categoryId
    ? `/category/${data.categoryId}` +
      (data.noteId ? `?note=${encodeURIComponent(data.noteId)}` : '')
    : '/';

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // אם האפליקציה כבר פתוחה - מנווטים בה ומעבירים פוקוס, במקום
      // לפתוח חלון נוסף.
      //
      // כל השימוש בחלון קיים עטוף: `focus()` נכשל באנדרואיד כשה-client
      // רשום אך לא באמת גלוי - מצב נפוץ ב-PWA מותקנת שנסגרה. קודם רק
      // `navigate()` היה עטוף, ודחייה של `focus()` הפילה את כל המטפל
      // אחרי שכבר יצאנו מהלולאה. התוצאה: לחיצה על ההתראה לא פתחה כלום.
      for (const client of clientList) {
        if (!client.url.startsWith(self.registration.scope)) continue;

        try {
          const navigated = 'navigate' in client ? await client.navigate(targetPath) : null;
          await (navigated ?? client).focus();
          return;
        } catch (error) {
          console.warn('SW: could not reuse the open window, opening a new one:', error);
          break;
        }
      }

      try {
        await self.clients.openWindow(targetPath);
      } catch (error) {
        console.error('SW: openWindow failed:', error);
      }
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
