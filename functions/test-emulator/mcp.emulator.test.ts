/**
 * שרת ה-MCP מקצה לקצה, מול Firestore ו-Auth emulators.
 *
 * האפליקציה המלאה של פונקציית `mcp` (MCP + OAuth) רצה על port מקומי:
 * - הזרימה המלאה פעם אחת: register → authorize → הסכמה → token → `/mcp`.
 * - שאר הבדיקות מקבלות access token שנכתב ישירות ל-emulator (אותו מבנה
 *   ש-`/oauth/token` כותב), כדי להתמקד ב-tools.
 * - הלקוח הוא ה-client הרשמי של ה-SDK, כך שהפרוטוקול הוא האמיתי.
 * - כל הלוג נאסף, ונבדק שאין בו תוכן, כותרות או מונחי חיפוש.
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
for (const stream of [process.stdout, process.stderr]) {
  const original = stream.write.bind(stream) as (...args: unknown[]) => boolean;
  stream.write = ((chunk: unknown, ...rest: unknown[]) => {
    captured.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk as Uint8Array).toString('utf8'));
    return original(chunk, ...rest);
  }) as typeof stream.write;
}

type HttpModule = typeof import('../src/mcp/http');
let createMcpApp: HttpModule['createMcpApp'];
// נטען דינמית: tools.ts מייבא את ה-logger, שחייב להיטען אחרי האיסוף
let NOT_FOUND_TEXT = '';
let logger: (typeof import('firebase-functions'))['logger'];

// ---------------------------------------------------------------------------
// סביבה ונתונים
// ---------------------------------------------------------------------------

const adminApp = initializeApp({ projectId: 'demo-notes-4-me' }, 'mcp-emulator-test');
const db = getFirestore(adminApp);
const auth = getAuth(adminApp);
const store = OAuthStore.create(db);

const RUN = Date.now().toString(36);
const id = (name: string) => `${name}-${RUN}`;
const AT = Timestamp.fromDate(new Date('2026-09-20T10:00:00Z'));
const RESOURCE = 'https://notes-4-me.web.app/mcp';
const CALLBACK = 'https://claude.ai/api/mcp/auth_callback';
const PASSWORD = 'correct-horse-battery';

const users = { a: '', b: '', outsider: '' };

/** מחרוזות שאסור שיופיעו בלוג: כותרות, תוכן ומונחי חיפוש */
const PRIVATE = {
  title: `רשימת-קניות-${RUN}`,
  item: `חלב-סויה-${RUN}`,
  secret: `סודי-ביותר-${RUN}`,
  foreignTitle: `פתק-זר-${RUN}`,
  query: `חלב-סויה`,
};

const C = {
  home: id('cat-home'),
  secret: id('cat-secret'),
  bHidden: id('cat-b-unshared'),
  bOwn: id('cat-b-own'),
};

const N = {
  shopping: id('note-shopping'),
  plain: id('note-plain'),
  pinned: id('note-pinned'),
  sensitive: id('note-sensitive'),
  inSecretCategory: id('note-in-secret'),
  archived: id('note-archived'),
  long: id('note-long'),
  sharedByB: id('note-shared-by-b'),
  foreign: id('note-foreign'),
};

const GENEROUS = Object.fromEntries(
  Object.keys(RATE_LIMITS).map((endpoint) => [
    endpoint,
    { perIp: [{ name: 'minute', windowMs: 60_000, max: 10_000 }], global: [{ name: 'minute', windowMs: 60_000, max: 10_000 }] },
  ])
) as unknown as typeof RATE_LIMITS;

const category = (userId: string, extra: DocumentData = {}) => ({
  name: 'בית',
  color: '#3B82F6',
  icon: null,
  order: 0,
  userId,
  sharedWith: [],
  isSensitive: false,
  createdAt: AT,
  updatedAt: AT,
  ...extra,
});

