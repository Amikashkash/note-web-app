/**
 * פונקציות ענן לאפליקציית הפתקים
 *
 * `onNoteWritten` - טריגר יחיד על כל כתיבה לפתק. מפעיל את מה שהכתיבה
 * באמת נוגעת בו, ויוצא מוקדם כשאין מה לעשות (ראה `noteWritten.ts`):
 * סנכרון התזכורות (`reminders.ts`) והיסטוריית הגרסאות (`versions.ts`).
 *
 * `sendDueReminders` - רצה כל דקה, שולפת תזכורות שהגיע מועדן ושולחת push.
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
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { isRepeatRule, nextOccurrence } from './recurrence';
import { handleNoteWritten } from './noteWritten';
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

// ==================== מסירה ====================

interface TokenRef {
  token: string;
  /** נתיב המסמך, לצורך מחיקה כשה-token מת */
  path: string;
}

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
      .collection('reminders')
      .where('sent', '==', false)
      .where('remindAt', '<=', now)
      .limit(MAX_REMINDERS_PER_RUN)
      .get();

    if (due.empty) return;

    logger.info(`Processing ${due.size} due reminders`);

    // ה-tokens נשלפים פעם אחת למשתמש, גם אם יש לו כמה תזכורות באותה דקה
    const tokensByUser = new Map<string, TokenRef[]>();
    const deadTokens = new Set<string>();
    const batch = db.batch();

    for (const doc of due.docs) {
      const userId = doc.get('userId') as string | undefined;

      // התזכורת מסומנת כמטופלת בכל מקרה, גם כשאין למי לשלוח. אחרת היא
      // הייתה נשלפת מחדש בכל הרצה, כל דקה, לנצח.
      //
      // בתזכורת חוזרת "מטופלת" פירושה מתגלגלת למועד הבא ולא נסגרת.
      // החישוב מתאריך הבסיס ולא מהמועד שנורה - אחרת קיצוץ לסוף חודש
      // מצטבר ו"כל 31 בחודש" מתדרדר ל-28.
      const repeat = doc.get('repeat') as string | null;
      const baseDate = doc.get('baseDate') as string | undefined;
      const baseTime = doc.get('baseTime') as string | undefined;

      const rollForward =
        isRepeatRule(repeat) && baseDate && baseTime
          ? nextOccurrence(baseDate, baseTime, repeat, now.toDate())
          : null;

      if (rollForward) {
        batch.update(doc.ref, {
          remindAt: Timestamp.fromDate(rollForward),
          sent: false,
          sentAt: FieldValue.serverTimestamp(),
        });
      } else {
        batch.update(doc.ref, { sent: true, sentAt: FieldValue.serverTimestamp() });
      }

      if (!userId) {
        logger.warn('Reminder has no userId', { reminderId: doc.id });
        continue;
      }

      let tokens = tokensByUser.get(userId);
      if (!tokens) {
        tokens = await getUserTokens(userId);
        tokensByUser.set(userId, tokens);
      }

      if (tokens.length === 0) {
        logger.info('No registered devices for user', { userId, reminderId: doc.id });
        continue;
      }

      const payload = {
        noteId: (doc.get('noteId') as string) || '',
        itemId: (doc.get('itemId') as string) || '',
        title: (doc.get('itemText') as string) || 'תזכורת',
        body: (doc.get('noteTitle') as string) || '',
        categoryId: (doc.get('categoryId') as string) || '',
      };

      // מזהי היעד נרשמים כדי שאפשר יהיה לאמת לאן ההתראה אמורה לנווט.
      // בלי זה, "ההתראה לא פותחת את הפתק" הוא דיווח שאי אפשר לאבחן
      // בלי ניפוי מרחוק על המכשיר עצמו.
      logger.info('Sending reminder', {
        reminderId: doc.id,
        noteId: payload.noteId,
        categoryId: payload.categoryId,
        deviceCount: tokens.length,
      });

      const dead = await sendToUser(tokens, payload);

      for (const entry of dead) {
        deadTokens.add(entry.path);
      }
    }

    for (const path of deadTokens) {
      batch.delete(db.doc(path));
    }

    await batch.commit();

    if (deadTokens.size > 0) {
      logger.info(`Pruned ${deadTokens.size} dead FCM tokens`);
    }
  }
);
