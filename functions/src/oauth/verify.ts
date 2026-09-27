/**
 * אימות access token בכל בקשה ל-`/mcp` (mcp-plan §2.3.9).
 *
 * **הקורא היחיד של `mintVerifiedIdentity`** (ESLint אוכף). זהות מאומתת
 * נוצרת רק אחרי שכל הבדיקות עברו, ורק ממנה אפשר לבנות `UserScope`.
 *
 * הבדיקות, בלי cache (ביטול חייב להיות מיידי, §2.3.8):
 * - `Authorization: Bearer` בלבד. token ב-query string או ב-body נדחה.
 * - `oauthTokens/{hash}`: `type == 'access'`, לא בוטל, לא פג, ו-`resource`
 *   הוא ה-canonical (audience, RFC 8707).
 * - ה-grant קיים, לא בוטל ולא עבר את התקרה.
 * - המשתמש ב-allowlist (`config/mcp`). הסרה מהרשימה מנתקת מיד.
 * - Firebase Auth: המשתמש קיים, לא מושבת, ו-`tokensValidAfterTime` לא
 *   מאוחר מיצירת ה-grant ("התנתק מכל המכשירים" מנתק גם את Claude).
 *
 * כל כשל הוא 401 עם אותו `WWW-Authenticate`. אין הבחנה בין token לא
 * קיים, פג או של משתמש שהושבת.
 *
 * ב-PR הזה אין endpoint של `/mcp`: הקורא יגיע בשלב 1ג.
 */

import type { Auth } from 'firebase-admin/auth';
import type { NextFunction, Request, Response } from 'express';
import { mintVerifiedIdentity, type VerifiedIdentity } from '../notesCore/identity';
import { RESOURCE, RESOURCE_SCOPES } from './config';
import { bearerToken } from './decision';
import { PROTECTED_RESOURCE_METADATA_URL } from './metadata';
import { isUserAllowed } from './policy';
import type { OAuthStore } from './store';
import { ACCESS_TOKEN_PREFIX, isSecretShaped, sha256Hex } from './tokens';

export interface AuthContext {
  identity: VerifiedIdentity;
  clientId: string;
  /** שם הלקוח מההרשמה, לרישום ב-audit */
  clientName: string;
  grantId: string;
  scopes: string[];
}

/** כשל אימות, עם ה-header שה-RS חייב להחזיר (RFC 6750 §3, RFC 9728 §5.1) */
export class McpAuthError extends Error {
  readonly status: number;
  readonly wwwAuthenticate: string;

  constructor(status: 401 | 403, error: 'invalid_request' | 'invalid_token' | 'insufficient_scope' | null, scope: string) {
    super(error ?? 'unauthorized');
    this.name = 'McpAuthError';
    this.status = status;
    const parts = [`resource_metadata="${PROTECTED_RESOURCE_METADATA_URL}"`, `scope="${scope}"`];
    if (error) parts.push(`error="${error}"`);
    this.wwwAuthenticate = `Bearer ${parts.join(', ')}`;
  }
}

const DEFAULT_CHALLENGE_SCOPE = RESOURCE_SCOPES.join(' ');

const LAST_USED_RESOLUTION = 10 * 60 * 1000;

const invalidToken = () => new McpAuthError(401, 'invalid_token', DEFAULT_CHALLENGE_SCOPE);

/** `tokensValidAfterTime` של Firebase הוא מחרוזת תאריך UTC, או חסר */
const validAfterMs = (value: string | undefined): number => {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
};

export interface VerifyInput {
  store: OAuthStore;
  auth: Auth;
  authorization: unknown;
  /** האם ה-token הגיע גם בדרך אחרת (query, body). אם כן - נדחה */
  tokenElsewhere?: boolean;
  now: number;
}

export const verifyAccessToken = async ({
  store,
  auth,
  authorization,
  tokenElsewhere = false,
  now,
}: VerifyInput): Promise<AuthContext> => {
  if (tokenElsewhere) throw new McpAuthError(401, 'invalid_request', DEFAULT_CHALLENGE_SCOPE);

  // בלי credentials בכלל: 401 בלי `error` (RFC 6750 §3.1). כך Claude מתחיל את ה-flow
  if (authorization === undefined) throw new McpAuthError(401, null, DEFAULT_CHALLENGE_SCOPE);

  const token = bearerToken(authorization);
  if (!token || !isSecretShaped(token, ACCESS_TOKEN_PREFIX)) throw invalidToken();

  const record = await store.getToken(sha256Hex(token));
  if (!record || record.type !== 'access' || record.revoked || record.expiresAt <= now || record.resource !== RESOURCE) {
    throw invalidToken();
  }

  const [grant, config] = await Promise.all([store.getGrant(record.grantId), store.getAccessConfig()]);
  if (!grant || grant.revoked || grant.absoluteExpiresAt <= now || grant.uid !== record.uid) throw invalidToken();
  if (!isUserAllowed(config, record.uid)) throw invalidToken();

  let user;
  try {
    user = await auth.getUser(record.uid);
  } catch {
    throw invalidToken();
  }
  if (user.disabled || validAfterMs(user.tokensValidAfterTime) > grant.createdAt) throw invalidToken();

  // "שימוש אחרון" ברשימת האפליקציות המחוברות, לכל היותר פעם ב-10 דקות:
  // כתיבה בכל בקשה הייתה מכפילה את העלות בשביל דיוק שאף אחד לא צריך
  if (now - grant.lastUsedAt > LAST_USED_RESOLUTION) {
    await store.touchGrant(grant.grantId, now).catch(() => undefined);
  }

  return {
    identity: mintVerifiedIdentity(record.uid),
    clientId: record.clientId,
    clientName: grant.clientName,
    grantId: record.grantId,
    scopes: record.scope.split(' ').filter(Boolean),
  };
};

/** 403 אם חסר scope. ה-tool שקורא לזה מצהיר על ה-scope שהוא דורש (§2.3.11) */
export const requireScope = (context: AuthContext, scope: string): void => {
  if (!context.scopes.includes(scope)) throw new McpAuthError(403, 'insufficient_scope', scope);
};

/**
 * Express middleware ל-`/mcp` (שלב 1ג). שם את ה-`AuthContext` ב-`res.locals.auth`.
 */
export const requireMcpAuth =
  ({ store, auth, clock = Date.now }: { store: OAuthStore; auth: Auth; clock?: () => number }) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      res.locals.auth = await verifyAccessToken({
        store,
        auth,
        authorization: req.headers.authorization,
        tokenElsewhere: req.query.access_token !== undefined || body?.access_token !== undefined,
        now: clock(),
      });
      next();
    } catch (error) {
      if (!(error instanceof McpAuthError)) return next(error);
      res.status(error.status).set('WWW-Authenticate', error.wwwAuthenticate).json({ error: error.message });
    }
  };
