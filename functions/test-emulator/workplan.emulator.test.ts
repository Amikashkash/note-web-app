/**
 * תכניות עבודה והחלפת טקסט (המשך 2ב-lite) מקצה לקצה, דרך הלקוח הרשמי של ה-SDK.
 *
 * לכל כלי חדש: transaction על הגרסה העדכנית, revision + 1, audit עם לפני
 * ואחרי, גרסה בהיסטוריה לכל עריכה (מסומנת Claude), וסירובים - פתוח
 * באפליקציה, קריאה בלבד, רגיש, משותף, וחיבור שאושר בנוסח ישן.
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

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run through `npm run test:functions:emulator` - emulator hosts are not set');
}

type HttpModule = typeof import('../src/mcp/http');
let createMcpApp: HttpModule['createMcpApp'];
let NOT_FOUND_TEXT = '';

const adminApp = initializeApp({ projectId: 'demo-notes-4-me' }, 'workplan-emulator-test');
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

const C = { home: id('cat-home'), readOnly: id('cat-ro'), secret: id('cat-secret'), bOwn: id('cat-b') };

const category = (userId: string, extra: DocumentData = {}) => ({
  name: 'פרויקטים',
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

const plan = [
  { id: 's1', header: 'תקציב', content: 'עד 40,000 ש״ח' },
  { id: 's2', header: 'קבלנים', content: 'לבקש 3 הצעות' },
];

const note = (userId: string, categoryId: string, extra: DocumentData = {}) => ({
  title: 'שיפוץ המטבח',
  content: JSON.stringify(plan),
  categoryId,
  templateType: 'workplan',
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
  revision: 7,
  ...extra,
});

let server: Server;
let base = '';

const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');

const issueToken = async (uid: string, consentVersion = 3) => {
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
    consentVersion,
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
  return token;
};

const connect = async (token: string) => {
  const client = new Client({ name: 'workplan-test', version: '1.0.0' });
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
    users[name] = (await auth.createUser({ email: `wp-${name}-${RUN}@example.com`, emailVerified: true })).uid;
  }
  const config = (await db.doc('config/mcp').get()).data() ?? {};
  await db.doc('config/mcp').set({ ...config, allowedUids: [...(config.allowedUids ?? []), users.a, users.b] });

  const batch = db.batch();
  batch.set(db.doc(`categories/${C.home}`), category(users.a));
  batch.set(db.doc(`categories/${C.readOnly}`), category(users.a, { isReadOnly: true }));
  batch.set(db.doc(`categories/${C.secret}`), category(users.a, { isSensitive: true }));
  batch.set(db.doc(`categories/${C.bOwn}`), category(users.b));
  await batch.commit();

  ({ server, base } = await new Promise<{ server: Server; base: string }>((resolve) => {
    const started = createMcpApp({
      store,
      auth,
      rateLimits: GENEROUS,
      mcpLimits: MANY,
      mcpWriteLimits: MANY,
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
const seed = async (data: DocumentData) => {
  const noteId = id(`wp-${counter++}`);
  await db.doc(`notes/${noteId}`).set(data);
  return noteId;
};
const stored = async (noteId: string) => (await db.doc(`notes/${noteId}`).get()).data() ?? {};
const sections = async (noteId: string) => JSON.parse((await stored(noteId)).content as string);
const auditFor = async (noteId: string) =>
  (await db.collection('auditLog').where('target.id', '==', noteId).get()).docs.map((doc) => doc.data());

/** מריץ את הטריגר על שינוי, כמו ש-onNoteWritten היה עושה */
const trigger = async (noteId: string, before: DocumentData) =>
  handleNoteWritten({ db, noteId, before, after: await stored(noteId) });
const versionsOf = async (noteId: string) =>
  (await db.collection(`notes/${noteId}/versions`).orderBy('capturedAt', 'asc').get()).docs.map((doc) => doc.data());

// ---------------------------------------------------------------------------
// יצירה וקריאה
// ---------------------------------------------------------------------------

