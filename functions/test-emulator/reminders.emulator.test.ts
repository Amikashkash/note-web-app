/**
 * התזכורות אחרי איחוד הטריגר ל-`onNoteWritten`
 *
 * הבדיקות מריצות את `handleNoteWritten` - הקוד שהטריגר מריץ - מול Firestore
 * Emulator, ובודקות את מסמכי `reminders` שנוצרים. הן מקבעות את ההתנהגות
 * של `syncNoteReminders` הקודם: יצירה, עדכון, חזרה ומחיקה.
 *
 * הזמן קבוע: 2026-09-25 11:00 שעון ישראל (08:00Z).
 */

import { afterAll, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { handleNoteWritten } from '../src/noteWritten';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run through `npm run test:functions:emulator` - FIRESTORE_EMULATOR_HOST is not set');
}

const app = initializeApp({ projectId: 'demo-notes-4-me' }, 'reminders-emulator-test');
const db = getFirestore(app);

afterAll(async () => {
  await deleteApp(app);
});

const NOW = Date.parse('2026-09-25T08:00:00Z');

let noteCounter = 0;
const newNoteId = () => `note-${Date.now()}-${noteCounter++}`;

interface Item {
  id?: string;
  text: string;
  completed?: boolean;
  dueDate?: string;
  dueTime?: string;
  repeat?: string;
}

const checklist = (items: Item[], extra: DocumentData = {}): DocumentData => ({
  userId: 'user-1',
  categoryId: 'cat-1',
  title: 'רשימה',
  templateType: 'checklist',
  isArchived: false,
  content: JSON.stringify(items),
  ...extra,
});

const write = (noteId: string, before: DocumentData | undefined, after: DocumentData | undefined) =>
  handleNoteWritten({ db, noteId, before, after, now: NOW });

const remindersOf = async (noteId: string) => {
  const snapshot = await db.collection('reminders').where('noteId', '==', noteId).get();
  return new Map(snapshot.docs.map((doc) => [doc.id, doc.data()]));
};

const iso = (value: unknown) => (value as Timestamp).toDate().toISOString();

describe('creating reminders', () => {
  it('creates one reminder per future item with a date and a time', async () => {
    const noteId = newNoteId();
    await write(noteId, undefined, checklist([{ id: 'a', text: 'לקנות חלב', dueDate: '2026-09-26', dueTime: '09:00' }]));

    const reminders = await remindersOf(noteId);
    expect([...reminders.keys()]).toEqual([`${noteId}__a`]);

    const reminder = reminders.get(`${noteId}__a`)!;
    expect(reminder).toMatchObject({
      userId: 'user-1',
      noteId,
      itemId: 'a',
      categoryId: 'cat-1',
      noteTitle: 'רשימה',
      itemText: 'לקנות חלב',
      repeat: null,
      baseDate: '2026-09-26',
      baseTime: '09:00',
      sent: false,
      sentAt: null,
    });
    expect(iso(reminder.remindAt)).toBe('2026-09-26T06:00:00.000Z');
  });

  it('ignores items without a time, completed items and one-time items in the past', async () => {
    const noteId = newNoteId();
    await write(
      noteId,
      undefined,
      checklist([
        { id: 'date-only', text: 'x', dueDate: '2026-09-26' },
        { id: 'done', text: 'x', completed: true, dueDate: '2026-09-26', dueTime: '09:00' },
        { id: 'past', text: 'x', dueDate: '2026-09-24', dueTime: '09:00' },
        { id: 'ok', text: 'x', dueDate: '2026-09-26', dueTime: '09:00' },
      ])
    );
    expect([...(await remindersOf(noteId)).keys()]).toEqual([`${noteId}__ok`]);
  });

  it('uses the position-based id for items without one, like the client', async () => {
    const noteId = newNoteId();
    await write(noteId, undefined, checklist([{ text: 'x', dueDate: '2026-09-26', dueTime: '09:00' }]));
    expect([...(await remindersOf(noteId)).keys()]).toEqual([`${noteId}__item-0`]);
  });

  it('creates nothing for a note that is not a checklist, or is archived', async () => {
    const plain = newNoteId();
    const archived = newNoteId();
    const items = [{ id: 'a', text: 'x', dueDate: '2026-09-26', dueTime: '09:00' }];

    await write(plain, undefined, checklist(items, { templateType: 'plain' }));
    await write(archived, undefined, checklist(items, { isArchived: true }));

    expect((await remindersOf(plain)).size).toBe(0);
    expect((await remindersOf(archived)).size).toBe(0);
  });
});

