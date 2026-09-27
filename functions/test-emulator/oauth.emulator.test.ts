/**
 * ה-Authorization Server מקצה לקצה, מול Firestore ו-Auth emulators.
 *
 * האפליקציה רצה על port מקומי, והבדיקות מדברות איתה ב-HTTP כמו Claude:
 * register → authorize → מסך ההסכמה (GET ו-POST /oauth/decision עם Firebase
 * ID token אמיתי מה-emulator) → token → refresh → revoke, ואימות ה-access
 * token דרך `verifyAccessToken`.
 *
 * בנוסף: כל הפלט שנכתב ללוג לאורך הקובץ נאסף, והבדיקה האחרונה מחפשת בו
 * כל ערך סודי שנוצר (tokens, codes, verifiers, nonces, מזהי בקשות, ID tokens),
 * גם חלקית.
 */

import { createHash, randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { OAuthStore } from '../src/oauth/store';
import { McpAuthError, verifyAccessToken, type AuthContext } from '../src/oauth/verify';
import { RATE_LIMITS } from '../src/oauth/config';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run through `npm run test:functions:emulator` - emulator hosts are not set');
}

// ---------------------------------------------------------------------------
// איסוף הלוג. חייב לקרות לפני שה-logger של firebase-functions נטען: הוא
// שומר את מתודות ה-console ברגע הטעינה. לכן האפליקציה נטענת דינמית ב-beforeAll,
// ובדיקת canary מוודאת שהאיסוף באמת רואה את ה-logger.
// ---------------------------------------------------------------------------

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

type AppModule = typeof import('../src/oauth/app');
let createOAuthApp: AppModule['createOAuthApp'];
let logger: (typeof import('firebase-functions'))['logger'];

// ---------------------------------------------------------------------------
// סביבה
// ---------------------------------------------------------------------------

const adminApp = initializeApp({ projectId: 'demo-notes-4-me' }, 'oauth-emulator-test');
const db = getFirestore(adminApp);
const auth = getAuth(adminApp);
const store = OAuthStore.create(db);

const RUN = Date.now().toString(36);
const CALLBACK = 'https://claude.ai/api/mcp/auth_callback';
const RESOURCE = 'https://notes-4-me.web.app/mcp';
const ISSUER = 'https://notes-4-me.web.app';

/** השעון של האפליקציה: זמן אמיתי (ה-ID tokens של ה-emulator בזמן אמיתי) + היסט */
let offset = 0;
const now = () => Date.now() + offset;

/** מגבלות נדיבות לזרימות. מגבלות הקצב האמיתיות נבדקות בנפרד */
const GENEROUS = Object.fromEntries(
  Object.keys(RATE_LIMITS).map((endpoint) => [
    endpoint,
    { perIp: [{ name: 'minute', windowMs: 60_000, max: 10_000 }], global: [{ name: 'minute', windowMs: 60_000, max: 10_000 }] },
  ])
) as unknown as typeof RATE_LIMITS;

let server: Server;
let base = '';
let strictServer: Server;
let strictBase = '';

/** כל ערך סודי שנוצר בבדיקות. הבדיקה האחרונה מחפשת אותם בלוג */
const secrets = new Set<string>();
const secret = <T extends string | null | undefined>(value: T): T => {
  if (value) secrets.add(value);
  return value;
};

const users = { owner: '', stranger: '', revoked: '', disabled: '', removed: '' };
const PASSWORD = 'correct-horse-battery';

const listen = (app: ReturnType<AppModule['createOAuthApp']>) =>
  new Promise<{ server: Server; base: string }>((resolve) => {
    const started = app.listen(0, '127.0.0.1', () =>
      resolve({ server: started, base: `http://127.0.0.1:${(started.address() as AddressInfo).port}` })
    );
  });

const setAllowlist = (data: Record<string, unknown> | null) =>
  data === null ? db.doc('config/mcp').delete() : db.doc('config/mcp').set(data);

