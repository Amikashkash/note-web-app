/**
 * בקשות גישה ל-Claude ואישור ע"י מנהל (v1.43.0), מקצה לקצה מול Firestore
 * ו-Auth emulators.
 *
 * האפליקציה המלאה של פונקציית `mcp` רצה על port מקומי. המשתמשים מתחברים
 * ב-Auth emulator ומקבלים ID tokens אמיתיים, כמו האפליקציה. ה-push למנהלים
 * מוחלף ברישום, כדי לבדוק מתי הוא נשלח ולמי.
 */

import { createHash, randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { UserScope } from '../src/notesCore/store';
import { OAuthStore } from '../src/oauth/store';
import { CONSENT_VERSION, RATE_LIMITS } from '../src/oauth/config';
import type { AdminNotice } from '../src/oauth/access';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run through `npm run test:functions:emulator` - emulator hosts are not set');
}

type HttpModule = typeof import('../src/mcp/http');
let createMcpApp: HttpModule['createMcpApp'];

const adminApp = initializeApp({ projectId: 'demo-notes-4-me' }, 'access-emulator-test');
const db = getFirestore(adminApp);
const auth = getAuth(adminApp);
const store = OAuthStore.create(db);

const RUN = Date.now().toString(36);
const RESOURCE = 'https://notes-4-me.web.app/mcp';
const PASSWORD = 'correct-horse-battery';

/** admin: המנהל. member: מורשה מראש. השאר מבקשים גישה */
const users = {
  admin: '',
  member: '',
  asker: '',
  newcomer: '',
  rejected: '',
  revokee: '',
  openRevokee: '',
  nobody: '',
  ...Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`crowd${index}`, ''])),
} as Record<string, string>;

const GENEROUS = Object.fromEntries(
  Object.keys(RATE_LIMITS).map((endpoint) => [
    endpoint,
    { perIp: [{ name: 'minute', windowMs: 60_000, max: 10_000 }], global: [{ name: 'minute', windowMs: 60_000, max: 10_000 }] },
  ])
) as unknown as typeof RATE_LIMITS;

const notices: AdminNotice[] = [];
let server: Server;
let base = '';
let strictServer: Server;
let strictBase = '';
let savedConfig: DocumentData | null = null;

const listen = (app: ReturnType<HttpModule['createMcpApp']>) =>
  new Promise<{ server: Server; base: string }>((resolve) => {
    const started = app.listen(0, '127.0.0.1', () =>
      resolve({ server: started, base: `http://127.0.0.1:${(started.address() as AddressInfo).port}` })
    );
  });

const baseConfig = () => ({ allowedUids: [users.admin, users.member], adminUids: [users.admin], openToAll: false });
const config = async () => (await db.doc('config/mcp').get()).data() ?? {};

beforeAll(async () => {
  ({ createMcpApp } = await import('../src/mcp/http'));
  savedConfig = (await db.doc('config/mcp').get()).data() ?? null;

  for (const name of Object.keys(users)) {
    users[name] = (
      await auth.createUser({
        email: `${name}-${RUN}@example.com`,
        password: PASSWORD,
        emailVerified: true,
        displayName: `שם ${name}`,
      })
    ).uid;
  }

  const common = {
    store,
    auth,
    rateLimits: GENEROUS,
    scopeFor: (identity: Parameters<typeof UserScope.for>[0]) => UserScope.for(identity, db),
    notifyAdmins: async (notice: AdminNotice) => {
      notices.push(notice);
    },
  };
  // בלי הגבלת קצב לבקשות, כדי שהבדיקות לא ייחסמו זו בזו
  ({ server, base } = await listen(
    createMcpApp({ ...common, accessRequestLimits: [{ name: 'minute', windowMs: 60_000, max: 10_000 }] })
  ));
  // הגבלת הקצב האמיתית
  ({ server: strictServer, base: strictBase } = await listen(createMcpApp(common)));
});

beforeEach(async () => {
  await db.doc('config/mcp').set(baseConfig());
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => strictServer.close(resolve));
  if (savedConfig) await db.doc('config/mcp').set(savedConfig);
  else await db.doc('config/mcp').delete();
  await deleteApp(adminApp);
});

