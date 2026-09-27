/**
 * `GET` ו-`POST /oauth/decision` - מסך ההסכמה (mcp-plan §2.3.5).
 *
 * הזרימה:
 * 1. `GET ?req=` עם `Authorization: Bearer <Firebase ID token>`: מחזיר
 *    את פרטי הבקשה לתצוגה, **קושר** את הבקשה למשתמש המחובר ומחזיר nonce
 *    חד-פעמי. בקשה שכבר נקשרה למשתמש אחר לא נפתחת לאף אחד אחר.
 * 2. `POST` עם `{ req, nonce, approve }` ואותו סוג של token: ההחלטה
 *    מתקבלת רק אם `req` ממתין, לא פג, קשור לאותו `uid`, וה-nonce תואם
 *    ל-hash השמור. ההחלטה נצרכת ב-transaction, פעם אחת בלבד.
 *
 * מה זה מונע:
 * - **החלטה מזויפת:** צריך ID token של המשתמש (header, לא cookie - אתר
 *   אחר לא יכול לשלוח אותו) וגם nonce שנמסר רק לו.
 * - **החלטה חוזרת (replay):** הבקשה יוצאת מ-`pending` בהחלטה הראשונה.
 * - **החלטה בשם משתמש אחר:** ה-uid מה-token חייב להיות זה שנקשר ב-GET.
 * - **clickjacking:** `/connect` מוגש עם `frame-ancestors 'none'` ו-
 *   `X-Frame-Options: DENY` (`firebase.json`), והדף עצמו מסרב לרוץ בתוך frame.
 *
 * כל כשל של הבקשה (לא קיימת, פגה, הוחלטה, של משתמש אחר, nonce שגוי)
 * מחזיר את אותה שגיאה.
 */

import type { Auth } from 'firebase-admin/auth';
import { ISSUER, LIFETIMES } from './config';
import { OAuthError } from './errors';
import { isUserAllowed } from './policy';
import type { OAuthStore, RequestRecord } from './store';
import { constantTimeEqual, isSecretShaped, randomSecret, sha256Hex } from './tokens';
import { withParams } from './authorize';

const requestInvalid = () =>
  new OAuthError('invalid_request', 'The authorization request is invalid or has expired');

const notAllowed = () =>
  new OAuthError('access_denied', 'Claude access is not enabled for this account', 403);

/** Bearer מה-header, או `null`. token ב-query או ב-body לא נקרא בכלל */
export const bearerToken = (authorization: unknown): string | null => {
  if (typeof authorization !== 'string') return null;
  const match = /^Bearer ([^\s]+)$/i.exec(authorization.trim());
  return match ? match[1] : null;
};

/**
 * המשתמש המחובר, מתוך Firebase ID token. `checkRevoked`: token של משתמש
 * מושבת או אחרי "התנתק מכל המכשירים" נדחה. התחברות ישנה מיממה מחייבת
 * התחברות מחדש (`login_required`) לפני הסכמה.
 */
const signedInUser = async (auth: Auth, authorization: unknown, now: number): Promise<string> => {
  const idToken = bearerToken(authorization);
  if (!idToken) throw new OAuthError('invalid_token', 'Sign-in required', 401);

  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    throw new OAuthError('invalid_token', 'Sign-in required', 401);
  }
  const authTime = typeof decoded.auth_time === 'number' ? decoded.auth_time * 1000 : 0;
  if (now - authTime > LIFETIMES.authTime) {
    throw new OAuthError('login_required', 'Please sign in again to connect', 401);
  }
  return decoded.uid;
};

const isOpen = (request: RequestRecord | null, now: number): request is RequestRecord =>
  request !== null && request.status === 'pending' && request.expiresAt > now;

export interface DecisionDeps {
  store: OAuthStore;
  auth: Auth;
  authorization: unknown;
  now: number;
}

export interface RequestDescription {
  clientName: string;
  /** מוצג בבירור במסך (דרישת ה-spec): לאן הגישה תישלח */
  redirectHost: string;
  scopes: string[];
  nonce: string;
  expiresAt: string;
}

export const describeRequest = async ({
  store,
  auth,
  authorization,
  reqId,
  now,
}: DecisionDeps & { reqId: unknown }): Promise<RequestDescription> => {
  const uid = await signedInUser(auth, authorization, now);
  if (!isSecretShaped(reqId)) throw requestInvalid();

  const nonce = randomSecret();
  const outcome = await store.run(async (tx) => {
    const request = await tx.getRequest(reqId);
    const config = await tx.getAccessConfig();
    const client = request ? await tx.getClient(request.clientId) : null;

    if (!isOpen(request, now) || !client || (request.uid !== null && request.uid !== uid)) return null;
    if (!isUserAllowed(config, uid)) return 'not_allowed' as const;

    // GET חוזר (רענון הדף) מחליף את ה-nonce. הישן לא תקף יותר
    tx.updateRequest(reqId, { uid, nonceHash: sha256Hex(nonce) });
    return { request, client };
  });

  if (outcome === null) throw requestInvalid();
  if (outcome === 'not_allowed') throw notAllowed();

  return {
    clientName: outcome.client.clientName,
    redirectHost: new URL(outcome.request.redirectUri).host,
    scopes: outcome.request.scope.split(' '),
    nonce,
    expiresAt: new Date(outcome.request.expiresAt).toISOString(),
  };
};

export const decide = async ({
  store,
  auth,
  authorization,
  body,
  now,
}: DecisionDeps & { body: unknown }): Promise<{ redirectTo: string }> => {
  const uid = await signedInUser(auth, authorization, now);

  const { req, nonce, approve } = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  if (!isSecretShaped(req) || !isSecretShaped(nonce) || typeof approve !== 'boolean') throw requestInvalid();

  const outcome = await store.run(async (tx) => {
    const request = await tx.getRequest(req);
    const config = await tx.getAccessConfig();

    if (
      !isOpen(request, now) ||
      request.uid !== uid ||
      request.nonceHash === null ||
      !constantTimeEqual(sha256Hex(nonce), request.nonceHash)
    ) {
      return null;
    }

    // הבקשה נצרכת בכל מקרה: אישור, דחייה, או משתמש שלא ברשימה
    if (!isUserAllowed(config, uid)) {
      tx.updateRequest(req, { status: 'denied' });
      return 'not_allowed' as const;
    }
    if (!approve) {
      tx.updateRequest(req, { status: 'denied' });
      return { request, code: null };
    }

    const code = randomSecret();
    tx.setCode(sha256Hex(code), {
      uid,
      clientId: request.clientId,
      grantId: randomSecret(),
      codeChallenge: request.codeChallenge,
      redirectUri: request.redirectUri,
      resource: request.resource,
      scope: request.scope,
      used: false,
      createdAt: now,
      expiresAt: now + LIFETIMES.code,
    });
    tx.updateRequest(req, { status: 'approved' });
    return { request, code };
  });

  if (outcome === null) throw requestInvalid();
  if (outcome === 'not_allowed') throw notAllowed();

  const { request, code } = outcome;
  return {
    redirectTo: withParams(request.redirectUri, {
      ...(code ? { code } : { error: 'access_denied' }),
      state: request.state,
      iss: ISSUER,
    }),
  };
};
