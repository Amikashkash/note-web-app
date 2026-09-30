/**
 * `processDueReminders` (E5 / F-1): claim-then-send.
 *
 * כל מקרה כאן הוא כשל אמיתי של הקוד הקודם, שסימן הכל ב-batch אחד בסוף:
 * מחיקה באמצע ההרצה הפילה את ה-batch וכל התזכורות נשלחו שוב בדקה הבאה.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { processDueReminders, type TokenRef } from '../src/dueReminders';
import type { ReminderPushData } from '../src/reminderPayload';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run through `npm run test:functions:emulator` - FIRESTORE_EMULATOR_HOST is not set');
}

const app = initializeApp({ projectId: 'demo-notes-4-me' }, 'due-reminders-emulator-test');
const db = getFirestore(app);

afterAll(async () => {
  await deleteApp(app);
});

const NOW = new Date('2026-10-01T09:00:00Z');
const MINUTE = 60_000;
let counter = 0;

/**
 * תזכורת שהגיע מועדה, עם noteId ייחודי לבדיקה, והפתק שלה: רשימת משימות
 * פעילה שבה המשימה i1 לא בוצעה. `note` משנה את הפתק (null - בלי פתק).
 */
const seed = async (extra: DocumentData = {}, note: DocumentData | null = {}) => {
  const noteId = `due-${Date.now()}-${counter++}`;
  if (note !== null) {
    await db.doc(`notes/${noteId}`).set({
      userId: `user-${noteId}`,
      templateType: 'checklist',
      isArchived: false,
      content: JSON.stringify([{ id: 'i1', text: 'לקנות חלב', completed: false }]),
      ...note,
    });
  }
  const ref = db.collection('reminders').doc(`${noteId}__i1`);
  await ref.set({
    userId: `user-${noteId}`,
    noteId,
    itemId: 'i1',
    categoryId: 'c1',
    noteTitle: 'קניות',
    itemText: 'לקנות חלב',
    remindAt: Timestamp.fromMillis(NOW.getTime() - MINUTE),
    repeat: null,
    sent: false,
    sentAt: null,
    ...extra,
  });
  return { noteId, ref };
};

/** שליחה מדומה: רושמת לאיזה פתק נשלח, וכמה פעמים */
const recorder = (onSend?: (payload: ReminderPushData) => Promise<void> | void) => {
  const sentFor: string[] = [];
  return {
    sentFor,
    deps: {
      getTokens: async (): Promise<TokenRef[]> => [{ token: 't', path: 'users/x/fcmTokens/t' }],
      send: async (_tokens: TokenRef[], payload: ReminderPushData): Promise<TokenRef[]> => {
        sentFor.push(payload.noteId);
        await onSend?.(payload);
        return [];
      },
    },
  };
};

const count = (list: string[], noteId: string) => list.filter((id) => id === noteId).length;

describe('the note is checked at send time', () => {
  // הטריגר מוחק תזכורות כאלה - אבל שניות אחרי הכתיבה. כאן: התזכורת עוד קיימת
  it.each([
    ['the note was archived', { isArchived: true }],
    ['the task was ticked done', { content: JSON.stringify([{ id: 'i1', text: 'x', completed: true }]) }],
    ['the task was removed', { content: JSON.stringify([{ id: 'other', text: 'x', completed: false }]) }],
    ['the note is no longer a checklist', { templateType: 'plain', content: 'טקסט' }],
  ])('%s: not sent, and the reminder is deleted', async (_label, note) => {
    const { noteId, ref } = await seed({}, note);
    const run = recorder();
    const result = await processDueReminders({ db, now: NOW, ...run.deps });
    expect(count(run.sentFor, noteId)).toBe(0);
    expect(result.stale).toBeGreaterThanOrEqual(1);
    expect((await ref.get()).exists).toBe(false);
  });

  it('the note was deleted: not sent, and the orphan reminder is deleted', async () => {
    const { noteId, ref } = await seed({}, null);
    const run = recorder();
    await processDueReminders({ db, now: NOW, ...run.deps });
    expect(count(run.sentFor, noteId)).toBe(0);
    expect((await ref.get()).exists).toBe(false);
  });

  it('an old task without a stored id still matches by position (item-<n>)', async () => {
    const noteId = `due-${Date.now()}-${counter++}`;
    await db.doc(`notes/${noteId}`).set({
      templateType: 'checklist',
      isArchived: false,
      content: JSON.stringify([{ text: 'ישן', completed: false }]),
    });
    await db.doc(`reminders/${noteId}__item-0`).set({
      userId: 'u',
      noteId,
      itemId: 'item-0',
      remindAt: Timestamp.fromMillis(NOW.getTime() - MINUTE),
      repeat: null,
      sent: false,
    });
    const run = recorder();
    await processDueReminders({ db, now: NOW, ...run.deps });
    expect(count(run.sentFor, noteId)).toBe(1);
  });
});

