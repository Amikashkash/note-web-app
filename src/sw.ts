/**
 * Custom Service Worker for handling notifications
 * This provides more reliable notification support for PWA
 */

/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Precache all assets
precacheAndRoute(self.__WB_MANIFEST);

// Cleanup old caches
cleanupOutdatedCaches();

// Route for navigation requests - always try network first with short timeout
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'pages-cache',
      networkTimeoutSeconds: 3, // Fallback to cache after 3 seconds
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  )
);

// Cache Google Fonts
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
  'GET'
);

// Don't cache Firebase API calls (Firestore, Auth, Functions)
// These need to always be fresh to avoid stale data
registerRoute(
  /^https:\/\/firestore\.googleapis\.com\/.*/i,
  new NetworkFirst({
    cacheName: 'firestore-api',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 0, // Don't cache
      }),
    ],
  })
);

registerRoute(
  /^https:\/\/.*\.firebaseapp\.com\/.*/i,
  new NetworkFirst({
    cacheName: 'firebase-app',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 0, // Don't cache
      }),
    ],
  })
);

// Cache Firebase Storage (images, files, etc.)
registerRoute(
  /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
  new NetworkFirst({
    cacheName: 'firebase-storage-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
  'GET'
);

// ==================== SHARE TARGET HANDLING ====================

/**
 * Handle POST requests from Web Share Target API
 * Converts FormData to URL parameters and redirects
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Check if this is a share target POST request
  if (event.request.method === 'POST' && url.pathname === '/share') {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const title = formData.get('title') || '';
          const text = formData.get('text') || '';
          const urlParam = formData.get('url') || '';

          // Store shared data in cache with unique ID
          const shareId = `share-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const cache = await caches.open('share-data-cache');

          const shareData = {
            title,
            text,
            url: urlParam,
            timestamp: Date.now(),
          };

          // Store as a cache entry
          await cache.put(
            new Request(`/share-data/${shareId}`),
            new Response(JSON.stringify(shareData), {
              headers: { 'Content-Type': 'application/json' },
            })
          );

          console.log('✅ SW: Stored share data with ID:', shareId);

          // Redirect to share page with share ID
          const redirectUrl = `/share?shareId=${shareId}`;
          return Response.redirect(redirectUrl, 303);
        } catch (error) {
          console.error('❌ SW: Error handling share POST:', error);
          // Fallback to share page without data
          return Response.redirect('/share', 303);
        }
      })()
    );
  }
});

// ==================== NOTIFICATION HANDLING ====================

interface ReminderData {
  noteId: string;
  title: string;
  body: string;
  reminderTime: number;
}

// Store for scheduled reminders
const scheduledReminders = new Map<string, number>();

/**
 * Schedule a notification to be shown at a specific time
 */
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  if (type === 'SCHEDULE_REMINDER') {
    const reminderData: ReminderData = data;
    const timeUntilReminder = reminderData.reminderTime - Date.now();

    console.log('📅 SW: Scheduling reminder:', reminderData.title);
    console.log('⏰ SW: Time until reminder:', Math.round(timeUntilReminder / 1000 / 60), 'minutes');

    if (timeUntilReminder <= 0) {
      // Show immediately
      console.log('🔔 SW: Showing reminder immediately');
      showReminderNotification(reminderData);
    } else {
      // Cancel existing reminder for this note if any
      const existingTimerId = scheduledReminders.get(reminderData.noteId);
      if (existingTimerId) {
        clearTimeout(existingTimerId);
      }

      // Schedule new reminder
      const timerId = self.setTimeout(() => {
        console.log('🔔 SW: Reminder time reached for:', reminderData.title);
        showReminderNotification(reminderData);
        scheduledReminders.delete(reminderData.noteId);
      }, timeUntilReminder);

      scheduledReminders.set(reminderData.noteId, timerId);
      console.log('✅ SW: Reminder scheduled successfully');
    }

    // Send acknowledgment back to client
    event.ports[0]?.postMessage({ success: true });
  } else if (type === 'CANCEL_REMINDER') {
    const noteId = data.noteId;
    const timerId = scheduledReminders.get(noteId);

    if (timerId) {
      clearTimeout(timerId);
      scheduledReminders.delete(noteId);
      console.log('🗑️ SW: Cancelled reminder for note:', noteId);
    }

    event.ports[0]?.postMessage({ success: true });
  }
});

/**
 * Show a notification using Service Worker's showNotification API
 * This is more reliable than the browser's Notification API
 */
async function showReminderNotification(data: ReminderData) {
  try {
    console.log('🔔 SW: Showing notification:', data.title);

    await self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: `note-${data.noteId}`,
      requireInteraction: true,
      silent: false,
      data: {
        noteId: data.noteId,
        url: '/', // Will open the app
      },
      actions: [
        {
          action: 'open',
          title: 'פתח פתק',
        },
        {
          action: 'close',
          title: 'סגור',
        },
      ],
    } as NotificationOptions);

    console.log('✅ SW: Notification shown successfully');
  } catch (error) {
    console.error('❌ SW: Error showing notification:', error);
  }
}

/**
 * Handle notification click
 */
self.addEventListener('notificationclick', (event) => {
  console.log('🖱️ SW: Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Open the app when notification is clicked
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }

      // Open new window if app is not open
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

/**
 * Handle notification close
 */
self.addEventListener('notificationclose', () => {
  console.log('🔕 SW: Notification closed');
});

// Activate immediately
self.addEventListener('install', () => {
  console.log('🔧 SW: Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('✅ SW: Activated');
  event.waitUntil(self.clients.claim());
});

export {};
