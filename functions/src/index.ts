/**
 * פונקציות ענן לאפליקציית הפתקים
 *
 * שתי פונקציות עובדות יחד:
 *
 * `syncNoteReminders` - טריגר על כל כתיבה לפתק. מפרסר את המשימות
 * ומתחזק מסמך תזכורת לכל משימה שיש לה תאריך ושעה.
 *
 * `sendDueReminders` - רצה כל דקה, שולפת תזכורות שהגיע מועדן ושולחת push.
 *
 * למה הסנכרון בשרת ולא בלקוח: יש כמה מסלולים ששומרים תוכן פתק (טופס
 * הפתק, עריכה inline, קליטת שיתוף), וסנכרון בלקוח היה חייב לכסות את
 * כולם. טריגר רואה כל כתיבה בהגדרה, ומטפל גם במחיקה ובארכוב בלי קוד
 * ייעודי.
 *
 * למה התזכורות בקולקציה נפרדת ולא בתוך הפתק: המשימות שמורות כ-JSON
 * בתוך מחרוזת, ו-Firestore לא יכול לשאול לתוך מחרוזת. בנוסף, סימון
 * "נשלח" בתוך התוכן היה מחייב את השרת לכתוב חזרה ל-`content` - ולהתנגש
 * עם עריכה של המשתמש באותו רגע.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { localDateTimeToDate } from './timezone';
import type { ReminderPushData } from './reminderPayload';

initializeApp();

const db = getFirestore();

/**
 * תקרת תזכורות להרצה בודדת. ההרצה הבאה בעוד דקה תטפל בשארית, כך
 * שהצטברות חריגה לא מייצרת הרצה אחת ארוכה שעלולה להיחתך בטיימאאוט.
 */
const MAX_REMINDERS_PER_RUN = 200;

/** אורך מקסימלי לגוף ההתראה - payload של FCM מוגבל ל-4KB */
const BODY_PREVIEW_LENGTH = 200;

/** שגיאות FCM שמשמעותן שה-token מת ואפשר למחוק אותו */
const DEAD_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

// ==================== סנכרון תזכורות ====================

interface ChecklistItem {
  id?: string;
  text?: string;
  completed?: boolean;
  dueDate?: string;
  dueTime?: string;
}

interface DesiredReminder {
  docId: string;
  itemId: string;
  itemText: string;
  remindAt: Timestamp;
}

/**
 * מזהה דטרמיניסטי לתזכורת. אותה משימה תמיד ממופה לאותו מסמך, כך
 * שכתיבה חוזרת מעדכנת במקום לשכפל.
 */
const reminderDocId = (noteId: string, itemId: string): string => `${noteId}__${itemId}`;

const parseChecklistItems = (content: unknown): ChecklistItem[] => {
  if (typeof content !== 'string' || content.trim() === '') return [];

  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? (parsed as ChecklistItem[]) : [];
  } catch {
    // תוכן שאינו JSON תקין הוא פתק טקסט רגיל, לא שגיאה
    return [];
  }
};

/**
 * המשימות שאמורות להניב תזכורת.
 *
 * דורש גם תאריך וגם שעה: תאריך לבדו הוא תאריך יעד ויזואלי, והתראה
 * בחצות הלילה היא התנהגות גרועה. משימה שהושלמה או שמועדה כבר חלף
 * לא מניבה תזכורת חדשה.
 */
const computeDesiredReminders = (noteId: string, items: ChecklistItem[]): DesiredReminder[] => {
  const now = Date.now();
  const desired: DesiredReminder[] = [];
  const seen = new Set<string>();

  items.forEach((item, index) => {
    if (item.completed) return;
    if (!item.dueDate || !item.dueTime) return;

    const remindAt = localDateTimeToDate(item.dueDate, item.dueTime);
    if (!remindAt || remindAt.getTime() <= now) return;

    // מזהה נגזר-מיקום תואם את מה שהלקוח עושה כשפריט ישן חסר `id`
    const itemId = item.id || `item-${index}`;
    if (seen.has(itemId)) return;
    seen.add(itemId);

    desired.push({
      docId: reminderDocId(noteId, itemId),
      itemId,
      itemText: (item.text || '').slice(0, BODY_PREVIEW_LENGTH),
      remindAt: Timestamp.fromDate(remindAt),
    });
  });

  return desired;
};

export const syncNoteReminders = onDocumentWritten('notes/{noteId}', async (event) => {
  const noteId = event.params.noteId;
  const after = event.data?.after;
  const note = after?.exists ? after.data() : undefined;

  const existing = await db.collection('reminders').where('noteId', '==', noteId).get();
  const existingById = new Map(existing.docs.map((doc) => [doc.id, doc]));

  // פתק שנמחק, אורכב, או שאינו רשימת משימות - אין לו תזכורות
  const isEligible =
    note !== undefined && note.isArchived !== true && note.templateType === 'checklist';

  const desired = isEligible
    ? computeDesiredReminders(noteId, parseChecklistItems(note.content))
    : [];

  const batch = db.batch();
  const desiredIds = new Set(desired.map((reminder) => reminder.docId));

  for (const reminder of desired) {
    const current = existingById.get(reminder.docId);
    const remindAtChanged =
      !current || !reminder.remindAt.isEqual(current.get('remindAt') as Timestamp);

    // מסמך שלא השתנה נשאר כפי שהוא. דריסה שלו הייתה מאפסת את `sent`
    // ומייצרת התראה חוזרת בכל שמירה של הפתק.
    if (!remindAtChanged) continue;

    batch.set(
      db.collection('reminders').doc(reminder.docId),
      {
        userId: note!.userId ?? '',
        noteId,
        itemId: reminder.itemId,
        categoryId: note!.categoryId ?? '',
        noteTitle: (note!.title as string) || 'תזכורת',
        itemText: reminder.itemText,
        remindAt: reminder.remindAt,
        // מועד חדש מחמש מחדש, גם אם התזכורת הקודמת כבר נשלחה
        sent: false,
        sentAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  for (const [docId, doc] of existingById) {
    if (!desiredIds.has(docId)) {
      batch.delete(doc.ref);
    }
  }

  await batch.commit();
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
      batch.update(doc.ref, { sent: true, sentAt: FieldValue.serverTimestamp() });

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

      const dead = await sendToUser(tokens, {
        noteId: (doc.get('noteId') as string) || '',
        itemId: (doc.get('itemId') as string) || '',
        title: (doc.get('itemText') as string) || 'תזכורת',
        body: (doc.get('noteTitle') as string) || '',
        categoryId: (doc.get('categoryId') as string) || '',
      });

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
