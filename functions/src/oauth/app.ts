/**
 * אפליקציית Express של ה-Authorization Server (mcp-plan §2.3).
 *
 * לא מיוצאת מ-`index.ts` ולא רצה בפרודקשן. בשלב 1ג היא תורכב יחד עם
 * `/mcp` בפונקציה אחת, מאחורי rewrites של Hosting.
 *
 * מה חל על כל תשובה:
 * - `Cache-Control: no-store` - ה-CDN של Hosting לא שומר כלום (§1.3).
 * - `frame-ancestors 'none'` ו-`X-Frame-Options: DENY`, `nosniff`,
 *   `Referrer-Policy: no-referrer`.
 * - שגיאות בפורמט OAuth (`{ error, error_description }`), גם 404 ו-500.
 * - לוג: שם האירוע ומזהים לא סודיים בלבד. **לעולם לא** token, code,
 *   verifier, nonce, מזהה בקשה, ID token, גוף בקשה או headers.
 */

import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import type { Auth } from 'firebase-admin/auth';
import { logger } from 'firebase-functions';
import { authorize } from './authorize';
import { clientIp } from './clientIp';
import { RATE_LIMITS, type RateLimitedEndpoint, type RateLimitWindow } from './config';
import { decide, describeRequest } from './decision';
import { OAuthError, tooManyRequests } from './errors';
import { revokeMcpGrant } from './grants';
import { authorizationServerMetadata, protectedResourceMetadata } from './metadata';
import { registerClient } from './register';
import { revokeToken } from './revoke';
import type { OAuthStore } from './store';
import { exchangeToken } from './token';
import { sha256Hex } from './tokens';

type Limits = Record<RateLimitedEndpoint, { perIp: readonly RateLimitWindow[]; global: readonly RateLimitWindow[] }>;

export interface OAuthAppDeps {
  store: OAuthStore;
  auth: Auth;
  clock?: () => number;
  /** לבדיקות בלבד. ברירת המחדל היא `RATE_LIMITS` */
  rateLimits?: Limits;
}

const BODY_LIMIT = '16kb';

const ERROR_PAGE = `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><title>Notes 4 Me</title></head>
<body><h1>בקשת ההתחברות לא תקינה</h1>
<p>החיבור לא הושלם. חזרו לאפליקציה שממנה התחלתם ונסו שוב.</p>
<p lang="en" dir="ltr">The authorization request is invalid. Return to the application and try again.</p>
</body></html>`;

/** מפתח להגבלת קצב לפי IP: hash, כדי שכתובות IP לא יישמרו במסד. ראו `clientIp.ts` */
const ipKey = (req: Request): string => sha256Hex(clientIp(req.headers, req.socket.remoteAddress).ip).slice(0, 32);

export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.set({
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
  });
  next();
};

/** מטא-דאטה ציבורית: לקוחות MCP בדפדפן (למשל MCP Inspector) קוראים אותה */
const publicJson =
  (body: () => object): RequestHandler =>
  (_req, res) => {
    res.set('Access-Control-Allow-Origin', '*').json(body());
  };

const asParams = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const createOAuthApp = ({ store, auth, clock = Date.now, rateLimits = RATE_LIMITS }: OAuthAppDeps) => {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);

  const rateLimited =
    (endpoint: RateLimitedEndpoint): RequestHandler =>
    async (req, _res, next) => {
      const now = clock();
      const limits = rateLimits[endpoint];
      for (const [key, windows] of [
        [`oauth_${endpoint}_ip_${ipKey(req)}`, limits.perIp],
        [`oauth_${endpoint}_all`, limits.global],
      ] as const) {
        const result = await store.consumeRateLimit(key, windows, now);
        if (!result.allowed) {
          logger.warn('oauth.rate_limited', { endpoint });
          throw tooManyRequests(result.retryAfterMs);
        }
      }
      next();
    };

  const form = express.urlencoded({ extended: false, limit: BODY_LIMIT, parameterLimit: 20 });
  const json = express.json({ limit: BODY_LIMIT });

  app.get('/.well-known/oauth-authorization-server', publicJson(authorizationServerMetadata));
  app.get(
    ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'],
    publicJson(protectedResourceMetadata)
  );

  app.post('/oauth/register', json, rateLimited('register'), async (req, res) => {
    const client = await registerClient({ store, body: req.body, now: clock() });
    logger.info('oauth.client_registered', {
      clientId: client.client_id,
      ipSource: clientIp(req.headers, req.socket.remoteAddress).source,
    });
    res.status(201).json(client);
  });

  app.get('/oauth/authorize', rateLimited('authorize'), async (req, res) => {
    const result = await authorize({ store, query: req.query as Record<string, unknown>, now: clock() });
    if (result.kind === 'error_page') {
      logger.info('oauth.authorize_rejected');
      res.status(400).type('html').send(ERROR_PAGE);
      return;
    }
    res.redirect(302, result.location);
  });

  app.get('/oauth/decision', async (req, res) => {
    const description = await describeRequest({
      store,
      auth,
      authorization: req.headers.authorization,
      reqId: req.query.req,
      now: clock(),
    });
    res.json(description);
  });

  app.post('/oauth/decision', json, async (req, res) => {
    const result = await decide({ store, auth, authorization: req.headers.authorization, body: req.body, now: clock() });
    logger.info('oauth.decision', { approved: !result.redirectTo.includes('error=') });
    res.json(result);
  });

  // "אפליקציות מחוברות" בהגדרות: ניתוק חיבור ע"י המשתמש
  app.post('/oauth/grants/revoke', json, async (req, res) => {
    const { grantId } = await revokeMcpGrant({ store, auth, authorization: req.headers.authorization, body: req.body });
    logger.info('oauth.grant_revoked_by_user', { grantId });
    res.json({ revoked: true });
  });

  app.post('/oauth/token', form, rateLimited('token'), async (req, res) => {
    const params = asParams(req.body);
    const tokens = await exchangeToken({ store, params, now: clock() });
    logger.info('oauth.token_issued', {
      grantType: params.grant_type === 'refresh_token' ? 'refresh_token' : 'authorization_code',
      ipSource: clientIp(req.headers, req.socket.remoteAddress).source,
    });
    res.json(tokens);
  });

  app.post('/oauth/revoke', form, rateLimited('revoke'), async (req, res) => {
    await revokeToken({ store, params: asParams(req.body) });
    res.status(200).end();
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'invalid_request', error_description: 'Not found' });
  });

  // Express מזהה error handler לפי ארבעה פרמטרים, ולכן `_next` נשאר
  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof OAuthError) {
      if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
      if (error.status === 401) res.set('WWW-Authenticate', `Bearer error="${error.error}"`);
      res.status(error.status).json(error.toJSON());
      return;
    }

    // גוף שלא מתפרש (JSON שבור, גדול מדי) - שגיאה של הלקוח, בלי לצטט אותו
    const bodyError = (error as { type?: string }).type;
    if (typeof bodyError === 'string' && bodyError.startsWith('entity.')) {
      const code = req.path === '/oauth/register' ? 'invalid_client_metadata' : 'invalid_request';
      res.status(400).json({ error: code, error_description: 'Malformed request body' });
      return;
    }

    // רק סוג השגיאה. ההודעה של Firestore או של Express עלולה לכלול נתוני בקשה
    logger.error('oauth.server_error', { path: req.path, errorName: (error as Error)?.name ?? 'unknown' });
    res.status(500).json({ error: 'server_error', error_description: 'Internal error' });
  });

  return app;
};