beforeAll(async () => {
  // אחרי שהאיסוף הותקן - ראו למעלה
  ({ createOAuthApp } = await import('../src/oauth/app'));
  ({ logger } = await import('firebase-functions'));

  for (const name of Object.keys(users) as (keyof typeof users)[]) {
    users[name] = (await auth.createUser({ email: `${name}-${RUN}@example.com`, password: PASSWORD, emailVerified: true })).uid;
  }
  await setAllowlist({ allowedUids: [users.owner, users.revoked, users.disabled, users.removed], openToAll: false });

  ({ server, base } = await listen(createOAuthApp({ store, auth, clock: now, rateLimits: GENEROUS })));
  ({ server: strictServer, base: strictBase } = await listen(createOAuthApp({ store, auth, clock: now })));
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => strictServer.close(resolve));
  await deleteApp(adminApp);
});

// ---------------------------------------------------------------------------
// עוזרים: מה ש-Claude והדפדפן עושים
// ---------------------------------------------------------------------------

let ipCounter = 0;
/** IP נפרד לכל קריאה, כדי שהגבלת הקצב לכל IP לא תזלוג בין בדיקות */
const freshIp = () => `10.0.${Math.floor(ipCounter / 250)}.${ipCounter++ % 250}`;

const signIn = async (user: keyof typeof users): Promise<string> => {
  const response = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `${user}-${RUN}@example.com`, password: PASSWORD, returnSecureToken: true }),
    }
  );
  return secret(((await response.json()) as { idToken: string }).idToken);
};

const pkce = () => {
  const verifier = secret(randomBytes(32).toString('base64url'));
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
};

const register = async (body: unknown = { redirect_uris: [CALLBACK], client_name: 'Claude' }, target = base, ip = freshIp()) =>
  fetch(`${target}/oauth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: JSON.stringify(body),
  });

const newClient = async (): Promise<string> => ((await (await register()).json()) as { client_id: string }).client_id;

const authorizeUrl = (params: Record<string, string | undefined>) => {
  const url = new URL(`${base}/oauth/authorize`);
  for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, value);
  return url.toString();
};

const validAuthorizeParams = (clientId: string, challenge: string) => ({
  response_type: 'code',
  client_id: clientId,
  redirect_uri: CALLBACK,
  code_challenge: challenge,
  code_challenge_method: 'S256',
  resource: RESOURCE,
  scope: 'notes.read offline_access',
  state: `state-${RUN}`,
});

const getManual = (url: string) => fetch(url, { redirect: 'manual', headers: { 'X-Forwarded-For': freshIp() } });

/** authorize → מזהה הבקשה מה-redirect ל-/connect */
const startAuthorization = async (clientId: string, challenge: string): Promise<string> => {
  const response = await getManual(authorizeUrl(validAuthorizeParams(clientId, challenge)));
  expect(response.status).toBe(302);
  const location = new URL(response.headers.get('location') ?? '');
  expect(`${location.origin}${location.pathname}`).toBe(`${ISSUER}/connect`);
  return secret(location.searchParams.get('req') ?? '');
};

const describeRequest = (idToken: string | null, reqId: string) =>
  fetch(`${base}/oauth/decision?req=${encodeURIComponent(reqId)}`, {
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
  });

const postDecision = (idToken: string, body: Record<string, unknown>) =>
  fetch(`${base}/oauth/decision`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/** GET + POST של מסך ההסכמה, מחזיר את ה-URL שאליו הדפדפן מופנה */
const consent = async (idToken: string, reqId: string, approve = true): Promise<URL> => {
  const described = await describeRequest(idToken, reqId);
  expect(described.status).toBe(200);
  const { nonce } = (await described.json()) as { nonce: string };
  secret(nonce);
  const decided = await postDecision(idToken, { req: reqId, nonce, approve });
  expect(decided.status).toBe(200);
  return new URL(((await decided.json()) as { redirectTo: string }).redirectTo);
};

const tokenRequest = (params: Record<string, string | undefined>, target = base, ip = freshIp()) =>
  fetch(`${target}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-For': ip },
    body: new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined)),
  });

interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

const readTokens = async (response: Response): Promise<Tokens> => {
  const body = (await response.json()) as Tokens;
  secret(body.access_token);
  secret(body.refresh_token);
  return body;
};

/** עד ה-code, בלי להחליף אותו */
const obtainCode = async (user: keyof typeof users = 'owner') => {
  const clientId = await newClient();
  const { verifier, challenge } = pkce();
  const reqId = await startAuthorization(clientId, challenge);
  const callback = await consent(await signIn(user), reqId);
  const code = secret(callback.searchParams.get('code') ?? '');
  return { clientId, verifier, code, callback };
};

