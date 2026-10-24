/**
 * משימות חוזרות מקצה לקצה, מול ה-emulator: כתיבה של "בוצע" (כמו מהאפליקציה),
 * הטריגר (`handleNoteWritten`, אותו קוד ש-`onNoteWritten` מריץ), כתיבת
 * האיפוס, והריצה השנייה של הטריגר שמסנכרנת את התזכורת. כולל מעברי שעון.
 *
 * הטריגר האמיתי רץ על כל כתיבה בעצמו; כאן `settle` מריץ אותו על כל כתיבה
 * שהוא עצמו יצר, עד שאין עוד - וגם בודק שאין לולאה.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { handleNoteWritten } from '../src/noteWritten';
import { localDateTimeToDate } from '../src/timezone';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run through `npm run test:functions:emulator` - emulator hosts are not set');
}

const adminApp = initializeApp({ projectId: 'demo-notes-4-me' }, 'recurring-tasks-emulator-test');
const db = getFirestore(adminApp);

afterAll(async () => {
  await deleteApp(adminApp);
});

const RUN = Date.now().toString(36);
let counter = 0;
const AT = Timestamp.fromDate(new Date('2026-01-01T10:00:00Z'));

const note = (items: unknown[], extra: DocumentData = {}): DocumentData => ({
  title: 'משימות',
  content: JSON.stringify(items),
  categoryId: 'cat',
  templateType: 'checklist',
  userId: 'owner',
  sharedWith: [],
  isArchived: false,
  createdAt: AT,
  updatedAt: AT,
  updatedBy: 'owner',
  revision: 1,
  ...extra,
});

const stored = async (noteId: string) => (await db.doc(`notes/${noteId}`).get()).data() ?? {};
const rowsOf = async (noteId: string) => JSON.parse((await stored(noteId)).content as string) as Record<string, unknown>[];
const remindersOf = async (noteId: string) =>
  (await db.collection('reminders').where('noteId', '==', noteId).get()).docs.map((doc) => doc.data());

/** מריץ את הטריגר על הכתיבה, ועל כל כתיבה שהטריגר עצמו יצר. מחזיר כמה כאלה היו */
const settle = async (noteId: string, before: DocumentData | undefined, now: number): Promise<number> => {
  let previous = before;
  let current = await stored(noteId);
  for (let writes = 0; writes < 5; writes += 1) {
    await handleNoteWritten({ db, noteId, before: previous, after: current, now });
    const next = await stored(noteId);
    if (next.revision === current.revision) return writes;
    [previous, current] = [current, next];
  }
  throw new Error('the trigger keeps writing - a loop');
};

/** פתק חדש עם הטריגר של היצירה. מחזיר את המזהה */
const create = async (items: unknown[], now: number) => {
  const noteId = `recurring-${RUN}-${counter++}`;
  await db.doc(`notes/${noteId}`).set(note(items));
  await settle(noteId, undefined, now);
  return noteId;
};

/** "בוצע" כמו מהאפליקציה: כל התוכן, `revision + 1`, הכותב הוא המשתמש */
const markDone = async (noteId: string, itemId: string, now: number) => {
  const before = await stored(noteId);
  const rows = (JSON.parse(before.content as string) as Record<string, unknown>[]).map((row) =>
    row.id === itemId ? { ...row, completed: true } : row
  );
  await db.doc(`notes/${noteId}`).update({
    content: JSON.stringify(rows),
    revision: (before.revision as number) + 1,
    updatedAt: Timestamp.fromMillis(now),
    updatedBy: 'owner',
  });
  return settle(noteId, before, now);
};

const remindAtOf = (reminder: DocumentData) => (reminder.remindAt as Timestamp).toDate().toISOString();