describe('updating reminders', () => {
  it('moves the reminder and re-arms it when the due time changes', async () => {
    const noteId = newNoteId();
    const v1 = checklist([{ id: 'a', text: 'x', dueDate: '2026-09-26', dueTime: '09:00' }]);
    await write(noteId, undefined, v1);
    await db.doc(`reminders/${noteId}__a`).update({ sent: true });

    const v2 = checklist([{ id: 'a', text: 'x', dueDate: '2026-09-26', dueTime: '10:30' }]);
    await write(noteId, v1, v2);

    const reminder = (await remindersOf(noteId)).get(`${noteId}__a`)!;
    expect(iso(reminder.remindAt)).toBe('2026-09-26T07:30:00.000Z');
    expect(reminder.sent).toBe(false);
    expect(reminder.baseTime).toBe('10:30');
  });

  it('leaves an unchanged reminder untouched when the content is rewritten as is', async () => {
    const noteId = newNoteId();
    const items = [{ id: 'a', text: 'x', dueDate: '2026-09-26', dueTime: '09:00' }];
    const v1 = checklist(items);
    await write(noteId, undefined, v1);
    await db.doc(`reminders/${noteId}__a`).update({ sent: true });

    // תוכן זהה במחרוזת אחרת (שדה נוסף בפריט אחר) - הסנכרון רץ, ולא מאפס את `sent`
    const v2 = checklist([...items, { id: 'b', text: 'בלי תאריך' }]);
    await write(noteId, v1, v2);

    expect((await remindersOf(noteId)).get(`${noteId}__a`)!.sent).toBe(true);
  });

  it('skips the sync entirely when no field the reminders depend on changed', async () => {
    const noteId = newNoteId();
    const v1 = checklist([{ id: 'a', text: 'x', dueDate: '2026-09-26', dueTime: '09:00' }]);
    await write(noteId, undefined, v1);
    await db.doc(`reminders/${noteId}__a`).update({ sent: true });

    await write(noteId, v1, { ...v1, title: 'כותרת חדשה', isPinned: true, order: 7 });

    expect((await remindersOf(noteId)).get(`${noteId}__a`)!.sent).toBe(true);
  });
});

describe('repeating reminders', () => {
  it('schedules the next occurrence from a past base and stores the base', async () => {
    const noteId = newNoteId();
    await write(
      noteId,
      undefined,
      checklist([{ id: 'a', text: 'x', dueDate: '2026-09-20', dueTime: '09:00', repeat: 'daily' }])
    );

    const reminder = (await remindersOf(noteId)).get(`${noteId}__a`)!;
    expect(iso(reminder.remindAt)).toBe('2026-09-26T06:00:00.000Z');
    expect(reminder).toMatchObject({ repeat: 'daily', baseDate: '2026-09-20', baseTime: '09:00', sent: false });
  });

  it('updates the rule even when the next occurrence stays the same', async () => {
    const noteId = newNoteId();
    // בסיס ביום שישי 2026-09-25 ב-12:00: המופע הבא הוא היום, גם יומי וגם שבועי
    const daily = checklist([{ id: 'a', text: 'x', dueDate: '2026-09-25', dueTime: '12:00', repeat: 'daily' }]);
    const weekly = checklist([{ id: 'a', text: 'x', dueDate: '2026-09-25', dueTime: '12:00', repeat: 'weekly' }]);
    await write(noteId, undefined, daily);
    await write(noteId, daily, weekly);

    const reminder = (await remindersOf(noteId)).get(`${noteId}__a`)!;
    expect(reminder.repeat).toBe('weekly');
    expect(iso(reminder.remindAt)).toBe('2026-09-25T09:00:00.000Z');
  });

  it('turns a repeating reminder back into a one-time one', async () => {
    const noteId = newNoteId();
    const repeating = checklist([{ id: 'a', text: 'x', dueDate: '2026-09-27', dueTime: '09:00', repeat: 'monthly' }]);
    const once = checklist([{ id: 'a', text: 'x', dueDate: '2026-09-27', dueTime: '09:00' }]);
    await write(noteId, undefined, repeating);
    await write(noteId, repeating, once);

    expect((await remindersOf(noteId)).get(`${noteId}__a`)!.repeat).toBeNull();
  });
});

describe('removing reminders', () => {
  const item = { id: 'a', text: 'x', dueDate: '2026-09-26', dueTime: '09:00' };

  const withReminder = async () => {
    const noteId = newNoteId();
    const note = checklist([item, { id: 'b', text: 'y', dueDate: '2026-09-27', dueTime: '09:00' }]);
    await write(noteId, undefined, note);
    expect((await remindersOf(noteId)).size).toBe(2);
    return { noteId, note };
  };

  it('removes the reminder of an item that was deleted, keeping the others', async () => {
    const { noteId, note } = await withReminder();
    await write(noteId, note, checklist([{ id: 'b', text: 'y', dueDate: '2026-09-27', dueTime: '09:00' }]));
    expect([...(await remindersOf(noteId)).keys()]).toEqual([`${noteId}__b`]);
  });

  it('removes the reminder of an item that was completed', async () => {
    const { noteId, note } = await withReminder();
    await write(
      noteId,
      note,
      checklist([{ ...item, completed: true }, { id: 'b', text: 'y', dueDate: '2026-09-27', dueTime: '09:00' }])
    );
    expect([...(await remindersOf(noteId)).keys()]).toEqual([`${noteId}__b`]);
  });

  it('removes the reminder when the due time is cleared', async () => {
    const { noteId, note } = await withReminder();
    await write(
      noteId,
      note,
      checklist([{ id: 'a', text: 'x' }, { id: 'b', text: 'y', dueDate: '2026-09-27', dueTime: '09:00' }])
    );
    expect([...(await remindersOf(noteId)).keys()]).toEqual([`${noteId}__b`]);
  });

  it.each([
    ['the note is archived', (note: DocumentData) => ({ ...note, isArchived: true })],
    ['the note becomes plain text', (note: DocumentData) => ({ ...note, templateType: 'plain' })],
    ['the note is deleted', () => undefined],
  ])('removes all reminders when %s', async (_label, change) => {
    const { noteId, note } = await withReminder();
    await write(noteId, note, change(note));
    expect((await remindersOf(noteId)).size).toBe(0);
  });

  it('recreates reminders when an archived note is restored', async () => {
    const { noteId, note } = await withReminder();
    const archived = { ...note, isArchived: true };
    await write(noteId, note, archived);
    await write(noteId, archived, note);
    expect((await remindersOf(noteId)).size).toBe(2);
  });
});
