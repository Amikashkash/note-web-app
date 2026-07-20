/**
 * פונקציות ענן לאפליקציית הפתקים
 *
 * `sendDueReminders` רצה כל דקה, מוצאת פתקים שהגיע מועד התזכורת שלהם
 * ושולחת התראת push לכל המכשירים של בעל הפתק.
 *
 * למה זה חי בשרת ולא בדפדפן: Service Worker נהרג על ידי הדפדפן אחרי
 * שניות של חוסר פעילות, ואיתו כל טיימר שממתין. תזמון אמין מחייב גורם
 * חיצוני שמעיר את המכשיר - כלומר push.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import type { ReminderPushData } from './reminderPayload';

initializeApp();

const db = getFirestore();

/**
 * תקרת פתקים להרצה בודדת. ההרצה הבאה בעוד דקה תטפל בשארית, כך
 * שהצטברות חריגה לא מייצרת הרצה אחת ארוכה שעלולה להיחתך בטיימאאוט.
 */
const MAX_NOTES_PER_RUN = 200;

/**
 * אורך מקסימלי לגוף ההתראה. גם ככה ההתראה נחתכת בתצוגה, ו-payload של
 * FCM מוגבל ל-4KB - פתק ארוך היה מסכן את השליחה כולה.
 */
const BODY_PREVIEW_LENGTH = 200;

/** שגיאות FCM שמשמעותן שה-token מת ואפשר למחוק אותו */
const DEAD_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

interface TokenRef {
  token: string;
  /** נתיב המסמך, לצורך מחיקה כשה-token מת */
  path: string;
}

/** שליפת כל ה-tokens הפעילים של משתמש */
const getUserTokens = async (userId: string): Promise<TokenRef[]> => {
  const snapshot = await db.collection('users').doc(userId).collection('fcmTokens').get();

  return snapshot.docs.map((doc) => ({
    token: doc.get('token') as string,
    path: doc.ref.path,
  }));
};

/**
 * שליחת התראה למכשירים של משתמש.
 * מחזירה את ה-tokens שהתגלו כמתים ויש למחוק.
 */
const sendToUser = async (tokens: TokenRef[], data: ReminderPushData): Promise<TokenRef[]> => {
  if (tokens.length === 0) return [];

  // data-only בכוונה, בלי בלוק `notification`: ה-Service Worker שלנו
  // מציג את ההתראה בעצמו. בלוק `notification` היה גורם לדפדפן להציג
  // אותה *בנוסף*, כלומר התראה כפולה.
  const response = await getMessaging().sendEachForMulticast({
    tokens: tokens.map((entry) => entry.token),
    data,
    webpush: {
      headers: {
        // אין טעם למסור תזכורת ישנה למכשיר שהיה מנותק יממה
        TTL: '86400',
        Urgency: 'high',
      },
    },
  });

  const dead: TokenRef[] = [];

  response.responses.forEach((result, index) => {
    if (result.success) return;

    const code = result.error?.code ?? 'unknown';
    if (DEAD_TOKEN_ERRORS.has(code)) {
      dead.push(tokens[index]);
    } else {
      logger.warn('FCM send failed', { code, message: result.error?.message });
    }
  });

  return dead;
};

export const sendDueReminders = onSchedule(
  {
    schedule: 'every 1 minutes',
    retryCount: 0,
    memory: '256MiB',
    timeoutSeconds: 120,
  },
  async () => {
    const now = Timestamp.now();

    const due = await db
      .collection('notes')
      .where('reminderPending', '==', true)
      .where('reminderTime', '<=', now)
      .limit(MAX_NOTES_PER_RUN)
      .get();

    if (due.empty) return;

    logger.info(`Processing ${due.size} due reminders`);

    // ה-tokens נשלפים פעם אחת למשתמש, גם אם יש לו כמה פתקים באותה דקה
    const tokensByUser = new Map<string, TokenRef[]>();
    const deadTokens = new Set<string>();
    const batch = db.batch();

    for (const doc of due.docs) {
      const userId = doc.get('userId') as string | undefined;

      // תזכורת מסומנת כמטופלת בכל מקרה, גם כשאין למי לשלוח. אחרת היא
      // הייתה נשלפת מחדש בכל הרצה, כל דקה, לנצח.
      batch.update(doc.ref, {
        reminderPending: false,
        reminderSentAt: FieldValue.serverTimestamp(),
      });

      if (!userId) {
        logger.warn('Note has a reminder but no userId', { noteId: doc.id });
        continue;
      }

      let tokens = tokensByUser.get(userId);
      if (!tokens) {
        tokens = await getUserTokens(userId);
        tokensByUser.set(userId, tokens);
      }

      if (tokens.length === 0) {
        logger.info('No registered devices for user, skipping send', { userId, noteId: doc.id });
        continue;
      }

      const dead = await sendToUser(tokens, {
        noteId: doc.id,
        title: (doc.get('title') as string) || 'תזכורת',
        body: ((doc.get('content') as string) || '').slice(0, BODY_PREVIEW_LENGTH),
        categoryId: (doc.get('categoryId') as string) || '',
      });

      for (const entry of dead) {
        deadTokens.add(entry.path);
      }
    }

    await batch.commit();

    // מחיקת ה-tokens המתים ב-batch נפרד: Firestore מגביל ל-500 פעולות
    // ל-batch, ואיחוד שלהן עם עדכוני הפתקים היה יכול לחרוג מהתקרה
    // ולהפיל את כל הכתיבה - כולל סימון התזכורות כנשלחו.
    if (deadTokens.size > 0) {
      const pruneBatch = db.batch();
      for (const path of deadTokens) {
        pruneBatch.delete(db.doc(path));
      }
      await pruneBatch.commit();

      logger.info(`Pruned ${deadTokens.size} dead FCM tokens`);
    }
  }
);