// ---------------------------------------------------------------------------
// עוזרים
// ---------------------------------------------------------------------------

const idTokens = new Map<string, string>();
const signIn = async (name: string): Promise<string> => {
  const cached = idTokens.get(name);
  if (cached) return cached;
  const response = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `${name}-${RUN}@example.com`, password: PASSWORD, returnSecureToken: true }),
    }
  );
  const token = ((await response.json()) as { idToken: string }).idToken;
  idTokens.set(name, token);
  return token;
};

const api = async (as: string | null, method: 'GET' | 'POST', path: string, body?: unknown, target = base) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (as) headers.Authorization = `Bearer ${await signIn(as)}`;
  const response = await fetch(`${target}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json().catch(() => null)) as Record<string, unknown> | null };
};

const status = (as: string) => api(as, 'GET', '/oauth/access/status');
const request = (as: string, target = base) => api(as, 'POST', '/oauth/access/request', {}, target);
const adminList = (as: string) => api(as, 'GET', '/oauth/access/admin');
const act = (as: string, action: 'approve' | 'reject' | 'revoke', uid: string) =>
  api(as, 'POST', `/oauth/access/admin/${action}`, { uid });

const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');

/** חיבור קיים של משתמש ל-Claude: grant ו-access token, כמו ש-`/oauth/token` כותב */
const issueToken = async (uid: string) => {
  const token = `n4m_at_${randomBytes(32).toString('base64url')}`;
  const grantId = randomBytes(32).toString('base64url');
  const now = Date.now();
  await db.doc(`oauthGrants/${grantId}`).set({
    grantId,
    uid,
    clientId: 'test-client',
    clientName: 'Claude',
    scope: 'notes.read offline_access',
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
    scope: 'notes.read offline_access',
    resource: RESOURCE,
    createdAt: Timestamp.fromMillis(now),
    expiresAt: Timestamp.fromMillis(now + 3_600_000),
    used: false,
    revoked: false,
  });
  return { token, grantId };
};

/** קריאה אמיתית ל-`/mcp` עם ה-client של ה-SDK. נכשלת אם ה-token נדחה */
const listToolsWith = async (token: string) => {
  const client = new Client({ name: 'access-test', version: '1.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } })
  );
  try {
    return (await client.listTools()).tools.length;
  } finally {
    await client.close();
  }
};

/** קריאה גולמית ל-`/mcp`: רק הסטטוס */
const mcpStatus = async (token: string) =>
  (
    await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
  ).status;

const auditFor = async (targetUid: string) =>
  (await db.collection('mcpAccessAudit').where('targetUid', '==', targetUid).get()).docs.map((doc) => doc.data());

// ---------------------------------------------------------------------------

describe('who is an admin', () => {
  it('only an admin sees the admin view; everyone else gets the same 403', async () => {
    expect((await adminList('admin')).status).toBe(200);
    for (const name of ['member', 'nobody']) {
      const response = await adminList(name);
      expect(response.status).toBe(403);
      expect(response.body?.error).toBe('access_denied');
    }
    expect((await api(null, 'GET', '/oauth/access/admin')).status).toBe(401);
  });

  it('status says admin only for an admin', async () => {
    expect((await status('admin')).body).toMatchObject({ allowed: true, admin: true });
    expect((await status('member')).body).toMatchObject({ allowed: true, admin: false });
    expect((await status('nobody')).body).toEqual({ allowed: false, request: null, admin: false });
  });

  it('a non-admin cannot approve, reject or revoke, and nothing changes', async () => {
    await request('asker');
    const before = await config();
    for (const name of ['member', 'asker', 'nobody']) {
      expect((await act(name, 'approve', users.asker)).status).toBe(403);
      expect((await act(name, 'reject', users.asker)).status).toBe(403);
      expect((await act(name, 'revoke', users.member)).status).toBe(403);
    }
    expect(await config()).toEqual(before);
    expect((await status('asker')).body).toMatchObject({ allowed: false, request: 'pending' });
    expect(await auditFor(users.asker)).toEqual([]);
    expect(await auditFor(users.member)).toEqual([]);
  });

  it('being on allowedUids does not make anyone an admin, and a user cannot pass someone else as the admin', async () => {
    const response = await api('member', 'POST', '/oauth/access/admin/approve', { uid: users.asker, adminUid: users.admin });
    expect(response.status).toBe(403);
  });
});

describe('requesting access', () => {
  it('creates one pending request, with the name and email from the signed-in account, and notifies the admins once', async () => {
    notices.length = 0;
    const first = await request('newcomer');
    expect(first.body).toEqual({ allowed: false, request: 'pending', admin: false });
    // לחיצה חוזרת: אותה בקשה, בלי התראה נוספת
    expect((await request('newcomer')).body).toMatchObject({ request: 'pending' });
    // גם במקביל
    await Promise.all([request('newcomer'), request('newcomer')]);

    expect(notices).toEqual([{ adminUids: [users.admin], name: 'שם newcomer', email: `newcomer-${RUN}@example.com` }]);
    const view = await adminList('admin');
    const pending = (view.body?.pending as { uid: string; name: string; email: string }[]).filter((entry) => entry.uid === users.newcomer);
    expect(pending).toEqual([
      expect.objectContaining({ uid: users.newcomer, name: 'שם newcomer', email: `newcomer-${RUN}@example.com` }),
    ]);
  });

  it('an allowed user has nothing to request', async () => {
    notices.length = 0;
    expect((await request('member')).body).toMatchObject({ allowed: true });
    expect(notices).toEqual([]);
    expect((await db.doc(`mcpAccessRequests/${users.member}`).get()).exists).toBe(false);
  });

  it('requires sign-in', async () => {
    expect((await api(null, 'POST', '/oauth/access/request', {})).status).toBe(401);
  });

  it('is rate limited: request, rejected, and asking again at once is refused (429)', async () => {
    const name = 'rejected';
    expect((await request(name, strictBase)).body).toMatchObject({ request: 'pending' });
    expect((await act('admin', 'reject', users[name])).status).toBe(200);
    const again = await request(name, strictBase);
    expect(again.status).toBe(429);
    expect((await status(name)).body).toMatchObject({ allowed: false, request: 'rejected' });
  });
});

describe('approve and reject', () => {
  it('approve adds only the uid to allowedUids, leaves openToAll and adminUids alone, and is audited', async () => {
    await db.doc('config/mcp').set({ ...baseConfig(), openToAll: false, extra: 'kept' });
    await request('asker');
    const response = await act('admin', 'approve', users.asker);
    expect(response.status).toBe(200);

    const after = await config();
    expect(after.allowedUids).toEqual([users.admin, users.member, users.asker]);
    expect(after.adminUids).toEqual([users.admin]);
    expect(after.openToAll).toBe(false);
    expect(after.extra).toBe('kept');
    expect((await status('asker')).body).toMatchObject({ allowed: true, request: 'approved' });
    expect(await auditFor(users.asker)).toEqual([
      expect.objectContaining({ action: 'approve', adminUid: users.admin, targetEmail: `asker-${RUN}@example.com` }),
    ]);
  });

  it('openToAll true stays true through approve and revoke', async () => {
    await db.doc('config/mcp').set({ ...baseConfig(), openToAll: true });
    await db.doc(`mcpAccessRequests/${users.nobody}`).delete();
    await request('nobody');
    // openToAll פתוח: המשתמש כבר מורשה, ואין מה לאשר
    expect((await status('nobody')).body).toMatchObject({ allowed: true });
    expect((await act('admin', 'revoke', users.member)).status).toBe(200);
    expect((await config()).openToAll).toBe(true);
  });

  it('only a pending request can be approved or rejected', async () => {
    expect((await act('admin', 'approve', users.nobody)).status).toBe(404);
    expect((await act('admin', 'approve', 'no/such')).status).toBe(404);
    expect((await config()).allowedUids).toEqual(baseConfig().allowedUids);
  });

  it('reject leaves allowedUids alone and is audited', async () => {
    const name = 'crowd7';
    await request(name);
    expect((await act('admin', 'reject', users[name])).status).toBe(200);
    expect((await config()).allowedUids).toEqual(baseConfig().allowedUids);
    expect((await status(name)).body).toMatchObject({ allowed: false, request: 'rejected' });
    expect(await auditFor(users[name])).toEqual([expect.objectContaining({ action: 'reject', adminUid: users.admin })]);
  });

  it('concurrent approvals: allowedUids ends up with every approved user, once each', async () => {
    const crowd = Array.from({ length: 7 }, (_, index) => `crowd${index}`);
    for (const name of crowd) await request(name);
    const results = await Promise.all(crowd.map((name) => act('admin', 'approve', users[name])));
    expect(results.map((result) => result.status)).toEqual(crowd.map(() => 200));

    const allowed = (await config()).allowedUids as string[];
    expect(new Set(allowed).size).toBe(allowed.length);
    expect([...allowed].sort()).toEqual([...baseConfig().allowedUids, ...crowd.map((name) => users[name])].sort());
    // ואישור כפול של אותה בקשה לא מוסיף אותה פעמיים
    expect((await act('admin', 'approve', users.crowd0)).status).toBe(404);
  });
});

describe('revoke', () => {
  it("removes the user and stops the existing token at once, revoking every grant and token they hold", async () => {
    await db.doc('config/mcp').set({ ...baseConfig(), allowedUids: [...baseConfig().allowedUids, users.revokee] });
    const first = await issueToken(users.revokee);
    const second = await issueToken(users.revokee);
    expect(await listToolsWith(first.token)).toBeGreaterThan(0);

    const response = await act('admin', 'revoke', users.revokee);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ uid: users.revokee, grantsRevoked: 2 });

    // מיד, בלי cache: אותו token נדחה
    expect(await mcpStatus(first.token)).toBe(401);
    expect(await mcpStatus(second.token)).toBe(401);
    expect((await config()).allowedUids).toEqual(baseConfig().allowedUids);
    for (const { grantId, token } of [first, second]) {
      expect((await db.doc(`oauthGrants/${grantId}`).get()).data()).toMatchObject({ revoked: true, revokedReason: 'revoked_by_admin' });
      expect((await db.doc(`oauthTokens/${sha256Hex(token)}`).get()).get('revoked')).toBe(true);
    }
    expect(await auditFor(users.revokee)).toEqual([expect.objectContaining({ action: 'revoke', adminUid: users.admin })]);
    expect((await status('revokee')).body).toMatchObject({ allowed: false });
  });

  it('with openToAll on, the token still stops at once (the grants are revoked), and openToAll is untouched', async () => {
    await db.doc('config/mcp').set({ ...baseConfig(), allowedUids: [...baseConfig().allowedUids, users.openRevokee], openToAll: true });
    const { token } = await issueToken(users.openRevokee);
    expect(await listToolsWith(token)).toBeGreaterThan(0);

    expect((await act('admin', 'revoke', users.openRevokee)).status).toBe(200);
    expect(await mcpStatus(token)).toBe(401);
    expect((await config()).openToAll).toBe(true);
  });

  it('a revoked user can ask again, and the admin is notified again', async () => {
    notices.length = 0;
    expect((await request('revokee')).body).toMatchObject({ allowed: false, request: 'pending' });
    expect(notices.map((notice) => notice.email)).toEqual([`revokee-${RUN}@example.com`]);
  });

  it('revoking someone who is not on the list is a 404 and changes nothing', async () => {
    expect((await act('admin', 'revoke', users.nobody)).status).toBe(404);
    expect((await config()).allowedUids).toEqual(baseConfig().allowedUids);
  });
});

describe('the admin view', () => {
  it('lists approved users with their name and email, and the openToAll state', async () => {
    const view = (await adminList('admin')).body as { approved: { uid: string; name: string; email: string }[]; openToAll: boolean };
    expect(view.openToAll).toBe(false);
    expect(view.approved).toEqual([
      { uid: users.admin, name: 'שם admin', email: `admin-${RUN}@example.com` },
      { uid: users.member, name: 'שם member', email: `member-${RUN}@example.com` },
    ]);
  });

  it('an admin removed from adminUids loses the admin powers at once', async () => {
    await db.doc('config/mcp').set({ ...baseConfig(), adminUids: [] });
    expect((await adminList('admin')).status).toBe(403);
    expect((await act('admin', 'revoke', users.member)).status).toBe(403);
    expect((await config()).allowedUids).toEqual(baseConfig().allowedUids);
  });
});
