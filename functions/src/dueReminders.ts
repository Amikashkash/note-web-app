/**
 * שליחת התזכורות שהגיע מועדן: claim-then-send (E5 / F-1 בסקירה).
 *
 * קודם כל תזכורת נשלחה, ורק בסוף ההרצה סומנה ב-batch אחד. אם ה-batch
 * נכשל (למשל תזכורת שנמחקה באמצע ההרצה, או חריגה מ-FCM), **כל** התזכורות
 * שנשלחו נשארו `sent:false` ונשלחו שוב בדקה הבאה - בלולאה. בנוסף, מרוץ
 * עם הטריגר: שינוי שעה בזמן ההרצה נדרס ב-`sent:true` והתזכורת החדשה אבדה.
 *
 * עכשיו כל תזכורת עוברת בנפרד:
 * 1. **claim** ב-transaction: רק אם המסמך עדיין קיים, `sent == false`,
 *    ו-`remindAt` זהה למה שנקרא בשאילתה. אז הוא מסומן `sent:true` (או
 *    מתגלגל למועד הבא, בתזכורת חוזרת). מסמך שנמחק או שונה - מדולג.
 * 2. **send** רק אחרי claim מוצלח. כישלון שליחה נרשם ולא מחזיר את
 *    התזכורת לתור: עדיף התראה אחת שאבדה על פני לולאה של כפילויות.
 *
 * שתי הרצות במקביל (retry של Cloud Scheduler, או חפיפה) לא ישלחו פעמיים:
 * רק אחת מהן מצליחה ב-claim.
 *
 * בדיקה מול הפתק, באותו claim: הטריגר (`onNoteWritten`) מוחק תזכורות כשפתק
 * מאורכב, נמחק, או כשמשימה סומנה או הוסרה - אבל שניות אחרי הכתיבה. אם
 * המתזמן רץ בדיוק בפער, תזכורת כזו הייתה נשלחת. לכן ה-claim קורא גם את
 * הפתק: פתק שלא קיים, מאורכב, שאינו רשימת משימות, או משימה שכבר לא קיימת
 * או בוצעה - התזכורת נמחקת ולא נשלחת. עלות: קריאה אחת לכל תזכורת שהגיע מועדה.
 */

