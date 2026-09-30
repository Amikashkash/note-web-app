/**
 * `create_note` מקצה לקצה (mcp-plan שלב 2א), מול Firestore ו-Auth emulators.
 *
 * הזרימה המלאה: Claude (הלקוח הרשמי של ה-SDK) יוצר רשימת משימות עם שעה →
 * הפתק נכתב עם `createdVia` ורשומת audit → הטריגר (`handleNoteWritten`,
 * אותו קוד ש-`onNoteWritten` מריץ) יוצר את התזכורת בשעון ישראל → המתזמן
 * (`processDueReminders`) שולח אותה פעם אחת בדיוק.
 *
 * ובנוסף: קטגוריה לקריאה בלבד, זרה, משותפת או רגישה; חיבור לקריאה בלבד;
 * כפילויות (גם במקביל); הגבלת קצב לכתיבות; ולוג בלי תוכן.
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

// איסוף הלוג לפני שה-logger נטען (ראו oauth.emulator.test.ts)
const captured: string[] = [];
for (const method of ['debug', 'info', 'log', 'warn', 'error'] as const) {
  const original = console[method].bind(console);
  console[method] = (...args: unknown[]) => {
    captured.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
    original(...args);
  };
}

type HttpModule = typeof import('../src/mcp/http');
let createMcpApp: HttpModule['createMcpApp'];
let NOT_FOUND_TEXT = '';
let logger: (typeof import('firebase-functions'))['logger'];

const adminApp = initializeApp({ projectId: 'demo-notes-4-me' }, 'create-note-emulator-test');
const db = getFirestore(adminApp);
const auth = getAuth(adminApp);
const store = OAuthStore.create(db);

const RUN = Date.now().toString(36);
const id = (name: string) => `${name}-${RUN}`;
const AT = Timestamp.fromDate(new Date('2026-09-20T10:00:00Z'));
const RESOURCE = 'https://notes-4-me.web.app/mcp';

const users = { a: '', b: '' };

/** מה שאסור שיופיע בלוג */
const PRIVATE = { title: `משימות-לשבוע-${RUN}`, item: `לשלם-ארנונה-${RUN}` };

const C = {
  home: id('cat-home'),
  readOnly: id('cat-readonly'),
  secret: id('cat-secret'),
  sharedToB: id('cat-shared-to-b'),
  bOwn: id('cat-b'),
};

const N = { readOnlyNote: id('note-readonly'), inReadOnlyCategory: id('note-in-ro-cat') };

const GENEROUS = Object.fromEntries(
  Object.keys(RATE_LIMITS).map((endpoint) => [
    endpoint,
    { perIp: [{ name: 'minute', windowMs: 60_000, max: 10_000 }], global: [{ name: 'minute', windowMs: 60_000, max: 10_000 }] },
  ])
) as unknown as typeof RATE_LIMITS;
const MANY = [{ name: 'minute', windowMs: 60_000, max: 10_000 }];

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
  content: 'תוכן',
  categoryId,
  templateType: 'plain',
  tags: [],
  color: null,
  order: 3,
  userId,
  sharedWith: [],
  isPinned: false,
  isArchived: false,
  isSensitive: false,
  isReadOnly: false,
  createdAt: AT,
  updatedAt: AT,
  ...extra,
});

const listen = (app: ReturnType<HttpModule['createMcpApp']>) =>
  new Promise<{ server: Server; base: string }>((resolve) => {
    const started = app.listen(0, '127.0.0.1', () =>
      resolve({ server: started, base: `http://127.0.0.1:${(started.address() as AddressInfo).port}` })
    );
  });

const appFor = (extra: Partial<Parameters<HttpModule['createMcpApp']>[0]> = {}) =>
  createMcpApp({
    store,
    auth,
    rateLimits: GENEROUS,
    mcpLimits: MANY,
    mcpWriteLimits: MANY,
    scopeFor: (identity) => UserScope.for(identity, db),
    ...extra,
  });

let server: Server;
let base = '';

