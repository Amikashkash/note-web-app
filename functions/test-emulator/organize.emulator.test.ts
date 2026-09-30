/**
 * ארכוב, שחזור, העברה, והוספה/הסרה של משימות - מקצה לקצה, עם התזכורות.
 *
 * בכל כלי: הלקוח הרשמי של ה-SDK קורא לכלי, ואז רצים הטריגר
 * (`handleNoteWritten`) והמתזמן (`processDueReminders`) כמו בפרודקשן.
 */

import { createHash, randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { UserScope } from '../src/notesCore/store';
import { OAuthStore } from '../src/oauth/store';
import { CONSENT_VERSION, RATE_LIMITS } from '../src/oauth/config';
import { handleNoteWritten } from '../src/noteWritten';
import { processDueReminders } from '../src/dueReminders';
import { localDateTimeToDate } from '../src/timezone';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run through `npm run test:functions:emulator` - emulator hosts are not set');
}

type HttpModule = typeof import('../src/mcp/http');
let createMcpApp: HttpModule['createMcpApp'];
let NOT_FOUND_TEXT = '';

const adminApp = initializeApp({ projectId: 'demo-notes-4-me' }, 'organize-emulator-test');
const db = getFirestore(adminApp);
const auth = getAuth(adminApp);
const store = OAuthStore.create(db);

const RUN = Date.now().toString(36);
const id = (name: string) => `${name}-${RUN}`;
const AT = Timestamp.fromDate(new Date('2026-09-20T10:00:00Z'));
const RESOURCE = 'https://notes-4-me.web.app/mcp';
const users = { a: '', b: '' };

const MANY = [{ name: 'minute', windowMs: 60_000, max: 10_000 }];
const GENEROUS = Object.fromEntries(
  Object.keys(RATE_LIMITS).map((endpoint) => [endpoint, { perIp: MANY, global: MANY }])
) as unknown as typeof RATE_LIMITS;

const israelDate = (daysAhead: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(Date.now() + daysAhead * 86_400_000));

const C = {
  home: id('cat-home'),
  work: id('cat-work'),
  readOnly: id('cat-ro'),
  secret: id('cat-secret'),
  bOwn: id('cat-b'),
  sharedFromB: id('cat-shared-from-b'),
};

const category = (userId: string, extra: DocumentData = {}) => ({
  name: 'בית',
  color: '#3B82F6',
  icon: null,
  order: 0,
  userId,
  sharedWith: [],
  isSensitive: false,
  isReadOnly: false,
  createdAt: AT,
  updatedAt: AT,
  ...extra,
});

const future = israelDate(3);
const tasks = () => [
  { id: 'milk', text: 'לקנות חלב', completed: false, dueDate: future, dueTime: '09:30' },
  { id: 'old', text: 'משהו שעבר', completed: false, dueDate: israelDate(-2), dueTime: '09:00' },
  { id: 'daily', text: 'תרופה', completed: false, dueDate: israelDate(-5), dueTime: '20:00', repeat: 'daily' },
];

const note = (userId: string, categoryId: string, extra: DocumentData = {}) => ({
  title: 'משימות',
  content: JSON.stringify(tasks()),
  categoryId,
  templateType: 'checklist',
  tags: [],
  color: null,
  order: 0,
  userId,
  sharedWith: [],
  isPinned: false,
  isArchived: false,
  isSensitive: false,
  isReadOnly: false,
  createdAt: AT,
  updatedAt: AT,
  updatedBy: userId,
  revision: 3,
  ...extra,
});

let server: Server;
let base = '';
const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');

const issueToken = async (uid: string, consentVersion = CONSENT_VERSION) => {
  const token = `n4m_at_${randomBytes(32).toString('base64url')}`;
  const grantId = randomBytes(32).toString('base64url');
  const now = Date.now();
  const scope = 'notes.read notes.write offline_access';
  await db.doc(`oauthGrants/${grantId}`).set({
    grantId, uid, clientId: 'test-client', clientName: 'Claude', scope, consentVersion,
    createdAt: Timestamp.fromMillis(now), lastUsedAt: Timestamp.fromMillis(now),
    absoluteExpiresAt: Timestamp.fromMillis(now + 90 * 86_400_000), revoked: false, revokedReason: null,
  });
  await db.doc(`oauthTokens/${sha256Hex(token)}`).set({
    type: 'access', grantId, uid, clientId: 'test-client', scope, resource: RESOURCE,
    createdAt: Timestamp.fromMillis(now), expiresAt: Timestamp.fromMillis(now + 3_600_000), used: false, revoked: false,
  });
  return token;
};

