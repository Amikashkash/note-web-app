/**
 * `update_checklist_item` ו-`append_to_text_note` מקצה לקצה (שלב 2ב-lite).
 *
 * הלקוח הרשמי של ה-SDK קורא לכלים; אחרי כל עריכה רץ `handleNoteWritten`
 * (אותו קוד ש-`onNoteWritten` מריץ) על המצב לפני ואחרי, ובודקים:
 * - התזכורות: סימון כבוצע מבטל, שינוי תאריך/שעה מזיז, חזרה משתנה, ביטול
 *   סימון מחזיר, הסרת השעה מבטלת.
 * - היסטוריית גרסאות: המצב שלפני Claude נשמר (כותב אחר).
 * - revision עולה, audit עם לפני ואחרי.
 * - סירובים: קריאה בלבד, רגיש, משותף, מאורכב, פתוח באפליקציה, חיבור ישן.
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
import { RATE_LIMITS } from '../src/oauth/config';
import { handleNoteWritten } from '../src/noteWritten';
import { localDateTimeToDate } from '../src/timezone';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run through `npm run test:functions:emulator` - emulator hosts are not set');
}

type HttpModule = typeof import('../src/mcp/http');
let createMcpApp: HttpModule['createMcpApp'];
let NOT_FOUND_TEXT = '';

const adminApp = initializeApp({ projectId: 'demo-notes-4-me' }, 'edit-note-emulator-test');
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

/** "היום + ימים" כתאריך בישראל */
const israelDate = (daysAhead: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(Date.now() + daysAhead * 86_400_000));

const C = { home: id('cat-home'), readOnly: id('cat-ro'), secret: id('cat-secret'), bOwn: id('cat-b') };

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

const note = (userId: string, categoryId: string, extra: DocumentData = {}) => ({
  title: 'פתק',
  content: '',
  categoryId,
  templateType: 'plain',
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
  revision: 4,
  ...extra,
});

let server: Server;
let base = '';

const listen = (app: ReturnType<HttpModule['createMcpApp']>) =>
  new Promise<{ server: Server; base: string }>((resolve) => {
    const started = app.listen(0, '127.0.0.1', () =>
      resolve({ server: started, base: `http://127.0.0.1:${(started.address() as AddressInfo).port}` })
    );
  });

const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');

const issueToken = async (uid: string, consentVersion: number | null = 2) => {
  const token = `n4m_at_${randomBytes(32).toString('base64url')}`;
  const grantId = randomBytes(32).toString('base64url');
  const now = Date.now();
  const scope = 'notes.read notes.write offline_access';
  await db.doc(`oauthGrants/${grantId}`).set({
    grantId,
    uid,
    clientId: 'test-client',
    clientName: 'Claude',
    scope,
    ...(consentVersion === null ? {} : { consentVersion }),
    createdAt: Timestamp.fromMillis(now),
    lastUsedAt: Timestamp.fromMillis(now),
    absoluteExpiresAt: Timestamp.fromMillis(now + 90 * 86_400_000),
    revoked: false,
    revokedReason: null,
  });
  await db.doc(`oauthTokens/${sha256Hex(token)}`).set({
    type: 'access',
    grantId,
    uid,
    clientId: 'test-client',
    scope,
    resource: RESOURCE,
    createdAt: Timestamp.fromMillis(now),
    expiresAt: Timestamp.fromMillis(now + 3_600_000),
    used: false,
    revoked: false,
  });
  return { token, grantId };
};