const codeExchange = (clientId: string, code: string, verifier: string, extra: Record<string, string> = {}) =>
  tokenRequest({
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    redirect_uri: CALLBACK,
    client_id: clientId,
    resource: RESOURCE,
    ...extra,
  });

/** זרימה מלאה עד tokens */
const connect = async (user: keyof typeof users = 'owner') => {
  const { clientId, verifier, code } = await obtainCode(user);
  const response = await codeExchange(clientId, code, verifier);
  expect(response.status).toBe(200);
  return { clientId, tokens: await readTokens(response) };
};

const refresh = (clientId: string, refreshToken: string) =>
  tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId });

const verify = (accessToken: string | undefined, extra: Partial<Parameters<typeof verifyAccessToken>[0]> = {}) =>
  verifyAccessToken({
    store,
    auth,
    authorization: accessToken === undefined ? undefined : `Bearer ${accessToken}`,
    now: now(),
    ...extra,
  });

const expectRejected = async (promise: Promise<AuthContext>) => {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught
  );
  expect(error).toBeInstanceOf(McpAuthError);
  return error as McpAuthError;
};

const expectOAuthError = async (response: Response, status: number, error: string) => {
  expect(response.status).toBe(status);
  const body = (await response.json()) as Record<string, unknown>;
  expect(body).toEqual({ error, error_description: expect.any(String) });
  return body;
};

// ---------------------------------------------------------------------------
// הזרימה התקינה
// ---------------------------------------------------------------------------

describe('discovery', () => {
  it('serves both metadata documents, publicly and uncached', async () => {
    const as = await fetch(`${base}/.well-known/oauth-authorization-server`);
    expect(as.headers.get('cache-control')).toBe('no-store');
    expect(await as.json()).toMatchObject({ issuer: ISSUER, code_challenge_methods_supported: ['S256'] });

    for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp']) {
      expect(await (await fetch(`${base}${path}`)).json()).toMatchObject({ resource: RESOURCE });
    }
  });

  it('answers unknown paths in the OAuth error format', async () => {
    await expectOAuthError(await fetch(`${base}/oauth/nothing`), 404, 'invalid_request');
  });
});