const note = (userId: string, categoryId: string, extra: DocumentData = {}) => ({
  title: 'פתק',
  content: 'תוכן רגיל',
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
  createdAt: AT,
  updatedAt: AT,
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

const appFor = (extra: Partial<Parameters<HttpModule['createMcpApp']>[0]> = {}) =>
  createMcpApp({
    store,
    auth,
    rateLimits: GENEROUS,
    scopeFor: (identity) => UserScope.for(identity, db),
    ...extra,
  });

beforeAll(async () => {
  ({ createMcpApp } = await import('../src/mcp/http'));
  ({ NOT_FOUND_TEXT } = await import('../src/mcp/tools'));
  ({ logger } = await import('firebase-functions'));

  for (const name of Object.keys(users) as (keyof typeof users)[]) {
    users[name] = (await auth.createUser({ email: `${name}-${RUN}@example.com`, password: PASSWORD, emailVerified: true })).uid;
  }
  await db.doc('config/mcp').set({ allowedUids: [users.a, users.b] });

  const batch = db.batch();
  const put = (path: string, data: DocumentData) => batch.set(db.doc(path), data);
  put(`categories/${C.home}`, category(users.a, { name: 'בית', order: 1 }));
  put(`categories/${C.secret}`, category(users.a, { name: 'כספים', isSensitive: true }));
  put(`categories/${C.bHidden}`, category(users.b, { name: 'של B' }));
  put(`categories/${C.bOwn}`, category(users.b, { name: 'עבודה' }));

  put(
    `notes/${N.shopping}`,
    note(users.a, C.home, {
      title: PRIVATE.title,
      templateType: 'checklist',
      content: JSON.stringify([
        { id: 'i1', text: PRIVATE.item, completed: false },
        { id: 'i2', text: 'לחם', completed: true },
      ]),
      tags: ['סופר'],
      updatedAt: Timestamp.fromDate(new Date('2026-09-25T10:00:00Z')),
    })
  );
  put(`notes/${N.plain}`, note(users.a, C.home, { title: 'רעיונות', content: 'לקנות מתנה לאמא' }));
  put(`notes/${N.pinned}`, note(users.a, C.home, { title: 'חשוב', isPinned: true, order: 5 }));
  put(`notes/${N.sensitive}`, note(users.a, C.home, { title: 'סיסמאות', content: PRIVATE.secret, isSensitive: true }));
  put(`notes/${N.inSecretCategory}`, note(users.a, C.secret, { title: 'חשבון בנק', content: PRIVATE.secret }));
  put(`notes/${N.archived}`, note(users.a, C.home, { title: 'ישן', isArchived: true, archivedAt: AT }));
  put(`notes/${N.long}`, note(users.a, C.home, { title: 'ארוך', content: 'שורה ארוכה מאוד.\n'.repeat(3000) }));
  put(`notes/${N.sharedByB}`, note(users.b, C.bHidden, { title: 'משותף מ-B', sharedWith: [users.a], content: 'משותף' }));
  put(`notes/${N.foreign}`, note(users.b, C.bOwn, { title: PRIVATE.foreignTitle, content: PRIVATE.secret }));
  for (let i = 0; i < 40; i++) {
    put(`notes/${id(`bulk-${i}`)}`, note(users.b, C.bOwn, { title: `פתק מספר ${i}`, order: i }));
  }
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

/** access token תקף, כמו ש-`/oauth/token` היה מנפיק */
const issueToken = async (uid: string, scope = 'notes.read offline_access', consentVersion: number | null = CONSENT_VERSION) => {
  const token = `n4m_at_${randomBytes(32).toString('base64url')}`;
  const grantId = randomBytes(32).toString('base64url');
  const now = Date.now();
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

const connectClient = async (token: string, target = base) => {
  const client = new Client({ name: 'notes-test', version: '1.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${target}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    })
  );
  return client;
};

let clientA: Client;
let clientB: Client;

const text = (result: unknown): string =>
  ((result as { content: { type: string; text: string }[] }).content ?? []).map((part) => part.text).join('\n');

const call = async (client: Client, name: string, args: Record<string, unknown> = {}) => {
  const result = await client.callTool({ name, arguments: args });
  return { text: text(result), isError: (result as { isError?: boolean }).isError === true };
};

beforeAll(async () => {
  clientA = await connectClient((await issueToken(users.a)).token);
  clientB = await connectClient((await issueToken(users.b)).token);
});

afterAll(async () => {
  await clientA?.close();
  await clientB?.close();
});

// ---------------------------------------------------------------------------
// HTTP ואימות
// ---------------------------------------------------------------------------

describe('the /mcp endpoint', () => {
  it('without a token answers 401 with the metadata pointer, which starts the OAuth flow', async () => {
    const response = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe(
      'Bearer resource_metadata="https://notes-4-me.web.app/.well-known/oauth-protected-resource/mcp", scope="notes.read notes.write"'
    );
  });

  it('rejects an invalid token and a token in the query string', async () => {
    const init = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer n4m_at_nope' },
      body: '{}',
    };
    expect((await fetch(`${base}/mcp`, init)).status).toBe(401);
    const { token } = await issueToken(users.a);
    expect((await fetch(`${base}/mcp?access_token=${token}`, { method: 'POST', body: '{}' })).status).toBe(401);
  });

  it.each([
    ['no version (approved before versions existed)', null],
    ['version 2', 2],
    ['version 3', 3],
  ])('a connection approved under an older consent text (%s) is refused, so the client asks for consent again', async (_label, version) => {
    const { token } = await issueToken(users.a, 'notes.read notes.write offline_access', version);
    const response = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('error="invalid_token"');
  });

  it('GET and DELETE are not supported (stateless)', async () => {
    const { token } = await issueToken(users.a);
    for (const method of ['GET', 'DELETE']) {
      const response = await fetch(`${base}/mcp`, { method, headers: { Authorization: `Bearer ${token}` } });
      expect(response.status).toBe(405);
    }
  });

  it('answers the 2025 handshake with plain JSON, not a stream', async () => {
    const { token } = await issueToken(users.a);
    const response = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'raw', version: '1' } },
      }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ result: { serverInfo: { name: 'notes-4-me' } } });
  });

  it('lists the four read tools and the eleven write tools, each with a description', async () => {
    const { tools } = await clientA.listTools();
    const writeTools = [
      'add_checklist_items',
      'add_workplan_section',
      'append_text',
      'archive_note',
      'create_note',
      'edit_note_text',
      'move_note_to_category',
      'remove_checklist_item',
      'remove_workplan_section',
      'unarchive_note',
      'update_checklist_item',
    ];
    expect(tools.map((tool) => tool.name).sort()).toEqual(
      [...writeTools, 'get_note', 'list_categories', 'list_notes', 'search_notes'].sort()
    );
    for (const tool of tools) {
      // מחליף או מסיר טקסט - מסומן destructive, כדי שהלקוח יוכל לבקש אישור
      const destructive = ['edit_note_text', 'remove_workplan_section', 'remove_checklist_item'].includes(tool.name);
      expect(tool.annotations).toMatchObject({ readOnlyHint: !writeTools.includes(tool.name), destructiveHint: destructive });
      expect(tool.description?.length).toBeGreaterThan(150);
    }
  });
});