describe('a work plan from start to finish', () => {
  it('create_note makes a work plan, and get_note shows each section with its id', async () => {
    const created = await call(clientA, 'create_note', {
      categoryId: C.home,
      title: `פרויקט גינה ${RUN}`,
      type: 'workplan',
      sections: [
        { header: 'מטרה', content: 'גינת ירק במרפסת' },
        { header: 'רשימת ציוד', content: 'אדניות, אדמה' },
      ],
    });
    expect(created.isError).toBe(false);
    expect(created.text).toContain('Created the work plan');
    expect(created.text).toContain('with 2 sections');
    const noteId = /\[id: ([^\]]+)\]/.exec(created.text)?.[1] ?? '';

    const read = await call(clientA, 'get_note', { noteId });
    const ids = [...read.text.matchAll(/\(section id: ([^)]+)\)/g)].map((match) => match[1]);
    expect(ids).toHaveLength(2);
    expect(read.text).toContain(`## מטרה  (section id: ${ids[0]})\nגינת ירק במרפסת`);
  });

  it('every tool, one after another: each change bumps the revision, is audited, and gets its own version as Claude', async () => {
    const noteId = await seed(note(users.a, C.home));
    const steps: Array<[string, Record<string, unknown>, string]> = [
      ['add_workplan_section', { header: 'לוח זמנים', content: 'לסיים עד חנוכה' }, 'workplan_section.add'],
      ['append_text', { sectionId: 's2', text: 'קבלן רביעי המליצו עליו' }, 'workplan_section.append'],
      ['edit_note_text', { sectionId: 's1', oldText: '40,000', newText: '45,000' }, 'note.replace'],
      ['edit_note_text', { sectionId: 's2', field: 'header', oldText: 'קבלנים', newText: 'בעלי מקצוע' }, 'note.replace'],
      ['remove_workplan_section', { sectionId: 's1' }, 'workplan_section.remove'],
    ];

    for (const [index, [tool, args, action]] of steps.entries()) {
      const before = await stored(noteId);
      const result = await call(clientA, tool, { noteId, ...args });
      expect({ tool, isError: result.isError }).toEqual({ tool, isError: false });
      expect(result.text).toContain('history');
      const after = await stored(noteId);
      expect(after.revision).toBe(7 + index + 1);
      expect(after.updatedBy).toMatch(/^mcp:test-client:/);
      await trigger(noteId, before);
      expect((await auditFor(noteId)).map((entry) => entry.action)).toContain(action);
    }

    expect(await sections(noteId)).toEqual([
      { id: 's2', header: 'בעלי מקצוע', content: 'לבקש 3 הצעות\nקבלן רביעי המליצו עליו' },
      expect.objectContaining({ header: 'לוח זמנים', content: 'לסיים עד חנוכה' }),
    ]);

    // גרסה לכל עריכה - כל אחת מהן ניתנת לשחזור, לא רק המצב שלפני הראשונה
    const versions = await versionsOf(noteId);
    expect(versions).toHaveLength(steps.length);
    for (const version of versions) {
      expect(version.reason).toBe('writer');
      expect(String(version.replacedBy)).toMatch(/^mcp:/);
    }
    expect(JSON.parse(versions[0].content as string)).toEqual(plan);

    // audit עם לפני ואחרי של החלק שהשתנה
    const removal = (await auditFor(noteId)).find((entry) => entry.action === 'workplan_section.remove');
    expect(removal?.changes).toEqual({ before: { id: 's1', header: 'תקציב', content: 'עד 45,000 ש״ח' }, after: null });
  });

  it('add_workplan_section can place the section right after another one', async () => {
    const noteId = await seed(note(users.a, C.home));
    await call(clientA, 'add_workplan_section', { noteId, header: 'מימון', content: 'הלוואה', afterSectionId: 's1' });
    expect((await sections(noteId)).map((section: { header: string }) => section.header)).toEqual(['תקציב', 'מימון', 'קבלנים']);
  });
});

// ---------------------------------------------------------------------------
// edit_note_text: התאמה מדויקת, עם עברית
// ---------------------------------------------------------------------------

describe('edit_note_text on text notes', () => {
  const textNote = (content: string) => note(users.a, C.home, { templateType: 'plain', content });

  it('replaces exactly once, and keeps everything around it byte for byte', async () => {
    const noteId = await seed(textNote('שורה 1\r\nפגישה ביום ראשון\r\nשורה 3  '));
    const result = await call(clientA, 'edit_note_text', { noteId, oldText: 'ביום ראשון', newText: 'ביום שני' });
    expect(result.isError).toBe(false);
    expect((await stored(noteId)).content).toBe('שורה 1\r\nפגישה ביום שני\r\nשורה 3  ');
  });

  it('matches text whose stored copy has direction marks Claude did not copy', async () => {
    const noteId = await seed(textNote('\u200Fלהתקשר ל\u200Fדני\u200F מחר'));
    await call(clientA, 'edit_note_text', { noteId, oldText: 'להתקשר לדני', newText: 'להתקשר לרותי' });
    expect((await stored(noteId)).content).toBe('\u200Fלהתקשר לרותי\u200F מחר');
  });

  it('a fragment that is missing or appears twice changes nothing, and Claude is told what to do', async () => {
    const noteId = await seed(textNote('חלב, לחם, חלב'));
    const twice = await call(clientA, 'edit_note_text', { noteId, oldText: 'חלב', newText: 'גבינה' });
    expect(twice.isError).toBe(true);
    expect(twice.text).toContain('appears 2 times');
    const missing = await call(clientA, 'edit_note_text', { noteId, oldText: 'ביצים', newText: 'גבינה' });
    expect(missing.text).toContain('was not found');
    expect(missing.text).toContain('Nothing was changed');
    expect(await stored(noteId)).toMatchObject({ content: 'חלב, לחם, חלב', revision: 7 });
    expect(await auditFor(noteId)).toEqual([]);
  });

  it('empty new text removes the fragment, and says it can be restored', async () => {
    const noteId = await seed(textNote('לקנות מתנה לאמא (סודי)'));
    const result = await call(clientA, 'edit_note_text', { noteId, oldText: ' (סודי)', newText: '' });
    expect(result.text).toMatch(/^Removed the text from/);
    expect(result.text).toContain('restore');
    expect((await stored(noteId)).content).toBe('לקנות מתנה לאמא');
  });
});