describe('the full flow', () => {
  it('register → authorize → consent → token → verify → refresh', async () => {
    const registered = await register();
    expect(registered.status).toBe(201);
    const client = (await registered.json()) as Record<string, unknown>;
    expect(client).toMatchObject({ redirect_uris: [CALLBACK], token_endpoint_auth_method: 'none' });
    const clientId = client.client_id as string;

    const { verifier, challenge } = pkce();
    const reqId = await startAuthorization(clientId, challenge);

    const idToken = await signIn('owner');
    const described = await describeRequest(idToken, reqId);
    expect(described.status).toBe(200);
    const description = (await described.json()) as Record<string, unknown>;
    expect(description).toMatchObject({ clientName: 'Claude', redirectHost: 'claude.ai', scopes: ['notes.read', 'offline_access'] });
    secret(description.nonce as string);

    const decided = await postDecision(idToken, { req: reqId, nonce: description.nonce, approve: true });
    const callback = new URL(((await decided.json()) as { redirectTo: string }).redirectTo);
    expect(`${callback.origin}${callback.pathname}`).toBe(CALLBACK);
    expect(callback.searchParams.get('state')).toBe(`state-${RUN}`);
    expect(callback.searchParams.get('iss')).toBe(ISSUER);
    const code = secret(callback.searchParams.get('code') ?? '');

    const exchanged = await codeExchange(clientId, code, verifier);
    expect(exchanged.status).toBe(200);
    expect(exchanged.headers.get('cache-control')).toBe('no-store');
    const tokens = await readTokens(exchanged);
    expect(tokens).toMatchObject({ token_type: 'Bearer', expires_in: 3600, scope: 'notes.read offline_access' });
    expect(tokens.access_token).toMatch(/^n4m_at_/);
    expect(tokens.refresh_token).toMatch(/^n4m_rt_/);

    const context = await verify(tokens.access_token);
    expect(context.identity.uid).toBe(users.owner);
    expect(context).toMatchObject({ clientId, scopes: ['notes.read', 'offline_access'] });

    const refreshed = await readTokens(await refresh(clientId, tokens.refresh_token));
    expect(refreshed.refresh_token).not.toBe(tokens.refresh_token);
    expect((await verify(refreshed.access_token)).identity.uid).toBe(users.owner);
  });

  it('stores only hashes: no document holds a token or code value', async () => {
    const { tokens } = await connect();
    const everything = JSON.stringify(
      await Promise.all(
        ['oauthTokens', 'oauthCodes', 'oauthGrants', 'oauthRequests'].map(async (name) =>
          (await db.collection(name).get()).docs.map((doc) => [doc.id, doc.data()])
        )
      )
    );
    for (const value of [...secrets].filter((item) => item.startsWith('n4m_'))) {
      expect(everything).not.toContain(value);
      expect(everything).not.toContain(value.slice(7));
    }
    expect(everything).not.toContain(tokens.access_token.slice(7, 30));
  });

  it('a user who denies consent is sent back with access_denied and no code', async () => {
    const clientId = await newClient();
    const reqId = await startAuthorization(clientId, pkce().challenge);
    const callback = await consent(await signIn('owner'), reqId, false);
    expect(callback.searchParams.get('error')).toBe('access_denied');
    expect(callback.searchParams.get('code')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PKCE
// ---------------------------------------------------------------------------

describe('PKCE: S256 only', () => {
  const authorizeError = async (overrides: Record<string, string | undefined>) => {
    const clientId = await newClient();
    const response = await getManual(authorizeUrl({ ...validAuthorizeParams(clientId, pkce().challenge), ...overrides }));
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('location') ?? '');
    expect(`${location.origin}${location.pathname}`).toBe(CALLBACK);
    expect(location.searchParams.get('iss')).toBe(ISSUER);
    return location.searchParams.get('error');
  };

  it.each([
    ['a missing method', { code_challenge_method: undefined }],
    ['the plain method', { code_challenge_method: 'plain' }],
    ['a missing challenge', { code_challenge: undefined }],
    ['a malformed challenge', { code_challenge: 'short' }],
  ])('rejects %s at authorize', async (_label, overrides) => {
    expect(await authorizeError(overrides)).toBe('invalid_request');
  });

  it('rejects a wrong verifier, and the code is then spent', async () => {
    const { clientId, verifier, code } = await obtainCode();
    await expectOAuthError(await codeExchange(clientId, code, pkce().verifier), 400, 'invalid_grant');
    await expectOAuthError(await codeExchange(clientId, code, verifier), 400, 'invalid_grant');
  });

  it('rejects a missing verifier', async () => {
    const { clientId, code } = await obtainCode();
    await expectOAuthError(
      await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: CALLBACK, client_id: clientId }),
      400,
      'invalid_request'
    );
  });
});

// ---------------------------------------------------------------------------
// codes
// ---------------------------------------------------------------------------

describe('authorization codes', () => {
  it('are single use: a reused code fails and revokes the tokens issued from it', async () => {
    const { clientId, verifier, code } = await obtainCode();
    const tokens = await readTokens(await codeExchange(clientId, code, verifier));
    expect((await verify(tokens.access_token)).identity.uid).toBe(users.owner);

    await expectOAuthError(await codeExchange(clientId, code, verifier), 400, 'invalid_grant');

    await expectRejected(verify(tokens.access_token));
    await expectOAuthError(await refresh(clientId, tokens.refresh_token), 400, 'invalid_grant');
  });

  it('expire after 60 seconds', async () => {
    const { clientId, verifier, code } = await obtainCode();
    offset = 61_000;
    try {
      await expectOAuthError(await codeExchange(clientId, code, verifier), 400, 'invalid_grant');
    } finally {
      offset = 0;
    }
  });

  it.each([
    ['another client', async () => ({ client_id: await newClient() })],
    ['another redirect URI', async () => ({ redirect_uri: `${CALLBACK}/` })],
    ['another resource', async () => ({ resource: `${RESOURCE}/other` })],
  ])('are bound to their client, redirect URI and resource: %s is refused', async (_label, change) => {
    const { clientId, verifier, code } = await obtainCode();
    await expectOAuthError(await codeExchange(clientId, code, verifier, await change()), 400, 'invalid_grant');
  });

  it('an unknown code and an unknown client get the very same answer', async () => {
    const { clientId, verifier } = await obtainCode();
    const unknownCode = await (await codeExchange(clientId, randomBytes(32).toString('base64url'), verifier)).json();
    const { code, verifier: verifier2 } = await obtainCode();
    const unknownClient = await (await codeExchange(randomBytes(32).toString('base64url'), code, verifier2)).json();
    expect(unknownClient).toEqual(unknownCode);
  });
});

// ---------------------------------------------------------------------------
// refresh tokens
// ---------------------------------------------------------------------------

describe('refresh tokens', () => {
  it('rotate, and a reused refresh token revokes the whole family', async () => {
    const { clientId, tokens } = await connect();
    const second = await readTokens(await refresh(clientId, tokens.refresh_token));

    // התוקף מציג את הישן: כל המשפחה מתבטלת, כולל מה שהלקוח הלגיטימי קיבל
    await expectOAuthError(await refresh(clientId, tokens.refresh_token), 400, 'invalid_grant');
    await expectRejected(verify(second.access_token));
    await expectOAuthError(await refresh(clientId, second.refresh_token), 400, 'invalid_grant');
  });

  it('are bound to their client', async () => {
    const { tokens } = await connect();
    await expectOAuthError(await refresh(await newClient(), tokens.refresh_token), 400, 'invalid_grant');
  });

  it('cannot widen the scope', async () => {
    const { clientId, tokens } = await connect();
    await expectOAuthError(
      await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: clientId, scope: 'notes.write' }),
      400,
      'invalid_scope'
    );
  });

  it('an access token cannot be used as a refresh token', async () => {
    const { clientId, tokens } = await connect();
    await expectOAuthError(await refresh(clientId, tokens.access_token), 400, 'invalid_grant');
  });
});