describe('a repeating task marked done comes back with the next due date', () => {
  it('daily, across the end of DST (Oct 25 2026): back as not done, reminder at 09:00 local', async () => {
    const now = Date.parse('2026-10-24T07:30:00Z'); // 10:30 בישראל, שעון קיץ
    const noteId = await create(
      [{ id: 'pill', text: 'תרופה', completed: false, dueDate: '2026-10-24', dueTime: '09:00', repeat: 'daily' }],
      Date.parse('2026-10-24T05:00:00Z')
    );
    expect(await markDone(noteId, 'pill', now)).toBe(1);

    expect(await rowsOf(noteId)).toEqual([
      { id: 'pill', text: 'תרופה', completed: false, dueDate: '2026-10-25', dueTime: '09:00', repeat: 'daily' },
    ]);
    const [reminder] = await remindersOf(noteId);
    // 09:00 בשעון חורף = 07:00 UTC (בקיץ זה היה 06:00)
    expect(remindAtOf(reminder)).toBe('2026-10-25T07:00:00.000Z');
    expect(reminder).toMatchObject({ baseDate: '2026-10-25', repeat: 'daily', sent: false });
  });

  it('weekly, across the start of DST (Mar 27 2026)', async () => {
    const now = Date.parse('2026-03-24T08:00:00Z');
    const noteId = await create(
      [{ id: 'w', text: 'זבל', completed: false, dueDate: '2026-03-24', dueTime: '09:00', repeat: 'weekly' }],
      Date.parse('2026-03-24T06:00:00Z')
    );
    await markDone(noteId, 'w', now);
    expect((await rowsOf(noteId))[0]).toMatchObject({ completed: false, dueDate: '2026-03-31' });
    const [reminder] = await remindersOf(noteId);
    expect(remindAtOf(reminder)).toBe('2026-03-31T06:00:00.000Z');
  });

  it('monthly on the 31st: Feb 28 with the base kept, then the 31st again', async () => {
    const noteId = await create(
      [{ id: 'rent', text: 'שכר דירה', completed: false, dueDate: '2026-01-31', dueTime: '09:00', repeat: 'monthly' }],
      Date.parse('2026-01-30T08:00:00Z')
    );
    await markDone(noteId, 'rent', Date.parse('2026-01-31T08:00:00Z'));
    expect((await rowsOf(noteId))[0]).toMatchObject({ dueDate: '2026-02-28', repeatBase: '2026-01-31' });
    const [feb] = await remindersOf(noteId);
    expect(remindAtOf(feb)).toBe(localDateTimeToDate('2026-02-28', '09:00')?.toISOString());
    expect(feb.baseDate).toBe('2026-01-31');

    await markDone(noteId, 'rent', Date.parse('2026-02-28T08:00:00Z'));
    const [row] = await rowsOf(noteId);
    expect(row).toMatchObject({ completed: false, dueDate: '2026-03-31' });
    expect(row).not.toHaveProperty('repeatBase');
  });

  it('a one-time task stays done and its reminder is cancelled', async () => {
    const now = Date.parse('2026-06-01T05:00:00Z');
    const noteId = await create([{ id: 'o', text: 'פעם אחת', completed: false, dueDate: '2026-06-02', dueTime: '09:00' }], now);
    expect(await remindersOf(noteId)).toHaveLength(1);
    expect(await markDone(noteId, 'o', now)).toBe(0);
    expect((await rowsOf(noteId))[0].completed).toBe(true);
    expect(await remindersOf(noteId)).toEqual([]);
  });

  it('keeps the writer, so marking done does not add an extra version to the history', async () => {
    const now = Date.parse('2026-07-01T07:00:00Z');
    const noteId = await create(
      [{ id: 'd', text: 'x', completed: false, dueDate: '2026-07-01', dueTime: '09:00', repeat: 'daily' }],
      Date.parse('2026-07-01T05:00:00Z')
    );
    await markDone(noteId, 'd', now);
    const after = await stored(noteId);
    expect(after.updatedBy).toBe('owner');
    expect(after.revision).toBe(3); // יצירה 1, סימון 2, איפוס 3
    const versions = await db.collection(`notes/${noteId}/versions`).get();
    expect(versions.size).toBeLessThanOrEqual(1);
  });

  it('an archived note is not touched', async () => {
    const now = Date.parse('2026-07-01T07:00:00Z');
    const noteId = `recurring-${RUN}-${counter++}`;
    const items = [{ id: 'd', text: 'x', completed: false, dueDate: '2026-07-01', dueTime: '09:00', repeat: 'daily' }];
    await db.doc(`notes/${noteId}`).set(note(items, { isArchived: true }));
    expect(await markDone(noteId, 'd', now)).toBe(0);
    expect((await rowsOf(noteId))[0].completed).toBe(true);
  });
});