describe('claim-then-send', () => {
  it('sends a due reminder once and marks it sent; the next run sends nothing', async () => {
    const { noteId, ref } = await seed();
    const first = recorder();
    await processDueReminders({ db, now: NOW, ...first.deps });
    expect(count(first.sentFor, noteId)).toBe(1);
    expect((await ref.get()).get('sent')).toBe(true);

    const second = recorder();
    await processDueReminders({ db, now: new Date(NOW.getTime() + MINUTE), ...second.deps });
    expect(count(second.sentFor, noteId)).toBe(0);
  });

  it('two overlapping runs send each reminder exactly once', async () => {
    const seeded = await Promise.all([seed(), seed(), seed(), seed()]);
    const runA = recorder();
    const runB = recorder();
    await Promise.all([
      processDueReminders({ db, now: NOW, ...runA.deps }),
      processDueReminders({ db, now: NOW, ...runB.deps }),
    ]);
    for (const { noteId } of seeded) {
      expect(count(runA.sentFor, noteId) + count(runB.sentFor, noteId)).toBe(1);
    }
  });

  it('a reminder deleted mid-run is skipped, and the rest are still sent once', async () => {
    const [a, b, c] = [await seed(), await seed(), await seed()];
    // כשהראשונה נשלחת, המשתמש מסמן V על השנייה - הטריגר מוחק אותה
    const run = recorder(async (payload) => {
      if (payload.noteId === a.noteId) await b.ref.delete();
    });
    const result = await processDueReminders({ db, now: NOW, ...run.deps });

    expect(count(run.sentFor, a.noteId)).toBe(1);
    expect(count(run.sentFor, b.noteId)).toBe(0);
    expect(count(run.sentFor, c.noteId)).toBe(1);
    expect(result.skipped).toBeGreaterThanOrEqual(1);

    // ובדקה הבאה אף אחת לא נשלחת שוב (בקוד הקודם - כולן נשלחו שוב)
    const next = recorder();
    await processDueReminders({ db, now: new Date(NOW.getTime() + MINUTE), ...next.deps });
    expect(count(next.sentFor, a.noteId) + count(next.sentFor, c.noteId)).toBe(0);
  });

  it('a time changed mid-run is not overwritten: the new time stays armed', async () => {
    const [a, b] = [await seed(), await seed()];
    const later = Timestamp.fromMillis(NOW.getTime() + 60 * MINUTE);
    // בזמן ההרצה המשתמש מזיז את השעה של השנייה - הטריגר כותב remindAt חדש
    const run = recorder(async (payload) => {
      if (payload.noteId === a.noteId) await b.ref.update({ remindAt: later, sent: false });
    });
    await processDueReminders({ db, now: NOW, ...run.deps });

    expect(count(run.sentFor, b.noteId)).toBe(0);
    const stored = (await b.ref.get()).data();
    expect(stored?.sent).toBe(false);
    expect((stored?.remindAt as Timestamp).isEqual(later)).toBe(true);
  });

  it('a failed send is not retried in a loop, and does not stop the others', async () => {
    const [a, b] = [await seed(), await seed()];
    const run = recorder((payload) => {
      if (payload.noteId === a.noteId) throw new Error('FCM down');
    });
    const result = await processDueReminders({ db, now: NOW, ...run.deps });

    expect(count(run.sentFor, b.noteId)).toBe(1);
    expect(result.failed).toBeGreaterThanOrEqual(1);
    expect((await a.ref.get()).get('sent')).toBe(true);
  });

  it('a repeating reminder rolls forward to its next occurrence instead of closing', async () => {
    const { noteId, ref } = await seed({
      repeat: 'daily',
      baseDate: '2026-09-30',
      baseTime: '11:59',
      remindAt: Timestamp.fromDate(new Date('2026-10-01T08:59:00Z')),
    });
    const run = recorder();
    await processDueReminders({ db, now: NOW, ...run.deps });

    expect(count(run.sentFor, noteId)).toBe(1);
    const stored = (await ref.get()).data();
    expect(stored?.sent).toBe(false);
    // 11:59 בישראל (UTC+3 באוקטובר) של מחר
    expect((stored?.remindAt as Timestamp).toDate().toISOString()).toBe('2026-10-02T08:59:00.000Z');
  });

  it('prunes dead tokens, and a token already gone does not break the run', async () => {
    const { noteId } = await seed();
    await db.doc(`users/u-${noteId}/fcmTokens/dead`).set({ token: 'dead' });
    const result = await processDueReminders({
      db,
      now: NOW,
      getTokens: async () => [
        { token: 'dead', path: `users/u-${noteId}/fcmTokens/dead` },
        { token: 'gone', path: `users/u-${noteId}/fcmTokens/never-existed` },
      ],
      send: async (tokens) => tokens,
    });
    expect(result.sent).toBeGreaterThanOrEqual(1);
    expect((await db.doc(`users/u-${noteId}/fcmTokens/dead`).get()).exists).toBe(false);
  });
});