const connect = async (token: string) => {
  const client = new Client({ name: 'organize-test', version: '1.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } })
  );
  return client;
};

const call = async (client: Client, name: string, args: Record<string, unknown>) => {
  const result = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
  return { text: result.content.map((part) => part.text).join('\n'), isError: result.isError === true };
};

let clientA: Client;

beforeAll(async () => {
  ({ createMcpApp } = await import('../src/mcp/http'));
  ({ NOT_FOUND_TEXT } = await import('../src/mcp/tools'));
  for (const name of Object.keys(users) as (keyof typeof users)[]) {
    users[name] = (await auth.createUser({ email: `org-${name}-${RUN}@example.com`, emailVerified: true })).uid;
  }
  const config = (await db.doc('config/mcp').get()).data() ?? {};
  await db.doc('config/mcp').set({ ...config, allowedUids: [...(config.allowedUids ?? []), users.a, users.b] });

  const batch = db.batch();
  batch.set(db.doc(`categories/${C.home}`), category(users.a, { name: 'בית' }));
  batch.set(db.doc(`categories/${C.work}`), category(users.a, { name: 'עבודה' }));
  batch.set(db.doc(`categories/${C.readOnly}`), category(users.a, { name: 'מסמכים', isReadOnly: true }));
  batch.set(db.doc(`categories/${C.secret}`), category(users.a, { name: 'כספים', isSensitive: true }));
  batch.set(db.doc(`categories/${C.bOwn}`), category(users.b));
  batch.set(db.doc(`categories/${C.sharedFromB}`), category(users.b, { sharedWith: [users.a] }));
  await batch.commit();

  ({ server, base } = await new Promise<{ server: Server; base: string }>((resolve) => {
    const started = createMcpApp({
      store, auth, rateLimits: GENEROUS, mcpLimits: MANY, mcpWriteLimits: MANY,
      scopeFor: (identity) => UserScope.for(identity, db),
    }).listen(0, '127.0.0.1', () =>
      resolve({ server: started, base: `http://127.0.0.1:${(started.address() as AddressInfo).port}` })
    );
  }));
  clientA = await connect(await issueToken(users.a));
});

afterAll(async () => {
  await clientA?.close();
  await new Promise((resolve) => server.close(resolve));
  await deleteApp(adminApp);
});

let counter = 0;
const stored = async (noteId: string) => (await db.doc(`notes/${noteId}`).get()).data() ?? {};
const remindersOf = async (noteId: string) =>
  (await db.collection('reminders').where('noteId', '==', noteId).get()).docs.map((doc) => doc.data());

/** פתק עם התזכורות שהטריגר היה יוצר לו */
const seedWithReminders = async (extra: DocumentData = {}) => {
  const noteId = id(`org-${counter++}`);
  await db.doc(`notes/${noteId}`).set(note(users.a, C.home, extra));
  await handleNoteWritten({ db, noteId, before: undefined, after: await stored(noteId) });
  return noteId;
};

const trigger = async (noteId: string, before: DocumentData) =>
  handleNoteWritten({ db, noteId, before, after: await stored(noteId) });

/** המתזמן, בזמן שכל התזכורות של הפתק כבר הגיעו */
const sendAllDue = async (noteId: string) => {
  const due = await remindersOf(noteId);
  const latest = Math.max(Date.now(), ...due.map((reminder) => (reminder.remindAt as Timestamp).toMillis()));
  const sent: string[] = [];
  await processDueReminders({
    db,
    now: new Date(latest + 1000),
    getTokens: async () => [{ token: 't', path: 'users/x/fcmTokens/t' }],
    send: async (_tokens, payload) => {
      if (payload.noteId === noteId) sent.push(payload.itemId);
      return [];
    },
  });
  return sent;
};

// ---------------------------------------------------------------------------
// ארכוב ושחזור, והתזכורות
// ---------------------------------------------------------------------------

describe('archive_note and reminders', () => {
  it('archiving cancels the reminders at once, and none is ever sent', async () => {
    const noteId = await seedWithReminders();
    expect((await remindersOf(noteId)).map((reminder) => reminder.itemId).sort()).toEqual(['daily', 'milk']);

    const before = await stored(noteId);
    const result = await call(clientA, 'archive_note', { noteId });
    expect(result.isError).toBe(false);
    expect(result.text).toContain('reminders are cancelled');

    // נמחקו באותו transaction - עוד לפני שהטריגר רץ
    expect(await remindersOf(noteId)).toEqual([]);
    const after = await stored(noteId);
    expect(after).toMatchObject({ isArchived: true, revision: 4 });
    expect(after.archivedAt).toBeInstanceOf(Timestamp);

    await trigger(noteId, before);
    expect(await remindersOf(noteId)).toEqual([]);
    expect(await sendAllDue(noteId)).toEqual([]);

    const [version] = (await db.collection(`notes/${noteId}/versions`).get()).docs.map((doc) => doc.data());
    expect(version).toMatchObject({ reason: 'archive', isArchived: false });
    expect(String(version.replacedBy)).toMatch(/^mcp:/);
  });

  it('archived from the app: the scheduler does not send even before the trigger deletes the reminders', async () => {
    const noteId = await seedWithReminders();
    // כמו `archiveNote` באפליקציה; הטריגר עוד לא רץ
    await db.doc(`notes/${noteId}`).update({ isArchived: true, archivedAt: Timestamp.now() });
    expect((await remindersOf(noteId)).length).toBeGreaterThan(0);
    expect(await sendAllDue(noteId)).toEqual([]);
    expect(await remindersOf(noteId)).toEqual([]);
  });

  it('archive then list: the note leaves list_notes and appears with archived: true', async () => {
    const noteId = await seedWithReminders();
    await call(clientA, 'archive_note', { noteId });
    expect((await call(clientA, 'list_notes', { limit: 100 })).text).not.toContain(noteId);
    expect((await call(clientA, 'list_notes', { archived: true, limit: 100 })).text).toContain(noteId);
    expect((await call(clientA, 'archive_note', { noteId })).text).toContain('already in the archive');
  });

  it('unarchiving brings back the reminders still ahead: the future one, and the next daily one - not the past one', async () => {
    const noteId = await seedWithReminders();
    await call(clientA, 'archive_note', { noteId });
    const before = await stored(noteId);
    const result = await call(clientA, 'unarchive_note', { noteId });
    expect(result.isError).toBe(false);
    expect(await stored(noteId)).toMatchObject({ isArchived: false, archivedAt: null });

    await trigger(noteId, before);
    const reminders = await remindersOf(noteId);
    expect(reminders.map((reminder) => reminder.itemId).sort()).toEqual(['daily', 'milk']);
    const milk = reminders.find((reminder) => reminder.itemId === 'milk');
    expect((milk?.remindAt as Timestamp).toDate().toISOString()).toBe(localDateTimeToDate(future, '09:30')?.toISOString());
    expect((reminders.find((reminder) => reminder.itemId === 'daily')?.remindAt as Timestamp).toMillis()).toBeGreaterThan(Date.now());
  });
});

// ---------------------------------------------------------------------------
// הוספה והסרה של משימות
// ---------------------------------------------------------------------------

describe('add_checklist_items and remove_checklist_item', () => {
  it('adds tasks after a given item, schedules their reminders, and ignores a retry', async () => {
    const noteId = await seedWithReminders();
    const before = await stored(noteId);
    const args = { noteId, afterItemId: 'milk', items: [{ text: 'לתקן ברז', dueDate: israelDate(4), dueTime: '17:00' }, { text: 'להתקשר לסבתא' }] };
    const result = await call(clientA, 'add_checklist_items', args);
    expect(result.text).toContain('Added 2 task(s)');
    expect(result.text).toContain('1 with a reminder');

    const texts = JSON.parse((await stored(noteId)).content).map((row: { text: string }) => row.text);
    expect(texts).toEqual(['לקנות חלב', 'לתקן ברז', 'להתקשר לסבתא', 'משהו שעבר', 'תרופה']);

    await trigger(noteId, before);
    const reminders = await remindersOf(noteId);
    expect(reminders.map((reminder) => reminder.itemText)).toContain('לתקן ברז');

    const again = await call(clientA, 'add_checklist_items', args);
    expect(again.text).toContain('already added');
    expect(JSON.parse((await stored(noteId)).content)).toHaveLength(5);
  });

  it('refuses a task time that already passed, and writes nothing', async () => {
    const noteId = await seedWithReminders();
    const result = await call(clientA, 'add_checklist_items', { noteId, items: [{ text: 'x', dueDate: israelDate(-1), dueTime: '09:00' }] });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('has already passed');
    expect((await stored(noteId)).revision).toBe(3);
  });

  it('removing a task cancels its reminder at once, audits it, and says it is in history', async () => {
    const noteId = await seedWithReminders();
    const before = await stored(noteId);
    const result = await call(clientA, 'remove_checklist_item', { noteId, itemId: 'milk' });
    expect(result.text).toContain('reminder is cancelled');
    expect(result.text).toContain('history');
    expect((await remindersOf(noteId)).map((reminder) => reminder.itemId)).toEqual(['daily']);

    await trigger(noteId, before);
    expect(await sendAllDue(noteId)).toEqual(['daily']);

    const [entry] = (await db.collection('auditLog').where('target.id', '==', noteId).get()).docs.map((doc) => doc.data());
    expect(entry).toMatchObject({ action: 'checklist_item.remove', changes: { before: { id: 'milk', text: 'לקנות חלב' }, after: null } });
  });
});

// ---------------------------------------------------------------------------
// העברה בין קטגוריות
// ---------------------------------------------------------------------------

describe('move_note_to_category', () => {
  it("moves to another of the user's categories, and the reminders follow", async () => {
    const noteId = await seedWithReminders();
    const before = await stored(noteId);
    const result = await call(clientA, 'move_note_to_category', { noteId, categoryId: C.work });
    expect(result.isError).toBe(false);
    expect((await stored(noteId)).categoryId).toBe(C.work);
    for (const reminder of await remindersOf(noteId)) expect(reminder.categoryId).toBe(C.work);

    await trigger(noteId, before);
    const [version] = (await db.collection(`notes/${noteId}/versions`).get()).docs.map((doc) => doc.data());
    expect(version).toMatchObject({ reason: 'move', categoryId: C.home });

    // הקישור ב"פעילות Claude" מוביל לקטגוריה החדשה
    const [entry] = (await db.collection('auditLog').where('target.id', '==', noteId).get()).docs.map((doc) => doc.data());
    expect(entry).toMatchObject({ action: 'note.move', summary: { categoryId: C.work }, changes: { before: { categoryId: C.home } } });
  });

  it.each([
    ['a sensitive category', () => C.secret],
    ["another user's category", () => C.bOwn],
    ['a category shared with the user (not their own)', () => C.sharedFromB],
    ['a category that does not exist', () => id('nope')],
  ])('%s gets the same answer, which says sensitive ones are moved in the app', async (_label, target) => {
    const noteId = await seedWithReminders();
    const result = await call(clientA, 'move_note_to_category', { noteId, categoryId: target() });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('the user can do it in the app');
    expect((await stored(noteId)).categoryId).toBe(C.home);
  });

  it('a read-only target category is refused with a read-only message', async () => {
    const noteId = await seedWithReminders();
    const result = await call(clientA, 'move_note_to_category', { noteId, categoryId: C.readOnly });
    expect(result.text).toMatch(/^Read-only: The target category is read-only for Claude/);
  });
});

// ---------------------------------------------------------------------------
// אותם כללים כמו שאר כלי העריכה
// ---------------------------------------------------------------------------

describe('the usual refusals', () => {
  const everyTool = (noteId: string) =>
    [
      ['archive_note', { noteId }],
      ['add_checklist_items', { noteId, items: [{ text: 'x' }] }],
      ['remove_checklist_item', { noteId, itemId: 'milk' }],
      ['move_note_to_category', { noteId, categoryId: C.work }],
    ] as const;

  const expectAll = async (noteId: string, check: (text: string) => void) => {
    for (const [tool, args] of everyTool(noteId)) {
      const result = await call(clientA, tool, args);
      expect({ tool, isError: result.isError }).toEqual({ tool, isError: true });
      check(result.text);
    }
    expect(await stored(noteId)).toMatchObject({ revision: 3, isArchived: false, categoryId: expect.any(String) });
  };

  it('open in the app', async () => {
    const noteId = await seedWithReminders();
    await db.doc(`notes/${noteId}/presence/s1`).set({
      uid: users.a, device: 'iPhone', refreshedAt: Timestamp.fromMillis(Date.now() - 5_000), expiresAt: Timestamp.fromMillis(Date.now() + 55_000),
    });
    await expectAll(noteId, (text) => expect(text).toContain('open in the app right now'));
  });

  it('read-only note', async () => {
    await expectAll(await seedWithReminders({ isReadOnly: true }), (text) => expect(text).toMatch(/^Read-only:/));
  });

  it('sensitive note: not found', async () => {
    await expectAll(await seedWithReminders({ isSensitive: true }), (text) => expect(text).toBe(NOT_FOUND_TEXT));
  });

  it("another user's shared note: owner only", async () => {
    const noteId = id(`org-${counter++}`);
    await db.doc(`notes/${noteId}`).set(note(users.b, C.bOwn, { sharedWith: [users.a] }));
    await expectAll(noteId, (text) => expect(text).toContain("only the user's own notes"));
  });
});