// ---------------------------------------------------------------------------
// redirect URIs
// ---------------------------------------------------------------------------

describe('redirect URIs', () => {
  it.each([
    'https://evil.example.com/callback',
    `${CALLBACK}/`,
    `${CALLBACK}?next=https://evil.example.com`,
    'https://claude.ai.evil.com/api/mcp/auth_callback',
    'http://localhost:3118/callback',
  ])('registration with %s is refused', async (uri) => {
    await expectOAuthError(await register({ redirect_uris: [uri] }), 400, 'invalid_redirect_uri');
  });

  it('refuses registration with a mix of allowed and foreign URIs', async () => {
    await expectOAuthError(await register({ redirect_uris: [CALLBACK, 'https://evil.example.com/cb'] }), 400, 'invalid_redirect_uri');
  });

  it('refuses a confidential client or an unsupported grant type', async () => {
    await expectOAuthError(
      await register({ redirect_uris: [CALLBACK], token_endpoint_auth_method: 'client_secret_basic' }),
      400,
      'invalid_client_metadata'
    );
    await expectOAuthError(
      await register({ redirect_uris: [CALLBACK], grant_types: ['client_credentials'] }),
      400,
      'invalid_client_metadata'
    );
  });

  it('a foreign redirect URI at authorize shows an error page and never redirects', async () => {
    const clientId = await newClient();
    const unknownClient = await getManual(
      authorizeUrl({ ...validAuthorizeParams(randomBytes(32).toString('base64url'), pkce().challenge) })
    );
    const unknownBody = await unknownClient.text();

    for (const redirect of ['https://evil.example.com/callback', `${CALLBACK}/`, undefined]) {
      const response = await getManual(authorizeUrl({ ...validAuthorizeParams(clientId, pkce().challenge), redirect_uri: redirect }));
      expect(response.status).toBe(400);
      expect(response.headers.get('location')).toBeNull();
      // אותו דף בדיוק ללקוח שלא קיים - הדף לא מגלה אם הלקוח קיים
      expect(await response.text()).toBe(unknownBody);
    }
    expect(unknownClient.status).toBe(400);
  });

  it('other authorize errors go back to the client with state and iss', async () => {
    const clientId = await newClient();
    const response = await getManual(authorizeUrl({ ...validAuthorizeParams(clientId, pkce().challenge), resource: 'https://evil.example.com/mcp' }));
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.searchParams.get('error')).toBe('invalid_target');
    expect(location.searchParams.get('state')).toBe(`state-${RUN}`);
  });
});