const connect = async (token: string) => {
  const client = new Client({ name: 'edit-test', version: '1.0.0' });
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
let grantA = '';

beforeAll(async () => {
  ({ createMcpApp } = await import('../src/mcp/http'));
  ({ NOT_FOUND_TEXT } = await import('../src/mcp/tools'));

  for (const name of Object.keys(users) as (keyof typeof users)[]) {
    users[name] = (await auth.createUser({ email: `edit-${name}-${RUN}@example.com`, emailVerified: true })).uid;
  }
  const config = (await db.doc('config/mcp').get()).data() ?? {};
  await db.doc('config/mcp').set({ ...config, allowedUids: [...(config.allowedUids ?? []), users.a, users.b] });

  const batch = db.batch();
  batch.set(db.doc(`categories/${C.home}`), category(users.a));
  batch.set(db.doc(`categories/${C.readOnly}`), category(users.a, { isReadOnly: true }));
  batch.set(db.doc(`categories/${C.secret}`), category(users.a, { isSensitive: true }));
  batch.set(db.doc(`categories/${C.bOwn}`), category(users.b));
  await batch.commit();

  ({ server, base } = await listen(
    createMcpApp({
      store,
      auth,
      rateLimits: GENEROUS,
      mcpLimits: MANY,
      mcpWriteLimits: MANY,
      scopeFor: (identity) => UserScope.for(identity, db),
    })
  ));
  const issued = await issueToken(users.a);
  grantA = issued.grantId;
  clientA = await connect(issued.token);
});

afterAll(async () => {
  await clientA?.close();
  await new Promise((resolve) => server.close(resolve));
  await deleteApp(adminApp);
});

/** פתק חדש לבדיקה, ומחזיר את המזהה */
let counter = 0;
const seed = async (data: DocumentData) => {
  const noteId = id(`note-${counter++}`);
  await db.doc(`notes/${noteId}`).set(data);
  return noteId;
};

/** מריץ את הטריגר על השינוי האחרון, ומחזיר את התזכורות של הפתק */
const runTrigger = async (noteId: string, before: DocumentData) => {
  const after = (await db.doc(`notes/${noteId}`).get()).data();
  await handleNoteWritten({ db, noteId, before, after });
  return (await db.collection('reminders').where('noteId', '==', noteId).get()).docs.map((doc) => doc.data());
};

const stored = async (noteId: string) => (await db.doc(`notes/${noteId}`).get()).data() ?? {};

// ---------------------------------------------------------------------------
// update_checklist_item והתזכורות
// ---------------------------------------------------------------------------

describe('update_checklist_item and reminders', () => {
  const dueDate = israelDate(3);
  const items = () => [
    { id: 'milk', text: 'לקנות חלב', completed: false, dueDate, dueTime: '09:30', note: 'שדה לא מוכר' },
    { id: 'rent', text: 'שכר דירה', completed: false },
  ];

  /** פתק עם תזכורת פעילה על "milk" */
  const seedWithReminder = async () => {
    const noteId = await seed(note(users.a, C.home, { templateType: 'checklist', content: JSON.stringify(items()) }));
    const reminders = await runTrigger(noteId, { ...note(users.a, C.home), templateType: 'checklist', content: '[]' });
    expect(reminders).toHaveLength(1);
    return noteId;
  };

  it('get_note shows each task with the id the tool needs', async () => {
    const noteId = await seedWithReminder();
    const { text } = await call(clientA, 'get_note', { noteId });
    expect(text).toContain(`- [ ] לקנות חלב  (item id: milk · due ${dueDate} 09:30)`);
    expect(text).toContain('- [ ] שכר דירה  (item id: rent)');
  });

  it('marking a task done writes one field, bumps the revision, records before and after, and cancels its reminder', async () => {
    const noteId = await seedWithReminder();
    const before = await stored(noteId);
    const result = await call(clientA, 'update_checklist_item', { noteId, itemId: 'milk', completed: true });
    expect(result.isError).toBe(false);
    expect(result.text).toContain('Now: done');

    const after = await stored(noteId);
    expect(JSON.parse(after.content)).toEqual([{ ...items()[0], completed: true }, items()[1]]);
    expect(after.revision).toBe(5);
    expect(after.updatedBy).toBe('mcp:test-client');

    const audit = (await db.collection('auditLog').where('target.id', '==', noteId).get()).docs.map((doc) => doc.data());
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: 'checklist_item.update',
      grantId: grantA,
      tool: 'update_checklist_item',
      changes: { before: items()[0], after: { ...items()[0], completed: true } },
      summary: { revisionBefore: 4, revisionAfter: 5 },
    });

    expect(await runTrigger(noteId, before)).toEqual([]);
  });

  it('changing the date and time moves the reminder', async () => {
    const noteId = await seedWithReminder();
    const before = await stored(noteId);
    const newDate = israelDate(5);
    await call(clientA, 'update_checklist_item', { noteId, itemId: 'milk', dueDate: newDate, dueTime: '18:15' });
    const [reminder] = await runTrigger(noteId, before);
    expect((reminder.remindAt as Timestamp).toDate().toISOString()).toBe(localDateTimeToDate(newDate, '18:15')?.toISOString());
  });

  it('setting a repeat makes the reminder repeat', async () => {
    const noteId = await seedWithReminder();
    const before = await stored(noteId);
    await call(clientA, 'update_checklist_item', { noteId, itemId: 'milk', repeat: 'weekly' });
    const [reminder] = await runTrigger(noteId, before);
    expect(reminder).toMatchObject({ repeat: 'weekly', baseDate: dueDate, baseTime: '09:30' });
  });

  it('removing the time cancels the reminder, keeping the date', async () => {
    const noteId = await seedWithReminder();
    const before = await stored(noteId);
    await call(clientA, 'update_checklist_item', { noteId, itemId: 'milk', dueTime: null });
    expect(await runTrigger(noteId, before)).toEqual([]);
    expect(JSON.parse((await stored(noteId)).content)[0]).toMatchObject({ dueDate });
  });

  it('marking a done task as not done brings its reminder back', async () => {
    const noteId = await seed(
      note(users.a, C.home, { templateType: 'checklist', content: JSON.stringify([{ ...items()[0], completed: true }]) })
    );
    const before = await stored(noteId);
    await call(clientA, 'update_checklist_item', { noteId, itemId: 'milk', completed: false });
    expect(await runTrigger(noteId, before)).toHaveLength(1);
  });

  it('adding a time to a task without one creates a reminder', async () => {
    const noteId = await seedWithReminder();
    const before = await stored(noteId);
    await call(clientA, 'update_checklist_item', { noteId, itemId: 'rent', dueDate, dueTime: '08:00' });
    const reminders = await runTrigger(noteId, before);
    expect(reminders.map((reminder) => reminder.itemId).sort()).toEqual(['milk', 'rent']);
  });

  it('old tasks without ids: the ids get_note showed are saved with the first edit', async () => {
    const noteId = await seed(
      note(users.a, C.home, {
        templateType: 'checklist',
        content: JSON.stringify([{ text: 'ישן', completed: false }, { text: 'עוד', completed: false }]),
      })
    );
    expect((await call(clientA, 'get_note', { noteId })).text).toContain('(item id: item-1)');
    await call(clientA, 'update_checklist_item', { noteId, itemId: 'item-1', completed: true });
    expect(JSON.parse((await stored(noteId)).content)).toEqual([
      { text: 'ישן', completed: false, id: 'item-0' },
      { text: 'עוד', completed: true, id: 'item-1' },
    ]);
  });

  it('an unknown item id is refused with a pointer to get_note, and nothing is written', async () => {
    const noteId = await seedWithReminder();
    const result = await call(clientA, 'update_checklist_item', { noteId, itemId: 'nope', completed: true });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('Call get_note');
    expect((await stored(noteId)).revision).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// append_to_text_note
// ---------------------------------------------------------------------------

describe('append_to_text_note', () => {
  it('adds at the end, keeps the rest, and the version history keeps the state before Claude', async () => {
    const noteId = await seed(note(users.a, C.home, { content: 'שורה ראשונה' }));
    const before = await stored(noteId);
    const result = await call(clientA, 'append_to_text_note', { noteId, text: 'שורה שנוספה' });
    expect(result.isError).toBe(false);

    const after = await stored(noteId);
    expect(after.content).toBe('שורה ראשונה\nשורה שנוספה');
    expect(after.revision).toBe(5);

    await runTrigger(noteId, before);
    const versions = (await db.collection(`notes/${noteId}/versions`).get()).docs.map((doc) => doc.data());
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ content: 'שורה ראשונה', reason: 'writer', replacedBy: 'mcp:test-client' });

    const [entry] = (await db.collection('auditLog').where('target.id', '==', noteId).get()).docs.map((doc) => doc.data());
    expect(entry).toMatchObject({ action: 'note.append', changes: { after: { appended: 'שורה שנוספה' } } });
  });

  it('the same text again within 10 minutes is not added twice', async () => {
    const noteId = await seed(note(users.a, C.home, { content: 'א' }));
    await call(clientA, 'append_to_text_note', { noteId, text: 'ב' });
    const again = await call(clientA, 'append_to_text_note', { noteId, text: 'ב' });
    expect(again.text).toContain('already added');
    expect((await stored(noteId)).content).toBe('א\nב');
  });

  it('refuses a checklist', async () => {
    const noteId = await seed(note(users.a, C.home, { templateType: 'checklist', content: '[]' }));
    expect((await call(clientA, 'append_to_text_note', { noteId, text: 'x' })).text).toContain('not a text note');
  });
});

// ---------------------------------------------------------------------------
// סירובים
// ---------------------------------------------------------------------------

describe('what Claude may not change', () => {
  const tryBoth = async (noteId: string) => [
    await call(clientA, 'append_to_text_note', { noteId, text: 'x' }),
    await call(clientA, 'update_checklist_item', { noteId, itemId: 'a', completed: true }),
  ];

  it('a note marked read-only, and a note in a read-only category', async () => {
    for (const noteId of [
      await seed(note(users.a, C.home, { isReadOnly: true })),
      await seed(note(users.a, C.readOnly)),
    ]) {
      for (const result of await tryBoth(noteId)) {
        expect(result.isError).toBe(true);
        expect(result.text).toMatch(/^Read-only: The note is read-only for Claude/);
      }
      expect((await stored(noteId)).revision).toBe(4);
    }
  });

  it('a sensitive note, a note in a sensitive category, a foreign note: the same not-found', async () => {
    for (const noteId of [
      await seed(note(users.a, C.home, { isSensitive: true })),
      await seed(note(users.a, C.secret)),
      await seed(note(users.b, C.bOwn)),
      id('does-not-exist'),
    ]) {
      for (const result of await tryBoth(noteId)) expect(result).toEqual({ text: NOT_FOUND_TEXT, isError: true });
    }
  });

  it("a note another user shared: only the user's own notes, for now", async () => {
    const noteId = await seed(note(users.b, C.bOwn, { sharedWith: [users.a] }));
    for (const result of await tryBoth(noteId)) expect(result.text).toContain("Claude can change only the user's own notes");
    expect((await stored(noteId)).revision).toBe(4);
  });

  it('an archived note', async () => {
    const noteId = await seed(note(users.a, C.home, { isArchived: true }));
    expect((await call(clientA, 'append_to_text_note', { noteId, text: 'x' })).text).toContain('archived');
  });

  it('a note open in the app is not changed; Claude is told to ask the user to close it', async () => {
    const noteId = await seed(note(users.a, C.home, { content: 'פתוח' }));
    await db.doc(`notes/${noteId}/presence/s1`).set({
      uid: users.a,
      device: 'iPhone',
      refreshedAt: Timestamp.fromMillis(Date.now() - 20_000),
      expiresAt: Timestamp.fromMillis(Date.now() + 40_000),
    });
    const result = await call(clientA, 'append_to_text_note', { noteId, text: 'x' });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('open in the app right now (on: iPhone)');
    expect(result.text).toContain('Ask the user to close the note');
    expect((await stored(noteId)).content).toBe('פתוח');
  });

  it('a presence marker that stopped refreshing a minute ago does not block', async () => {
    const noteId = await seed(note(users.a, C.home, { content: 'סגור' }));
    await db.doc(`notes/${noteId}/presence/s1`).set({
      uid: users.a,
      device: 'iPhone',
      refreshedAt: Timestamp.fromMillis(Date.now() - 90_000),
      expiresAt: Timestamp.fromMillis(Date.now() - 30_000),
    });
    expect((await call(clientA, 'append_to_text_note', { noteId, text: 'x' })).isError).toBe(false);
  });

  it('a connection approved before editing existed is told to reconnect, and nothing is written', async () => {
    const oldClient = await connect((await issueToken(users.a, null)).token);
    try {
      const noteId = await seed(note(users.a, C.home, { content: 'ישן' }));
      const result = await call(oldClient, 'append_to_text_note', { noteId, text: 'x' });
      expect(result.isError).toBe(true);
      expect(result.text).toContain('approved before editing existed');
      expect((await stored(noteId)).content).toBe('ישן');
      // יצירה עדיין מותרת לחיבור הזה - היא מה שהוא אישר
      expect(
        (await call(oldClient, 'create_note', { categoryId: C.home, title: `ישן ${RUN}`, type: 'text', text: 'x' })).isError
      ).toBe(false);
    } finally {
      await oldClient.close();
    }
  });
});