beforeAll(async () => {
  ({ createMcpApp } = await import('../src/mcp/http'));
  ({ NOT_FOUND_TEXT } = await import('../src/mcp/tools'));
  ({ logger } = await import('firebase-functions'));

  for (const name of Object.keys(users) as (keyof typeof users)[]) {
    users[name] = (await auth.createUser({ email: `create-${name}-${RUN}@example.com`, emailVerified: true })).uid;
  }
  // config/mcp משותף לכל קובצי הבדיקה: מוסיפים ולא דורסים
  const config = (await db.doc('config/mcp').get()).data() ?? {};
  await db.doc('config/mcp').set({ ...config, allowedUids: [...(config.allowedUids ?? []), users.a, users.b] });

  const batch = db.batch();
  const put = (path: string, data: DocumentData) => batch.set(db.doc(path), data);
  put(`categories/${C.home}`, category(users.a, { name: 'בית' }));
  put(`categories/${C.readOnly}`, category(users.a, { name: 'ארכיון מסמכים', isReadOnly: true }));
  put(`categories/${C.secret}`, category(users.a, { name: 'כספים', isSensitive: true }));
  put(`categories/${C.sharedToB}`, category(users.a, { name: 'משפחה', sharedWith: [users.b] }));
  put(`categories/${C.bOwn}`, category(users.b, { name: 'של B' }));
  put(`notes/${id('existing')}`, note(users.a, C.home, { order: 7 }));
  put(`notes/${N.readOnlyNote}`, note(users.a, C.home, { title: 'חוזה', isReadOnly: true }));
  put(`notes/${N.inReadOnlyCategory}`, note(users.a, C.readOnly, { title: 'תעודה' }));
  await batch.commit();

  ({ server, base } = await listen(appFor()));
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await deleteApp(adminApp);
});

// ---------------------------------------------------------------------------
// עוזרים
// ---------------------------------------------------------------------------

const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');

