/**
 * `GET /oauth/authorize` (mcp-plan §2.3.4).
 *
 * שני סוגי כשל, לפי OAuth 2.1 §4.1.2.1:
 * - `client_id` או `redirect_uri` לא תקינים: **דף שגיאה, בלי redirect**.
 *   אחרת אפשר היה להשתמש ב-AS כ-open redirect. אותו דף בדיוק ללקוח שלא
 *   קיים ולכתובת שלא רשומה, כך שהדף לא מגלה אם הלקוח קיים.
 * - כל השאר: redirect חזרה ללקוח עם `error`, `state` ו-`iss` (RFC 9207).
 *
 * בקשה תקינה נשמרת כ-`oauthRequests/{reqId}` ל-10 דקות, והדפדפן מופנה
 * למסך ההסכמה ב-SPA (`/connect?req=`).
 */

import { CONNECT_URL, ISSUER, LIFETIMES, RESOURCE } from './config';
import type { OAuthErrorCode } from './errors';
import { isAllowedRedirectUri, parseScope, singleParam } from './policy';
import type { OAuthStore } from './store';
import { isS256Challenge, isSecretShaped, randomSecret } from './tokens';

const MAX_STATE = 1024;

export type AuthorizeResult =
  | { kind: 'redirect'; location: string }
  /** דף שגיאה בלי redirect. אין פירוט: לא מבדילים בין לקוח לא קיים לכתובת לא רשומה */
  | { kind: 'error_page' };

/** redirect חזרה ללקוח עם פרמטרים. `redirectUri` כבר עבר את ה-allowlist */
export const withParams = (redirectUri: string, params: Record<string, string | null | undefined>): string => {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) url.searchParams.set(key, value);
  }
  return url.toString();
};

export const authorize = async ({
  store,
  query,
  now,
}: {
  store: OAuthStore;
  query: Record<string, unknown>;
  now: number;
}): Promise<AuthorizeResult> => {
  const clientId = singleParam(query.client_id);
  const redirectUri = singleParam(query.redirect_uri);

  // מזהה בפורמט URL (CIMD) לא נתמך (§2.1). הוא גם לא בצורה של מזהה שלנו
  if (!isSecretShaped(clientId) || !isAllowedRedirectUri(redirectUri)) return { kind: 'error_page' };
  const client = await store.getClient(clientId);
  if (!client || !client.redirectUris.includes(redirectUri)) return { kind: 'error_page' };

  const state = singleParam(query.state);
  const fail = (error: OAuthErrorCode, description: string): AuthorizeResult => ({
    kind: 'redirect',
    location: withParams(redirectUri, {
      error,
      error_description: description,
      // state לא תקין לא מוחזר - אין להחזיר ללקוח ערך שלא עבר בדיקה
      state: typeof state === 'string' && state.length <= MAX_STATE ? state : undefined,
      iss: ISSUER,
    }),
  });

  if (state === null || (typeof state === 'string' && state.length > MAX_STATE)) {
    return fail('invalid_request', 'Invalid state');
  }
  if (singleParam(query.response_type) !== 'code') {
    return fail('unsupported_response_type', 'Only response_type=code is supported');
  }
  // PKCE חובה, S256 בלבד. method חסר נחשב `plain` (RFC 7636 §4.3) ונדחה
  if (singleParam(query.code_challenge_method) !== 'S256') {
    return fail('invalid_request', 'PKCE with code_challenge_method=S256 is required');
  }
  const codeChallenge = singleParam(query.code_challenge);
  if (!isS256Challenge(codeChallenge)) {
    return fail('invalid_request', 'Invalid code_challenge');
  }
  if (singleParam(query.resource) !== RESOURCE) {
    return fail('invalid_target', 'Unknown resource');
  }
  const scopeParam = singleParam(query.scope);
  const scopes = scopeParam === null ? null : parseScope(scopeParam);
  if (!scopes) return fail('invalid_scope', 'Unsupported scope');

  const reqId = randomSecret();
  await store.createRequest({
    reqId,
    clientId,
    redirectUri,
    codeChallenge,
    scope: scopes.join(' '),
    resource: RESOURCE,
    state: state ?? null,
    status: 'pending',
    uid: null,
    nonceHash: null,
    createdAt: now,
    expiresAt: now + LIFETIMES.request,
  });

  return { kind: 'redirect', location: `${CONNECT_URL}?req=${encodeURIComponent(reqId)}` };
};