// ---------------------------------------------------------------------------
// מסך ההסכמה: קשירה לבקשה ולמשתמש
// ---------------------------------------------------------------------------

describe('consent decision binding', () => {
  const pending = async () => {
    const clientId = await newClient();
    return startAuthorization(clientId, pkce().challenge);
  };

  it('requires a signed-in Firebase user', async () => {
    const reqId = await pending();
    await expectOAuthError(await describeRequest(null, reqId), 401, 'invalid_token');
    await expectOAuthError(await describeRequest('not-a-token', reqId), 401, 'invalid_token');
  });

  it('a request opened by one user cannot be opened or decided by another', async () => {
    const reqId = await pending();
    const ownerToken = await signIn('owner');
    const { nonce } = (await (await describeRequest(ownerToken, reqId)).json()) as { nonce: string };
    secret(nonce);

    const otherToken = await signIn('revoked');
    await expectOAuthError(await describeRequest(otherToken, reqId), 400, 'invalid_request');
    await expectOAuthError(await postDecision(otherToken, { req: reqId, nonce, approve: true }), 400, 'invalid_request');
  });

  it('a decision without the nonce from the consent page is rejected', async () => {
    const reqId = await pending();
    const idToken = await signIn('owner');
    await describeRequest(idToken, reqId);
    await expectOAuthError(
      await postDecision(idToken, { req: reqId, nonce: randomBytes(32).toString('base64url'), approve: true }),
      400,
      'invalid_request'
    );
  });

  it('a decision without opening the consent page first is rejected', async () => {
    const reqId = await pending();
    await expectOAuthError(
      await postDecision(await signIn('owner'), { req: reqId, nonce: randomBytes(32).toString('base64url'), approve: true }),
      400,
      'invalid_request'
    );
  });

  it('reopening the page replaces the nonce: the old one is dead', async () => {
    const reqId = await pending();
    const idToken = await signIn('owner');
    const first = ((await (await describeRequest(idToken, reqId)).json()) as { nonce: string }).nonce;
    secret(first);
    secret(((await (await describeRequest(idToken, reqId)).json()) as { nonce: string }).nonce);
    await expectOAuthError(await postDecision(idToken, { req: reqId, nonce: first, approve: true }), 400, 'invalid_request');
  });

  it('a replayed decision is rejected', async () => {
    const reqId = await pending();
    const idToken = await signIn('owner');
    const { nonce } = (await (await describeRequest(idToken, reqId)).json()) as { nonce: string };
    secret(nonce);
    const first = await postDecision(idToken, { req: reqId, nonce, approve: true });
    expect(first.status).toBe(200);
    secret(new URL(((await first.json()) as { redirectTo: string }).redirectTo).searchParams.get('code'));

    await expectOAuthError(await postDecision(idToken, { req: reqId, nonce, approve: true }), 400, 'invalid_request');
    await expectOAuthError(await describeRequest(idToken, reqId), 400, 'invalid_request');
  });

  it('an expired request cannot be opened', async () => {
    const reqId = await pending();
    offset = 11 * 60_000;
    try {
      await expectOAuthError(await describeRequest(await signIn('owner'), reqId), 400, 'invalid_request');
    } finally {
      offset = 0;
    }
  });

  it('a made-up request id gets the same answer as an expired one', async () => {
    await expectOAuthError(await describeRequest(await signIn('owner'), randomBytes(32).toString('base64url')), 400, 'invalid_request');
  });
});

// ---------------------------------------------------------------------------
// allowlist של משתמשים
// ---------------------------------------------------------------------------

