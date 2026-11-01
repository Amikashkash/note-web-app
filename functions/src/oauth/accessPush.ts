/**
 * push למנהלים על בקשת גישה חדשה (v1.43.0), דרך אותו FCM של התזכורות.
 *
 * data-only, כמו התזכורות: ה-Service Worker מציג את ההתראה בעצמו
 * (`src/sw.ts`, `kind: 'mcp_access_request'`). גרסה ישנה של האפליקציה
 * מתעלמת מ-push בלי `noteId`, כך שהיא פשוט לא תציג אותו.
 *
 * tokens מתים נמחקים, כמו ב-`sendDueReminders`.
 */

import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';
import type { AdminNotice } from './access';
import type { OAuthStore } from './store';

const DEAD_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/** חוזה ה-payload מול `src/sw.ts`. כל הערכים מחרוזות (FCM) */
export const accessRequestPayload = (notice: Pick<AdminNotice, 'name' | 'email'>): Record<string, string> => ({
  kind: 'mcp_access_request',
  title: `${notice.name || notice.email || 'משתמש'} ביקש גישה ל-Claude`,
  body: notice.email && notice.name !== notice.email ? `${notice.email} · לאישור בהגדרות` : 'לאישור בהגדרות',
  url: '/settings#claude-access',
});

export const createAdminNotifier =
  (store: OAuthStore) =>
  async (notice: AdminNotice): Promise<void> => {
    const tokens = (await Promise.all(notice.adminUids.map((uid) => store.getPushTokens(uid)))).flat();
    if (tokens.length === 0) {
      logger.info('access.request_no_admin_devices');
      return;
    }

    const response = await getMessaging().sendEachForMulticast({
      tokens: tokens.map((entry) => entry.token),
      data: accessRequestPayload(notice),
      webpush: { headers: { TTL: '86400', Urgency: 'normal' } },
    });

    await Promise.all(
      response.responses.map(async (result, index) => {
        if (result.success) return;
        const code = result.error?.code ?? 'unknown';
        if (DEAD_TOKEN_ERRORS.has(code)) await store.deletePushToken(tokens[index].path).catch(() => undefined);
        else logger.warn('access.push_failed', { code });
      })
    );
    logger.info('access.request_notified', { devices: tokens.length, sent: response.successCount });
  };