// ---------------------------------------------------------------------------
// ה-tools
// ---------------------------------------------------------------------------

describe('list_categories', () => {
  it('lists the user categories with counts, without sensitive ones, plus shared notes outside a shared category', async () => {
    const { text: output, isError } = await call(clientA, 'list_categories');
    expect(isError).toBe(false);
    // בית: 4 גלויים. הפתק הרגיש והמאורכב לא נספרים
    expect(output).toContain(`בית [id: ${C.home}] · 4 notes`);
    expect(output).not.toContain(C.secret);
    expect(output).not.toContain('כספים');
    expect(output).toContain('[id: shared-with-me] · 1 notes');
  });
});

describe('list_notes', () => {
  it('lists visible notes with ids and previews, never the hidden ones', async () => {
    const { text: output } = await call(clientA, 'list_notes');
    expect(output).toContain(`[id: ${N.shopping}]`);
    expect(output).toContain(`- [ ] ${PRIVATE.item}`);
    expect(output).toContain('shared with you by another user');
    for (const hidden of [N.sensitive, N.inSecretCategory, N.foreign, N.archived]) expect(output).not.toContain(hidden);
    expect(output).not.toContain(PRIVATE.secret);
  });

  it('filters by category, keeping the app order (pinned first)', async () => {
    const { text: output } = await call(clientA, 'list_notes', { categoryId: C.home });
    expect(output.indexOf(N.pinned)).toBeLessThan(output.indexOf(N.plain));
    expect(output).not.toContain(N.sharedByB);
  });

  it('the virtual "shared with you" category holds the shared note', async () => {
    const { text: output } = await call(clientA, 'list_notes', { categoryId: 'shared-with-me' });
    expect(output).toContain(`[id: ${N.sharedByB}]`);
    expect(output).toContain('1 notes');
  });

  it('archived: true lists only own archived notes', async () => {
    const { text: output } = await call(clientA, 'list_notes', { archived: true });
    expect(output).toContain(`[id: ${N.archived}]`);
    expect(output).not.toContain(N.shopping);
  });

  it('truncates long lists, says so, and continues with the cursor', async () => {
    const first = await call(clientB, 'list_notes', { categoryId: C.bOwn, limit: 15 });
    expect(first.text).toContain('Showing 1-15 of 41.');
    expect(first.text).toContain('TRUNCATED: 26 more not shown');
    const second = await call(clientB, 'list_notes', { categoryId: C.bOwn, limit: 15, cursor: '15' });
    expect(second.text).toContain('Showing 16-30 of 41.');
  });

  it.each([
    ['a foreign category', C.bOwn],
    ['a sensitive category', C.secret],
    ['a category that does not exist', id('nope')],
  ])('%s gives the same not-found answer', async (_label, categoryId) => {
    expect(await call(clientA, 'list_notes', { categoryId })).toEqual({ text: NOT_FOUND_TEXT, isError: true });
  });

  it('rejects a made-up cursor', async () => {
    const result = await call(clientA, 'list_notes', { cursor: 'abc' });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('cursor');
  });
});