// ---------------------------------------------------------------------------
// סירובים - אותם כללים כמו update_checklist_item
// ---------------------------------------------------------------------------

describe('what the new tools refuse', () => {
  const everyTool = (noteId: string) => [
    ['add_workplan_section', { noteId, header: 'x', content: 'y' }],
    ['append_text', { noteId, sectionId: 's1', text: 'x' }],
    ['edit_note_text', { noteId, sectionId: 's1', oldText: 'תקציב', newText: 'x', field: 'header' }],
    ['remove_workplan_section', { noteId, sectionId: 's1' }],
  ] as const;

  const expectAll = async (noteId: string, check: (result: { text: string; isError: boolean }) => void) => {
    for (const [tool, args] of everyTool(noteId)) check(await call(clientA, tool, args));
    expect(await stored(noteId)).toMatchObject({ revision: 7, content: JSON.stringify(plan) });
  };

  it('a note open in the app', async () => {
    const noteId = await seed(note(users.a, C.home));
    await db.doc(`notes/${noteId}/presence/s1`).set({
      uid: users.a,
      device: 'טלפון Android',
      refreshedAt: Timestamp.fromMillis(Date.now() - 10_000),
      expiresAt: Timestamp.fromMillis(Date.now() + 50_000),
    });
    await expectAll(noteId, (result) => expect(result.text).toContain('open in the app right now (on: טלפון Android)'));
  });

  it('a read-only note and a note in a read-only category', async () => {
    for (const noteId of [await seed(note(users.a, C.home, { isReadOnly: true })), await seed(note(users.a, C.readOnly))]) {
      await expectAll(noteId, (result) => expect(result.text).toMatch(/^Read-only:/));
    }
  });

  it('sensitive and foreign notes: the usual not-found', async () => {
    for (const noteId of [
      await seed(note(users.a, C.home, { isSensitive: true })),
      await seed(note(users.a, C.secret)),
      await seed(note(users.b, C.bOwn)),
    ]) {
      await expectAll(noteId, (result) => expect(result).toEqual({ text: NOT_FOUND_TEXT, isError: true }));
    }
  });

  it("a note another user shared with the user: owner only", async () => {
    const noteId = await seed(note(users.b, C.bOwn, { sharedWith: [users.a] }));
    await expectAll(noteId, (result) => expect(result.text).toContain("only the user's own notes"));
  });

  it('a connection approved before these tools existed is told to reconnect', async () => {
    const olderClient = await connect(await issueToken(users.a, 2));
    try {
      const noteId = await seed(note(users.a, C.home));
      for (const [tool, args] of everyTool(noteId)) {
        const result = await call(olderClient, tool, args);
        expect(result.isError).toBe(true);
        expect(result.text).toContain('connect again');
      }
      // מה שהנוסח הקודם כן כיסה - עדיין עובד
      const textNoteId = await seed(note(users.a, C.home, { templateType: 'plain', content: 'א' }));
      expect((await call(olderClient, 'append_text', { noteId: textNoteId, text: 'ב' })).isError).toBe(false);
    } finally {
      await olderClient.close();
    }
  });
});

describe('tool descriptions guide Claude', () => {
  it('keep one work plan per project, and read the note right before editing', async () => {
    const { tools } = await clientA.listTools();
    const describe = (name: string) => tools.find((tool) => tool.name === name)?.description ?? '';
    expect(describe('create_note')).toContain('keep ONE work plan per project');
    for (const name of ['append_text', 'add_workplan_section', 'edit_note_text', 'remove_workplan_section']) {
      expect(describe(name)).toContain('Call get_note on the note right before editing');
    }
    expect(describe('edit_note_text')).toContain('only when the user explicitly asked');
    expect(describe('remove_workplan_section')).toContain('Only when the user explicitly asked');
  });
});
