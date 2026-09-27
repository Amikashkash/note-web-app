/**
 * פונקציית `mcp`: שרת ה-MCP וה-Authorization Server באפליקציה אחת
 * (mcp-plan §1.3, §4.1). Hosting מפנה אליה את `/mcp`, `/oauth/*` ו-`/.well-known/*`.
 *
 * `POST /mcp`:
 * 1. `requireMcpAuth` - access token תקף (verify.ts). בלי token: 401 עם
 *    `WWW-Authenticate`, וכך Claude מתחיל את ה-OAuth flow.
 * 2. הגבלת קצב לכל משתמש (לפי ה-uid מה-token).
 * 3. שרת MCP חדש לבקשה, עם `UserScope` של המשתמש.
 *
 * שתי גרסאות פרוטוקול, שתיהן stateless ו-JSON בלבד (בלי SSE, שעלול להיתקע
 * ב-CDN של Hosting):
 * - 2026-07-28 (המודרנית): `createMcpHandler` עם `responseMode: 'json'`.
 * - 2025 (`initialize`): transport עם `enableJsonResponse`. ה-SDK היה
 *   עונה עליה ב-SSE.
 * `GET` ו-`DELETE` (פעולות session) מחזירים 405.
 */

import express, { type Request as ExpressRequest, type Response as ExpressResponse } from 'express';
import { logger } from 'firebase-functions';
import {
  createMcpHandler,
  isLegacyRequest,
  WebStandardStreamableHTTPServerTransport,
  type AuthInfo,
} from '@modelcontextprotocol/server';
import { createOAuthApp, securityHeaders, type OAuthAppDeps } from '../oauth/app';
import type { RateLimitWindow } from '../oauth/config';
import { OAuthStore } from '../oauth/store';
import { requireMcpAuth, type AuthContext } from '../oauth/verify';
import { MAX_REQUEST_BODY, MCP_USER_LIMITS, MCP_WRITE_LIMITS } from './config';
import { createMcpServer, defaultScopeFactory, type ScopeFactory } from './server';

export interface McpAppDeps extends OAuthAppDeps {
  scopeFor?: ScopeFactory;
  /** לבדיקות בלבד. ברירת המחדל היא `MCP_USER_LIMITS` */
  mcpLimits?: readonly RateLimitWindow[];
  /** לבדיקות בלבד. ברירת המחדל היא `MCP_WRITE_LIMITS` */
  mcpWriteLimits?: readonly RateLimitWindow[];
}

/** ה-`AuthContext` עובר דרך ה-SDK כ-`authInfo.extra` (pass-through, לא מועתק) */
const contextFrom = (authInfo: AuthInfo | undefined): AuthContext => {
  const context = authInfo?.extra?.context as AuthContext | undefined;
  if (!context) throw new Error('MCP request without a verified context');
  return context;
};

/** Express → Request סטנדרטי. הגוף כבר פוענח ע"י `express.json` */
const toWebRequest = (req: ExpressRequest): globalThis.Request => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  }
  return new Request(`https://${req.headers.host ?? 'localhost'}${req.originalUrl}`, {
    method: req.method,
    headers,
    body: req.body === undefined ? undefined : JSON.stringify(req.body),
  });
};

/** Response סטנדרטי → Express. התשובות תמיד JSON, לא stream */
const sendWebResponse = async (res: ExpressResponse, response: globalThis.Response): Promise<void> => {
  res.status(response.status);
  response.headers.forEach((value, name) => {
    if (name !== 'content-length' && name !== 'transfer-encoding') res.setHeader(name, value);
  });
  res.send(Buffer.from(await response.arrayBuffer()));
};

export const createMcpApp = (deps: McpAppDeps) => {
  const {
    store,
    auth,
    clock = Date.now,
    scopeFor = defaultScopeFactory,
    mcpLimits = MCP_USER_LIMITS,
    mcpWriteLimits = MCP_WRITE_LIMITS,
  } = deps;
  const buildServer = (context: AuthContext) =>
    createMcpServer(context, {
      scopeFor,
      consumeWriteQuota: () =>
        store.consumeRateLimit(`mcp_write_${context.identity.uid}`, mcpWriteLimits, clock()),
    });

  const modern = createMcpHandler(({ authInfo }) => buildServer(contextFrom(authInfo)), {
    legacy: 'reject',
    responseMode: 'json',
    onerror: (error) => logger.warn('mcp.transport_error', { errorName: error.name }),
  });

  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);

  const perUserLimit: express.RequestHandler = async (_req, res, next) => {
    const { identity } = res.locals.auth as AuthContext;
    const result = await store.consumeRateLimit(`mcp_user_${identity.uid}`, mcpLimits, clock());
    if (result.allowed) return next();
    logger.warn('mcp.rate_limited', { uid: identity.uid });
    res
      .status(429)
      .set('Retry-After', String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))))
      .json({ jsonrpc: '2.0', error: { code: -32000, message: 'Too many requests. Try again shortly.' }, id: null });
  };

  app.post(
    '/mcp',
    requireMcpAuth({ store, auth, clock }),
    perUserLimit,
    express.json({ limit: MAX_REQUEST_BODY }),
    async (req, res) => {
      const context = res.locals.auth as AuthContext;
      // ה-token עצמו לא עובר ל-SDK: אין לו בו צורך, ואין סיבה שיסתובב בזיכרון שלו
      const authInfo: AuthInfo = { token: '[verified]', clientId: context.clientId, scopes: context.scopes, extra: { context } };
      const request = toWebRequest(req);

      if (await isLegacyRequest(request, req.body)) {
        const server = buildServer(context);
        const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
        await server.connect(transport);
        try {
          await sendWebResponse(res, await transport.handleRequest(request, { authInfo, parsedBody: req.body }));
        } finally {
          await server.close();
        }
        return;
      }

      await sendWebResponse(res, await modern.fetch(request, { authInfo, parsedBody: req.body }));
    }
  );

  // stateless: אין session לפתוח stream עליו או למחוק
  app.all('/mcp', (_req, res) => {
    res
      .status(405)
      .set('Allow', 'POST')
      .json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
  });

  // `/oauth/*` ו-`/.well-known/*`, וה-404 וטיפול השגיאות לכל השאר
  app.use(createOAuthApp(deps));

  // שגיאה לא צפויה ב-`/mcp` (ה-error handler של אפליקציית ה-OAuth לא רואה
  // אותה). בלי זה Express היה עונה בדף HTML, ובפיתוח גם עם stack trace
  app.use((error: unknown, req: ExpressRequest, res: ExpressResponse, _next: express.NextFunction) => {
    logger.error('mcp.server_error', { path: req.path, errorName: (error as Error)?.name ?? 'unknown' });
    if (res.headersSent) return;
    res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
  });
  return app;
};

/** האפליקציה של הפרודקשן, נבנית פעם אחת לכל מופע (lazy, ראו `index.ts`) */
let productionApp: ReturnType<typeof createMcpApp> | null = null;

export const mcpApp = async () => {
  if (!productionApp) {
    const { getAuth } = await import('firebase-admin/auth');
    productionApp = createMcpApp({ store: OAuthStore.create(), auth: getAuth() });
  }
  return productionApp;
};