describe('search_notes', () => {
  it('finds a Hebrew word inside a checklist item, and says where it matched', async () => {
    const { text: output } = await call(clientA, 'search_notes', { query: PRIVATE.query });
    expect(output).toContain(`[id: ${N.shopping}]`);
    expect(output).toContain('matched in: content');
  });

  it('never finds words that exist only in hidden notes', async () => {
    const { text: output } = await call(clientA, 'search_notes', { query: PRIVATE.secret, includeArchived: true });
    expect(output).toMatch(/^No notes match/);
  });

  it('an empty query is refused by the input schema', async () => {
    const result = await clientA.callTool({ name: 'search_notes', arguments: { query: '   ' } });
    expect((result as { isError?: boolean }).isError).toBe(true);
  });
});

describe('get_note', () => {
  it('returns the full rendered content between data markers', async () => {
    const { text: output, isError } = await call(clientA, 'get_note', { noteId: N.shopping });
    expect(isError).toBe(false);
    expect(output).toContain(`Title: ${PRIVATE.title}`);
    expect(output).toContain('Category: בית');
    expect(output).toContain(`- [ ] ${PRIVATE.item}  (item id: i1)\n- [x] לחם  (item id: i2)`);
    expect(output).toContain('--- end of note content ---');
  });

  it('shows a shared note in the virtual category, since its own category is not shared', async () => {
    const { text: output } = await call(clientA, 'get_note', { noteId: N.sharedByB });
    expect(output).toContain('Category: Shared with you (no shared category)');
    expect(output).toContain('Access: shared with the user by another user');
  });

  it('truncates a very long note and says so', async () => {
    const { text: output } = await call(clientA, 'get_note', { noteId: N.long });
    expect(output.length).toBeLessThanOrEqual(20_000);
    expect(output).toMatch(/content is TRUNCATED/);
  });

  it.each([
    ['a foreign note', N.foreign],
    ['a sensitive note', N.sensitive],
    ['a note in a sensitive category', N.inSecretCategory],
    ['a note that does not exist', id('missing')],
    ['an id that is not a document id', 'a/b'],
  ])('%s gives exactly the same not-found answer', async (_label, noteId) => {
    expect(await call(clientA, 'get_note', { noteId })).toEqual({ text: NOT_FOUND_TEXT, isError: true });
  });
});

// ---------------------------------------------------------------------------
// הגבלת קצב לכל משתמש
// ---------------------------------------------------------------------------