import { FieldValue, Timestamp, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import { isRepeatRule, nextOccurrence } from './recurrence';
import type { ReminderPushData } from './reminderPayload';

export interface TokenRef {
  token: string;
  /** נתיב המסמך, לצורך מחיקה כשה-token מת */
  path: string;
}

export interface DueReminderDeps {
  db: Firestore;
  now: Date;
  /** ה-tokens של המשתמש */
  getTokens: (userId: string) => Promise<TokenRef[]>;
  /** שליחה. מחזירה את ה-tokens שהתגלו כמתים */
  send: (tokens: TokenRef[], payload: ReminderPushData) => Promise<TokenRef[]>;
  log?: (message: string, fields?: Record<string, unknown>) => void;
  /** תקרה להרצה אחת. ההרצה הבאה בעוד דקה תטפל בשארית */
  limit?: number;
}

export interface DueReminderResult {
  claimed: number;
  sent: number;
  skipped: number;
  /** נמחקו כי הפתק או המשימה כבר לא מצדיקים תזכורת */
  stale: number;
  failed: number;
}

/**
 * האם הפתק עדיין מצדיק את התזכורת: קיים, לא מאורכב, רשימת משימות, והמשימה
 * קיימת ולא בוצעה. המזהה - השמור, או `item-<מיקום>`, כמו בטריגר.
 */
export const isStillWanted = (note: DocumentData | undefined, itemId: string): boolean => {
  if (!note || note.isArchived === true || note.templateType !== 'checklist') return false;
  let items: unknown;
  try {
    items = JSON.parse(typeof note.content === 'string' ? note.content : '');
  } catch {
    return false;
  }
  if (!Array.isArray(items)) return false;
  const item = items.find(
    (row, index) => row && typeof row === 'object' && ((row as { id?: unknown }).id || `item-${index}`) === itemId
  ) as { completed?: unknown } | undefined;
  return item !== undefined && item.completed !== true;
};

export const processDueReminders = async ({
  db,
  now,
  getTokens,
  send,
  log = () => undefined,
  limit = 200,
}: DueReminderDeps): Promise<DueReminderResult> => {
  const due = await db
    .collection('reminders')
    .where('sent', '==', false)
    .where('remindAt', '<=', Timestamp.fromDate(now))
    .limit(limit)
    .get();

  const result: DueReminderResult = { claimed: 0, sent: 0, skipped: 0, stale: 0, failed: 0 };
  if (due.empty) return result;

  log(`Processing ${due.size} due reminders`);

  const tokensByUser = new Map<string, TokenRef[]>();
  const deadTokens = new Set<string>();

  for (const doc of due.docs) {
    const seenRemindAt = doc.get('remindAt') as Timestamp;

    // 1. claim
    let claimed: DocumentData | 'stale' | null;
    try {
      claimed = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(doc.ref);
        const data = fresh.data();
        if (!data || data.sent !== false || !(data.remindAt as Timestamp)?.isEqual(seenRemindAt)) return null;

        const noteId = typeof data.noteId === 'string' ? data.noteId : '';
        const note = noteId ? (await tx.get(db.collection('notes').doc(noteId))).data() : undefined;
        if (!isStillWanted(note, String(data.itemId ?? ''))) {
          tx.delete(doc.ref);
          return 'stale' as const;
        }

        // בתזכורת חוזרת "מטופלת" פירושה מתגלגלת למועד הבא ולא נסגרת.
        // החישוב מתאריך הבסיס ולא מהמועד שנורה - אחרת קיצוץ לסוף חודש
        // מצטבר ו"כל 31 בחודש" מתדרדר ל-28.
        const repeat = data.repeat as string | null;
        const rollForward =
          isRepeatRule(repeat) && data.baseDate && data.baseTime
            ? nextOccurrence(data.baseDate as string, data.baseTime as string, repeat, now)
            : null;

        tx.update(
          doc.ref,
          rollForward
            ? { remindAt: Timestamp.fromDate(rollForward), sent: false, sentAt: FieldValue.serverTimestamp() }
            : { sent: true, sentAt: FieldValue.serverTimestamp() }
        );
        return data;
      });
    } catch (error) {
      result.failed += 1;
      log('Reminder claim failed', { reminderId: doc.id, errorName: (error as Error)?.name });
      continue;
    }

    if (!claimed) {
      // נמחק, כבר נשלח ע"י הרצה אחרת, או שהשעה שונתה בינתיים
      result.skipped += 1;
      continue;
    }
    if (claimed === 'stale') {
      result.stale += 1;
      log('Reminder no longer wanted, deleted', { reminderId: doc.id });
      continue;
    }
    result.claimed += 1;

    // 2. send
    const userId = claimed.userId as string | undefined;
    if (!userId) {
      log('Reminder has no userId', { reminderId: doc.id });
      continue;
    }

    try {
      let tokens = tokensByUser.get(userId);
      if (!tokens) {
        tokens = await getTokens(userId);
        tokensByUser.set(userId, tokens);
      }
      if (tokens.length === 0) {
        log('No registered devices for user', { userId, reminderId: doc.id });
        continue;
      }

      const payload: ReminderPushData = {
        noteId: (claimed.noteId as string) || '',
        itemId: (claimed.itemId as string) || '',
        title: (claimed.itemText as string) || 'תזכורת',
        body: (claimed.noteTitle as string) || '',
        categoryId: (claimed.categoryId as string) || '',
      };

      // מזהי היעד נרשמים כדי שאפשר יהיה לאמת לאן ההתראה אמורה לנווט
      log('Sending reminder', {
        reminderId: doc.id,
        noteId: payload.noteId,
        categoryId: payload.categoryId,
        deviceCount: tokens.length,
      });

      for (const dead of await send(tokens, payload)) deadTokens.add(dead.path);
      result.sent += 1;
    } catch (error) {
      // לא חוזר לתור: התזכורת כבר סומנה. עדיף פספוס אחד מכפילויות
      result.failed += 1;
      log('Reminder send failed', { reminderId: doc.id, errorName: (error as Error)?.name });
    }
  }

  // tokens מתים נמחקים אחד-אחד: מחיקה של מסמך שכבר נמחק לא מפילה את השאר
  for (const path of deadTokens) {
    await db
      .doc(path)
      .delete()
      .catch(() => undefined);
  }
  if (deadTokens.size > 0) log(`Pruned ${deadTokens.size} dead FCM tokens`);

  return result;
};