const issueToken = async (uid: string, scope = 'notes.read notes.write offline_access') => {
  const token = `n4m_at_${randomBytes(32).toString('base64url')}`;
  const grantId = randomBytes(32).toString('base64url');
  const now = Date.now();
  await db.doc(`oauthGrants/${grantId}`).set({
    grantId,
    uid,
    clientId: 'test-client',
    clientName: 'Claude',
    scope,
    consentVersion: CONSENT_VERSION,
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

const connect = async (token: string, target = base) => {
  const client = new Client({ name: 'create-test', version: '1.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${target}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } })
  );
  return client;
};

const call = async (client: Client, name: string, args: Record<string, unknown>) => {
  const result = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
  return { text: result.content.map((part) => part.text).join('\n'), isError: result.isError === true };
};

const idFrom = (text: string): string => /\[id: ([^\]]+)\]/.exec(text)?.[1] ?? '';

const notesIn = async (categoryId: string) =>
  (await db.collection('notes').where('categoryId', '==', categoryId).get()).docs;

const auditFor = async (noteId: string) =>
  (await db.collection('auditLog').where('target.id', '==', noteId).get()).docs.map((doc) => doc.data());

/** "היום + ימים" כתאריך בישראל, YYYY-MM-DD */
const israelDate = (daysAhead: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(Date.now() + daysAhead * 86_400_000));

let clientA: Client;
let grantA = '';

beforeAll(async () => {
  const issued = await issueToken(users.a);
  grantA = issued.grantId;
  clientA = await connect(issued.token);
});

afterAll(async () => {
  await clientA?.close();
});

// ---------------------------------------------------------------------------
// הזרימה המלאה, עד התזכורת
// ---------------------------------------------------------------------------

describe('create a checklist with a reminder, end to end', () => {
  it('creates the note, schedules the reminder in Israel time, and sends it exactly once', async () => {
    const dueDate = israelDate(3);
    const created = await call(clientA, 'create_note', {
      categoryId: C.home,
      title: PRIVATE.title,
      type: 'checklist',
      items: [{ text: PRIVATE.item, dueDate, dueTime: '09:30' }, { text: 'לקנות חלב' }],
    });
    expect(created.isError).toBe(false);
    expect(created.text).toContain('Created the checklist');
    expect(created.text).toContain(`${dueDate} 09:30`);
    const noteId = idFrom(created.text);

    // הפתק: בפורמט של האפליקציה, מסומן כנוצר ע"י Claude, בסוף הקטגוריה
    const stored = (await db.doc(`notes/${noteId}`).get()).data() ?? {};
    expect(stored).toMatchObject({
      title: PRIVATE.title,
      templateType: 'checklist',
      userId: users.a,
      categoryId: C.home,
      createdVia: 'mcp',
      isReadOnly: false,
      isSensitive: false,
      isArchived: false,
      order: 8,
      updatedBy: users.a,
    });
    expect(JSON.parse(stored.content as string)[0]).toMatchObject({ text: PRIVATE.item, dueDate, dueTime: '09:30', completed: false });

    // audit: מי, דרך איזה חיבור, מה נוצר
    const [entry, ...rest] = await auditFor(noteId);
    expect(rest).toEqual([]);
    expect(entry).toMatchObject({
      uid: users.a,
      grantId: grantA,
      clientName: 'Claude',
      tool: 'create_note',
      action: 'note.create',
      summary: { title: PRIVATE.title, templateType: 'checklist', categoryName: 'בית', itemCount: 2, reminderCount: 1 },
    });
    expect(entry.at).toBeInstanceOf(Timestamp);

    // הטריגר: אותו קוד ש-onNoteWritten מריץ על הכתיבה
    await handleNoteWritten({ db, noteId, before: undefined, after: stored });
    const reminders = (await db.collection('reminders').where('noteId', '==', noteId).get()).docs;
    expect(reminders).toHaveLength(1);
    const remindAt = (reminders[0].get('remindAt') as Timestamp).toDate();
    expect(remindAt.toISOString()).toBe(localDateTimeToDate(dueDate, '09:30')?.toISOString());
    expect(reminders[0].get('itemText')).toBe(PRIVATE.item);

    // המתזמן: בזמן, פעם אחת בלבד
    const sent: string[] = [];
    const deps = {
      getTokens: async () => [{ token: 't', path: `users/${users.a}/fcmTokens/t` }],
      send: async (_tokens: unknown, payload: { noteId: string }) => {
        sent.push(payload.noteId);
        return [];
      },
    };
    await processDueReminders({ db, now: new Date(remindAt.getTime() - 60_000), ...deps });
    expect(sent.filter((value) => value === noteId)).toEqual([]);
    await processDueReminders({ db, now: new Date(remindAt.getTime() + 1_000), ...deps });
    await processDueReminders({ db, now: new Date(remindAt.getTime() + 61_000), ...deps });
    expect(sent.filter((value) => value === noteId)).toEqual([noteId]);
  });

  it('creates a text note and a shopping list', async () => {
    const text = await call(clientA, 'create_note', { categoryId: C.home, title: 'רעיון', type: 'text', text: 'לבנות מדף' });
    expect((await db.doc(`notes/${idFrom(text.text)}`).get()).data()).toMatchObject({ templateType: 'plain', content: 'לבנות מדף' });

    const shopping = await call(clientA, 'create_note', {
      categoryId: C.home,
      title: 'סופר',
      type: 'shopping',
      items: [{ text: 'עגבניות', quantity: '1 ק"ג' }],
    });
    const content = JSON.parse((await db.doc(`notes/${idFrom(shopping.text)}`).get()).get('content') as string);
    expect(content[0]).toMatchObject({ name: 'עגבניות', quantity: '1 ק"ג', checked: false });
  });
});

// ---------------------------------------------------------------------------
// איפה מותר ליצור
// ---------------------------------------------------------------------------

describe('target category', () => {
  const attempt = (client: Client, categoryId: string) =>
    call(client, 'create_note', { categoryId, title: `ניסיון ${Math.random()}`, type: 'text', text: 'x' });

  it('a read-only category refuses with a clear read-only message, and nothing is written', async () => {
    const before = (await notesIn(C.readOnly)).length;
    const result = await attempt(clientA, C.readOnly);
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/^Read-only: The category is read-only for Claude/);
    expect(await notesIn(C.readOnly)).toHaveLength(before);
  });

  it.each([
    ['a sensitive category', () => C.secret],
    ["another user's category", () => C.bOwn],
    ['a category that does not exist', () => id('nope')],
  ])('%s gives the same not-found answer as always', async (_label, categoryId) => {
    expect(await attempt(clientA, categoryId())).toEqual({ text: NOT_FOUND_TEXT, isError: true });
  });

  it('a category shared with the user is not a target (only own categories)', async () => {
    const clientB = await connect((await issueToken(users.b)).token);
    try {
      const before = (await notesIn(C.sharedToB)).length;
      expect(await attempt(clientB, C.sharedToB)).toEqual({ text: NOT_FOUND_TEXT, isError: true });
      expect(await notesIn(C.sharedToB)).toHaveLength(before);
    } finally {
      await clientB.close();
    }
  });
});

// ---------------------------------------------------------------------------
// הרשאה, כפילויות, קצב, ולידציה
// ---------------------------------------------------------------------------

describe('write access', () => {
  it('a connection approved for reading only is told how to get write access, and nothing is written', async () => {
    const readOnlyClient = await connect((await issueToken(users.a, 'notes.read offline_access')).token);
    try {
      const before = (await notesIn(C.home)).length;
      const result = await call(readOnlyClient, 'create_note', { categoryId: C.home, title: 'x', type: 'text', text: 'x' });
      expect(result.isError).toBe(true);
      expect(result.text).toContain('approved for reading only');
      expect(result.text).toContain('connect again');
      expect(await notesIn(C.home)).toHaveLength(before);
      // הקריאה ממשיכה לעבוד
      expect((await call(readOnlyClient, 'list_categories', {})).isError).toBe(false);
    } finally {
      await readOnlyClient.close();
    }
  });
});

describe('duplicates', () => {
  it('the same note again within 10 minutes returns the first one instead of a second copy', async () => {
    const args = { categoryId: C.home, title: 'כפילות', type: 'checklist', items: [{ text: 'פריט' }] };
    const first = await call(clientA, 'create_note', args);
    const again = await call(clientA, 'create_note', args);

    expect(again.isError).toBe(false);
    expect(again.text).toContain('already created');
    expect(idFrom(again.text)).toBe(idFrom(first.text));
    const copies = (await notesIn(C.home)).filter((doc) => doc.get('title') === 'כפילות');
    expect(copies).toHaveLength(1);
    expect(await auditFor(idFrom(first.text))).toHaveLength(1);
  });

  it('two identical calls at the same moment create one note', async () => {
    const args = { categoryId: C.home, title: 'במקביל', type: 'text', text: 'retry אחרי timeout' };
    const results = await Promise.all([call(clientA, 'create_note', args), call(clientA, 'create_note', args)]);
    expect(new Set(results.map((result) => idFrom(result.text))).size).toBe(1);
    expect((await notesIn(C.home)).filter((doc) => doc.get('title') === 'במקביל')).toHaveLength(1);
  });

  it('a different title is a different note', async () => {
    const first = await call(clientA, 'create_note', { categoryId: C.home, title: 'שונה 1', type: 'text', text: 'x' });
    const second = await call(clientA, 'create_note', { categoryId: C.home, title: 'שונה 2', type: 'text', text: 'x' });
    expect(idFrom(first.text)).not.toBe(idFrom(second.text));
  });
});

describe('validation and limits', () => {
  it('a time that already passed is refused with a message Claude can act on', async () => {
    const result = await call(clientA, 'create_note', {
      categoryId: C.home,
      title: 'מאוחר',
      type: 'checklist',
      items: [{ text: 'x', dueDate: israelDate(-1), dueTime: '09:00' }],
    });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('has already passed');
  });

  it('the per-user write limit stops a burst of creates', async () => {
    // משתמש משלו: המונה לכל משתמש, וכל ניסיון כתיבה שעבר ולידציה נספר
    const uid = (await auth.createUser({ email: `create-burst-${RUN}@example.com`, emailVerified: true })).uid;
    const config = (await db.doc('config/mcp').get()).data() ?? {};
    await db.doc('config/mcp').set({ ...config, allowedUids: [...(config.allowedUids ?? []), uid] });
    await db.doc(`categories/${id('cat-burst')}`).set(category(uid));

    const strict = await listen(appFor({ mcpWriteLimits: [{ name: 'minute', windowMs: 60_000, max: 2 }] }));
    const client = await connect((await issueToken(uid)).token, strict.base);
    try {
      const results = [];
      for (let i = 0; i < 3; i++) {
        results.push(
          await call(client, 'create_note', { categoryId: id('cat-burst'), title: `פרץ ${i}`, type: 'text', text: 'x' })
        );
      }
      expect(results.slice(0, 2).every((result) => !result.isError)).toBe(true);
      expect(results[2]).toMatchObject({ isError: true });
      expect(results[2].text).toContain('too many notes were created recently');
    } finally {
      await client.close();
      await new Promise((resolve) => strict.server.close(resolve));
    }
  });
});

// ---------------------------------------------------------------------------
// קריאה בלבד בפלט של כלי הקריאה
// ---------------------------------------------------------------------------

describe('read tools show read-only and created-by-Claude', () => {
  it('list_notes marks a read-only note, and a note in a read-only category', async () => {
    const all = await call(clientA, 'list_notes', { limit: 100 });
    const lineOf = (noteId: string) => all.text.split('\n\n').find((block) => block.includes(noteId)) ?? '';
    expect(lineOf(N.readOnlyNote)).toContain('read-only for Claude');
    expect(lineOf(N.inReadOnlyCategory)).toContain('read-only for Claude');
    expect(lineOf(id('existing'))).not.toContain('read-only');
  });

  it('get_note says it is read-only, and that Claude created it', async () => {
    expect((await call(clientA, 'get_note', { noteId: N.readOnlyNote })).text).toContain('Read-only for Claude: yes');
    const created = await call(clientA, 'create_note', { categoryId: C.home, title: 'נוצר', type: 'text', text: 'x' });
    expect((await call(clientA, 'get_note', { noteId: idFrom(created.text) })).text).toContain('Created by: Claude');
  });

  it('list_categories marks the read-only category', async () => {
    const { text } = await call(clientA, 'list_categories', {});
    expect(text.split('\n').find((line) => line.includes(C.readOnly))).toContain('read-only for Claude (no new notes)');
  });
});

describe('logs', () => {
  it('the capture sees the logger (canary)', () => {
    logger.info('create.canary', { marker: `canary-${RUN}` });
    expect(captured.join('\n')).toContain(`canary-${RUN}`);
  });

  it('create_note is logged without its title or items', () => {
    const log = captured.join('\n');
    expect(log).toContain('"tool":"create_note"');
    for (const value of Object.values(PRIVATE)) expect(log).not.toContain(value);
  });
});