describe('user allowlist (config/mcp)', () => {
  it('a user not on the allowlist gets no code', async () => {
    const reqId = await startAuthorization(await newClient(), pkce().challenge);
    const idToken = await signIn('stranger');
    await expectOAuthError(await describeRequest(idToken, reqId), 403, 'access_denied');
    await expectOAuthError(
      await postDecision(idToken, { req: reqId, nonce: randomBytes(32).toString('base64url'), approve: true }),
      400,
      'invalid_request'
    );
  });

  it.each([
    ['a missing config document', null],
    ['an empty allowlist', { allowedUids: [] }],
    ['openToAll that is not exactly true', { allowedUids: [], openToAll: 'true' }],
  ])('%s blocks everyone, including the owner', async (_label, config) => {
    const reqId = await startAuthorization(await newClient(), pkce().challenge);
    const saved = (await db.doc('config/mcp').get()).data() ?? null;
    await setAllowlist(config);
    try {
      await expectOAuthError(await describeRequest(await signIn('owner'), reqId), 403, 'access_denied');
    } finally {
      await setAllowlist(saved);
    }
  });

  it('removing a user from the allowlist cuts off their tokens at once', async () => {
    const { clientId, tokens } = await connect('removed');
    expect((await verify(tokens.access_token)).identity.uid).toBe(users.removed);

    const saved = (await db.doc('config/mcp').get()).data() ?? null;
    await setAllowlist({ allowedUids: [users.owner] });
    try {
      await expectRejected(verify(tokens.access_token));
      await expectOAuthError(await refresh(clientId, tokens.refresh_token), 400, 'invalid_grant');
    } finally {
      await setAllowlist(saved);
    }
  });
});

// ---------------------------------------------------------------------------
// אימות access token (verify.ts)
// ---------------------------------------------------------------------------

describe('access token verification', () => {
  it('no credentials: 401 without an error code, pointing at the metadata', async () => {
    const error = await expectRejected(verify(undefined));
    expect(error.status).toBe(401);
    expect(error.wwwAuthenticate).toBe(
      `Bearer resource_metadata="${ISSUER}/.well-known/oauth-protected-resource/mcp", scope="notes.read"`
    );
  });

  it('rejects a token that also arrives in the query string', async () => {
    const { tokens } = await connect();
    const error = await expectRejected(verify(tokens.access_token, { tokenElsewhere: true }));
    expect(error.wwwAuthenticate).toContain('error="invalid_request"');
  });

  it('rejects an expired access token', async () => {
    const { tokens } = await connect();
    offset = 60 * 60_000 + 1000;
    try {
      await expectRejected(verify(tokens.access_token, { now: now() }));
    } finally {
      offset = 0;
    }
  });

  it('rejects a disabled user', async () => {
    const { tokens } = await connect('disabled');
    await auth.updateUser(users.disabled, { disabled: true });
    await expectRejected(verify(tokens.access_token));
  });

  it('"sign out everywhere" in Firebase also cuts off Claude', async () => {
    // ה-grant נוצר "לפני שלוש שניות", כדי ש-tokensValidAfterTime (בשניות שלמות) יהיה אחריו
    offset = -3000;
    const { tokens } = await connect('revoked');
    offset = 0;
    expect((await verify(tokens.access_token)).identity.uid).toBe(users.revoked);

    await auth.revokeRefreshTokens(users.revoked);
    await expectRejected(verify(tokens.access_token));
  });

  it('rejects a refresh token or garbage presented as an access token', async () => {
    const { tokens } = await connect();
    await expectRejected(verify(tokens.refresh_token));
    await expectRejected(verify('n4m_at_short'));
    const error = await expectRejected(verifyAccessToken({ store, auth, authorization: `Basic ${tokens.access_token}`, now: now() }));
    expect(error.wwwAuthenticate).toContain('error="invalid_token"');
  });
});

// ---------------------------------------------------------------------------
// revocation
// ---------------------------------------------------------------------------