describe('per-user rate limit', () => {
  it('cuts off a user after the limit, whatever IP the requests come from', async () => {
    const strict = await listen(appFor({ mcpLimits: [{ name: 'minute', windowMs: 60_000, max: 3 }] }));
    try {
      const { token } = await issueToken(users.b);
      const statuses: number[] = [];
      for (let i = 0; i < 5; i++) {
        const response = await fetch(`${strict.base}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            Authorization: `Bearer ${token}`,
            'X-Forwarded-For': `10.9.9.${i}`,
            'Fastly-Client-IP': `10.8.8.${i}`,
          },
          body: JSON.stringify({ jsonrpc: '2.0', id: i, method: 'ping' }),
        });
        statuses.push(response.status);
      }
      // המונה לכל משתמש משותף לכל ה-tokens שלו. B כבר השתמש בו במבחנים קודמים
      expect(statuses.filter((status) => status === 429).length).toBeGreaterThanOrEqual(2);
    } finally {
      await new Promise((resolve) => strict.server.close(resolve));
    }
  });
});

// ---------------------------------------------------------------------------
// ניתוק מהאפליקציה (revokeMcpGrant)
// ---------------------------------------------------------------------------

describe('revokeMcpGrant (connected apps)', () => {
  const signIn = async (user: keyof typeof users) => {
    const response = await fetch(
      `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `${user}-${RUN}@example.com`, password: PASSWORD, returnSecureToken: true }),
      }
    );
    return ((await response.json()) as { idToken: string }).idToken;
  };

  const revoke = (idToken: string | null, grantId: unknown) =>
    fetch(`${base}/oauth/grants/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
      body: JSON.stringify({ grantId }),
    });

  it('the owner disconnects: the token stops working at once', async () => {
    const { token, grantId } = await issueToken(users.a);
    const client = await connectClient(token);
    expect((await call(client, 'list_categories')).isError).toBe(false);

    const response = await revoke(await signIn('a'), grantId);
    expect(response.status).toBe(200);
    expect((await db.doc(`oauthGrants/${grantId}`).get()).data()?.revoked).toBe(true);

    await expect(client.callTool({ name: 'list_categories', arguments: {} })).rejects.toThrow();
    await client.close().catch(() => undefined);
  });

  it("another user's connection and a made-up one get the same answer, and nothing changes", async () => {
    const { grantId } = await issueToken(users.a);
    const bToken = await signIn('b');
    const foreign = await revoke(bToken, grantId);
    const madeUp = await revoke(bToken, randomBytes(32).toString('base64url'));
    expect(foreign.status).toBe(404);
    expect(await foreign.json()).toEqual(await madeUp.json());
    expect((await db.doc(`oauthGrants/${grantId}`).get()).data()?.revoked).toBe(false);
  });

  it('requires a signed-in user', async () => {
    const { grantId } = await issueToken(users.a);
    expect((await revoke(null, grantId)).status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// הזרימה המלאה: OAuth ואז MCP, כמו Claude
// ---------------------------------------------------------------------------

describe('the full flow', () => {
  it('register → authorize → consent → token → MCP tools', async () => {
    const registered = (await (
      await fetch(`${base}/oauth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirect_uris: [CALLBACK], client_name: 'Claude' }),
      })
    ).json()) as { client_id: string };

    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const authorizeUrl = new URL(`${base}/oauth/authorize`);
    for (const [key, value] of Object.entries({
      response_type: 'code',
      client_id: registered.client_id,
      redirect_uri: CALLBACK,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      resource: RESOURCE,
      scope: 'notes.read offline_access',
      state: 'xyz',
    })) {
      authorizeUrl.searchParams.set(key, value);
    }
    const authorized = await fetch(authorizeUrl, { redirect: 'manual' });
    const reqId = new URL(authorized.headers.get('location') ?? '').searchParams.get('req') ?? '';

    const signInResponse = await fetch(
      `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `a-${RUN}@example.com`, password: PASSWORD, returnSecureToken: true }),
      }
    );
    const idToken = ((await signInResponse.json()) as { idToken: string }).idToken;
    const described = (await (
      await fetch(`${base}/oauth/decision?req=${reqId}`, { headers: { Authorization: `Bearer ${idToken}` } })
    ).json()) as { nonce: string };
    const decided = (await (
      await fetch(`${base}/oauth/decision`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ req: reqId, nonce: described.nonce, approve: true }),
      })
    ).json()) as { redirectTo: string };
    const code = new URL(decided.redirectTo).searchParams.get('code') ?? '';

    const tokens = (await (
      await fetch(`${base}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          code_verifier: verifier,
          redirect_uri: CALLBACK,
          client_id: registered.client_id,
          resource: RESOURCE,
        }),
      })
    ).json()) as { access_token: string };

    const client = await connectClient(tokens.access_token);
    const { text: output } = await call(client, 'get_note', { noteId: N.shopping });
    expect(output).toContain(PRIVATE.item);
    await client.close();
  });
});

// ---------------------------------------------------------------------------
// הלוג
// ---------------------------------------------------------------------------

describe('logs', () => {
  it('the capture sees the firebase-functions logger (canary)', () => {
    logger.info('mcp.canary', { marker: `canary-${RUN}` });
    expect(captured.join('\n')).toContain(`canary-${RUN}`);
  });

  it('record tool, uid, duration and result size for each call', () => {
    const toolLogs = captured.filter((line) => line.includes('mcp.tool') && line.includes('"tool"'));
    expect(toolLogs.length).toBeGreaterThan(10);
    const sample = toolLogs.find((line) => line.includes('get_note')) ?? '';
    expect(sample).toContain(users.a);
    expect(sample).toMatch(/"durationMs":\d+/);
    expect(sample).toMatch(/"resultChars":\d+/);
  });

  it('never contain note content, titles or search terms', () => {
    const log = captured.join('\n');
    for (const value of Object.values(PRIVATE)) expect(log).not.toContain(value);
  });
});
