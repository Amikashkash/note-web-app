/**
 * פונקציות ענן לאפליקציית הפתקים
 *
 * `onNoteWritten` - טריגר יחיד על כל כתיבה לפתק. מפעיל את מה שהכתיבה
 * באמת נוגעת בו, ויוצא מוקדם כשאין מה לעשות (ראה `noteWritten.ts`):
 * סנכרון התזכורות (`reminders.ts`) והיסטוריית הגרסאות (`versions.ts`).
 *
 * `sendDueReminders` - רצה כל דקה, שולפת תזכורות שהגיע מועדן ושולחת push.
 *
 * `findUserByEmail` - callable לשיתוף לפי אימייל (`userLookup.ts`).
 *
 * `mcp` - שרת ה-MCP וה-OAuth של Claude (`mcp/http.ts`, `thinking/mcp-plan.md`).
 *
 * למה בטריגר ולא בלקוח: יש כמה מסלולים ששומרים פתק (טופס הפתק, עריכה
 * inline, קליטת שיתוף, ובעתיד MCP), וטריגר רואה כל כתיבה בהגדרה - גם
 * מחיקה וארכוב - בלי קוד ייעודי בכל מסלול.
 *
 * למה טריגר אחד ולא אחד לכל תפקיד: כל פונקציה על `notes/{noteId}` היא
 * הרצה נפרדת בכל שמירה, ושמירה אוטומטית כותבת הרבה.
 */

import { setGlobalOptions } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { handleNoteWritten } from './noteWritten';
import { processDueReminders, type TokenRef } from './dueReminders';
import { lookupUserByEmail } from './userLookup';
import type { ReminderPushData } from './reminderPayload';

/**
 * region אחד לכל הפונקציות, זהה למיקום מסד הנתונים.
 *
 * לפני התיקון הזה `onNoteWritten` (טריגר Firestore) הוצב אוטומטית ב-
 * `europe-west1` לצד ה-DB, בעוד `sendDueReminders` (מתוזמנת) ישבה ב-
 * ברירת המחדל `us-central1` וקראה את Firestore ביבשת אחרת בכל דקה -
 * השהיה וחיוב cross-region על כל הרצה, בלי שום סיבה.
 *
 * מיקום ה-DB אומת דרך `firebase firestore:databases:get "(default)"`
 * ודרך `gcloud firestore databases describe`, ולא הונח.
 *
 * פונקציה עתידית (כמו שרת ה-MCP, ראו `thinking/mcp-plan.md` §1.1)
 * יורשת את ה-region הזה אוטומטית ולא צריכה לציין אותו בנפרד.
 */
setGlobalOptions({ region: 'europe-west1' });

initializeApp();

const db = getFirestore();

/**
 * תקרת תזכורות להרצה בודדת. ההרצה הבאה בעוד דקה תטפל בשארית, כך
 * שהצטברות חריגה לא מייצרת הרצה אחת ארוכה שעלולה להיחתך בטיימאאוט.
 */
const MAX_REMINDERS_PER_RUN = 200;

/** שגיאות FCM שמשמעותן שה-token מת ואפשר למחוק אותו */
const DEAD_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

// ==================== כתיבה לפתק ====================

export const onNoteWritten = onDocumentWritten('notes/{noteId}', async (event) => {
  const before = event.data?.before;
  const after = event.data?.after;

  await handleNoteWritten({
    db,
    noteId: event.params.noteId,
    before: before?.exists ? before.data() : undefined,
    after: after?.exists ? after.data() : undefined,
  });
});

// ==================== חיפוש משתמש לשיתוף ====================

export const findUserByEmail = onCall({ memory: '256MiB', timeoutSeconds: 10 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'יש להתחבר כדי לשתף');
  }

  return lookupUserByEmail({
    db,
    auth: getAuth(),
    callerUid: request.auth.uid,
    email: (request.data as { email?: unknown } | undefined)?.email,
    now: Date.now(),
  });
});

// ==================== מסירה ====================

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

/**
 * claim-then-send (E5 בסקירה): כל תזכורת מסומנת ב-transaction משלה לפני
 * שליחה, ולכן כישלון באמצע ההרצה או הרצה חופפת לא שולחים פעמיים.
 * הלוגיקה ב-`dueReminders.ts`; כאן רק FCM וה-tokens.
 */
export const sendDueReminders = onSchedule(
  {
    schedule: 'every 1 minutes',
    retryCount: 0,
    memory: '256MiB',
    timeoutSeconds: 120,
  },
  async () => {
    await processDueReminders({
      db,
      now: new Date(),
      getTokens: getUserTokens,
      send: sendToUser,
      limit: MAX_REMINDERS_PER_RUN,
      log: (message, fields) => logger.info(message, fields ?? {}),
    });
  }
);

// ==================== שרת MCP ====================

/**
 * `/mcp`, `/oauth/*` ו-`/.well-known/*` דרך rewrites של Hosting (`firebase.json`).
 *
 * הקוד נטען רק בבקשה הראשונה (`import()`): כל הפונקציות נבנות מאותו
 * `index.js`, ובלי זה ה-MCP SDK היה נטען גם ב-cold start של התזכורות
 * ושל הטריגר על הפתקים, שאין להם בו צורך.
 *
 * - `timeoutSeconds: 30`: Claude מחכה 10 שניות ל-discovery ול-token, ו-30 ל-refresh.
 * - `maxInstances: 5`: תקרת עלות. שימוש אישי לא מתקרב אליה.
 * - בלי `minInstances`: עולה כסף גם בלי שימוש. ההחלטה אחרי מדידת cold
 *   start (mcp-plan §1.1).
 * - ציבורית (ברירת המחדל של `onRequest`): Hosting ו-Claude קוראים לה בלי
 *   הרשאת IAM. האימות הוא ה-OAuth של האפליקציה.
 */
export const mcp = onRequest({ timeoutSeconds: 30, maxInstances: 5 }, async (req, res) => {
  const { mcpApp } = await import('./mcp/http.js');
  (await mcpApp())(req, res);
});