describe('revocation', () => {
  const revoke = (params: Record<string, string>) =>
    fetch(`${base}/oauth/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-For': freshIp() },
      body: new URLSearchParams(params),
    });

  it('revoking a refresh token revokes the whole grant', async () => {
    const { clientId, tokens } = await connect();
    expect((await revoke({ token: tokens.refresh_token, client_id: clientId })).status).toBe(200);
    await expectRejected(verify(tokens.access_token));
    await expectOAuthError(await refresh(clientId, tokens.refresh_token), 400, 'invalid_grant');
  });

  it('revoking an access token revokes only that token', async () => {
    const { clientId, tokens } = await connect();
    expect((await revoke({ token: tokens.access_token, client_id: clientId })).status).toBe(200);
    await expectRejected(verify(tokens.access_token));
    const refreshed = await readTokens(await refresh(clientId, tokens.refresh_token));
    expect((await verify(refreshed.access_token)).identity.uid).toBe(users.owner);
  });

  it('answers 200 for unknown tokens and for another client, and changes nothing', async () => {
    const { tokens } = await connect();
    expect((await revoke({ token: 'n4m_rt_unknown', client_id: 'x' })).status).toBe(200);
    expect((await revoke({ token: tokens.refresh_token, client_id: await newClient() })).status).toBe(200);
    expect((await verify(tokens.access_token)).identity.uid).toBe(users.owner);
  });
});

// ---------------------------------------------------------------------------
// הגבלות קצב (עם המגבלות האמיתיות)
// ---------------------------------------------------------------------------

describe('rate limits', () => {
  it('register: the eleventh registration from one IP in an hour is refused', async () => {
    const ip = `192.0.2.${Math.floor(Math.random() * 250)}`;
    const limit = RATE_LIMITS.register.perIp[0].max;
    for (let i = 0; i < limit; i++) expect((await register(undefined, strictBase, ip)).status).toBe(201);

    const refused = await register(undefined, strictBase, ip);
    expect(refused.headers.get('retry-after')).toMatch(/^\d+$/);
    await expectOAuthError(refused, 429, 'temporarily_unavailable');
    // IP אחר עדיין עובר
    expect((await register(undefined, strictBase, `198.51.100.${Math.floor(Math.random() * 250)}`)).status).toBe(201);
  });

  it('token: a burst from one IP is cut off', async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 250)}`;
    const limit = RATE_LIMITS.token.perIp[0].max;
    const garbage = { grant_type: 'refresh_token', refresh_token: 'n4m_rt_x', client_id: 'x' };
    for (let i = 0; i < limit; i++) expect((await tokenRequest(garbage, strictBase, ip)).status).toBe(400);
    await expectOAuthError(await tokenRequest(garbage, strictBase, ip), 429, 'temporarily_unavailable');
  });
});

// ---------------------------------------------------------------------------
// פורמט שגיאות ואבטחת תשובות
// ---------------------------------------------------------------------------

describe('responses', () => {
  it('every response forbids framing and caching', async () => {
    for (const response of [
      await fetch(`${base}/.well-known/oauth-authorization-server`),
      await getManual(authorizeUrl({})),
      await tokenRequest({ grant_type: 'password' }),
    ]) {
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('token errors use the standard format', async () => {
    await expectOAuthError(await tokenRequest({ grant_type: 'password' }), 400, 'unsupported_grant_type');
    await expectOAuthError(await tokenRequest({}), 400, 'invalid_request');
    await expectOAuthError(
      await fetch(`${base}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"grant_type":"authorization_code"}' }),
      400,
      'invalid_request'
    );
    await expectOAuthError(
      await fetch(`${base}/oauth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not json' }),
      400,
      'invalid_client_metadata'
    );
  });

  it('a repeated parameter is refused', async () => {
    const response = await fetch(`${base}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&grant_type=authorization_code',
    });
    await expectOAuthError(response, 400, 'invalid_request');
  });
});

// ---------------------------------------------------------------------------
// הלוג - אחרון, אחרי שכל הזרימות רצו
// ---------------------------------------------------------------------------

describe('logs', () => {
  it('the capture sees the firebase-functions logger (canary)', () => {
    logger.info('oauth.canary', { marker: `canary-${RUN}` });
    expect(captured.join('\n')).toContain(`canary-${RUN}`);
  });

  it('no secret value appears in the log output, not even partially', () => {
    const log = captured.join('\n');
    expect(log).toContain('oauth.');
    expect(secrets.size).toBeGreaterThan(50);

    const leaks: string[] = [];
    for (const value of secrets) {
      // כל רצף של 12 תווים מהערך (בלי ה-prefix הקבוע)
      const body = value.replace(/^n4m_(at|rt)_/, '');
      for (let i = 0; i + 12 <= body.length; i++) {
        if (log.includes(body.slice(i, i + 12))) {
          leaks.push(`${value.slice(0, 7)}… at ${i}`);
          break;
        }
      }
    }
    expect(leaks).toEqual([]);
  });
});
