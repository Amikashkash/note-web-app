/**
 * `POST /oauth/token` (mcp-plan §2.3.6, §2.3.7).
 *
 * authorization_code:
 * - ה-code נצרך בהצגה הראשונה שלו, **גם אם היא נכשלה** (verifier שגוי,
 *   לקוח אחר): לגונב code יש ניסיון אחד בלבד.
 * - code שכבר נצרך ומוצג שוב מבטל את ה-grant שנוצר ממנו, ואת כל ה-tokens
 *   שלו (OAuth 2.1 §4.1.3).
 * - PKCE S256, `redirect_uri` זהה, `client_id` זהה, `resource` זהה (אם נשלח).
 *
 * refresh_token:
 * - rotation: הישן מסומן `used`, והחדש חוזר באותה תשובה.
 * - reuse detection: refresh token מסומן `used` שמוצג שוב מבטל את כל
 *   המשפחה (ה-grant). זה המחיר של retry אמיתי במקביל - ומעדיפים אותו.
 *
 * כל כשל של code או refresh token הוא `invalid_grant` עם אותו תיאור:
 * התשובה לא מגלה אם הלקוח קיים, אם ה-code קיים, או מה בדיוק לא תאם.
 * משתמש שהוסר מה-allowlist מקבל גם הוא `invalid_grant`.
 */

import { LIFETIMES } from './config';
import { invalidGrant, OAuthError } from './errors';
import { isScopeSubset, isUserAllowed, parseScope, singleParam } from './policy';
import type { GrantRecord, OAuthStore, OAuthTransaction, TokenRecord } from './store';
import {
  isCodeVerifier,
  isSecretShaped,
  newAccessToken,
  newRefreshToken,
  REFRESH_TOKEN_PREFIX,
  sha256Hex,
  verifyPkceS256,
} from './tokens';

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

type Outcome = { kind: 'issued'; response: TokenResponse } | { kind: 'reuse'; grantId: string } | { kind: 'invalid' };

const missing = () => new OAuthError('invalid_request', 'Missing or repeated parameter');

/** זוג tokens חדש לאותו grant. זמני החיים לא עוברים את התקרה של ה-grant */
const issueTokens = (
  tx: OAuthTransaction,
  grant: Pick<GrantRecord, 'grantId' | 'uid' | 'clientId' | 'absoluteExpiresAt'>,
  scope: string,
  resource: string,
  now: number
): TokenResponse => {
  const accessToken = newAccessToken();
  const refreshToken = newRefreshToken();
  const accessExpiresAt = Math.min(now + LIFETIMES.accessToken, grant.absoluteExpiresAt);
  const base: Omit<TokenRecord, 'type' | 'expiresAt'> = {
    grantId: grant.grantId,
    uid: grant.uid,
    clientId: grant.clientId,
    scope,
    resource,
    createdAt: now,
    used: false,
    revoked: false,
  };

  tx.createToken(sha256Hex(accessToken), { ...base, type: 'access', expiresAt: accessExpiresAt });
  tx.createToken(sha256Hex(refreshToken), {
    ...base,
    type: 'refresh',
    expiresAt: Math.min(now + LIFETIMES.refreshToken, grant.absoluteExpiresAt),
  });

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: Math.floor((accessExpiresAt - now) / 1000),
    refresh_token: refreshToken,
    scope,
  };
};

const exchangeCode = async (store: OAuthStore, params: Record<string, unknown>, now: number): Promise<Outcome> => {
  const code = singleParam(params.code);
  const verifier = singleParam(params.code_verifier);
  const redirectUri = singleParam(params.redirect_uri);
  const clientId = singleParam(params.client_id);
  const resource = singleParam(params.resource);
  if (!code || !verifier || !redirectUri || !clientId || resource === null) throw missing();
  if (!isSecretShaped(code) || !isCodeVerifier(verifier)) return { kind: 'invalid' };

  const codeHash = sha256Hex(code);
  return store.run(async (tx): Promise<Outcome> => {
    const record = await tx.getCode(codeHash);
    if (!record) return { kind: 'invalid' };
    const client = await tx.getClient(record.clientId);
    const existingGrant = await tx.getGrant(record.grantId);
    const config = await tx.getAccessConfig();

    if (record.used) {
      tx.revokeGrant(record.grantId, 'code_reuse');
      return { kind: 'reuse', grantId: record.grantId };
    }
    tx.markCodeUsed(codeHash);

    const valid =
      record.expiresAt > now &&
      client !== null &&
      record.clientId === clientId &&
      record.redirectUri === redirectUri &&
      (resource === undefined || resource === record.resource) &&
      verifyPkceS256(verifier, record.codeChallenge) &&
      existingGrant === null &&
      isUserAllowed(config, record.uid);
    if (!valid || !client) return { kind: 'invalid' };

    const grant: GrantRecord = {
      grantId: record.grantId,
      consentVersion: record.consentVersion ?? 1,
      uid: record.uid,
      clientId: record.clientId,
      clientName: client.clientName,
      scope: record.scope,
      createdAt: now,
      lastUsedAt: now,
      absoluteExpiresAt: now + LIFETIMES.grant,
      revoked: false,
      revokedReason: null,
    };
    tx.createGrant(grant);
    if (client.expiresAt !== null) tx.markClientUsed(client.clientId);
    return { kind: 'issued', response: issueTokens(tx, grant, record.scope, record.resource, now) };
  });
};

const refresh = async (store: OAuthStore, params: Record<string, unknown>, now: number): Promise<Outcome> => {
  const token = singleParam(params.refresh_token);
  const clientId = singleParam(params.client_id);
  const scopeParam = singleParam(params.scope);
  const resource = singleParam(params.resource);
  if (!token || !clientId || scopeParam === null || resource === null) throw missing();
  if (!isSecretShaped(token, REFRESH_TOKEN_PREFIX)) return { kind: 'invalid' };

  const requestedScopes = scopeParam === undefined ? null : parseScope(scopeParam);
  if (scopeParam !== undefined && !requestedScopes) throw new OAuthError('invalid_scope', 'Unsupported scope');

  const tokenHash = sha256Hex(token);
  const outcome = await store.run(async (tx): Promise<Outcome | 'bad_scope'> => {
    const record = await tx.getToken(tokenHash);
    if (!record || record.type !== 'refresh') return { kind: 'invalid' };
    const grant = await tx.getGrant(record.grantId);
    const config = await tx.getAccessConfig();

    if (record.used) {
      tx.revokeGrant(record.grantId, 'refresh_reuse');
      return { kind: 'reuse', grantId: record.grantId };
    }

    const valid =
      !record.revoked &&
      record.expiresAt > now &&
      record.clientId === clientId &&
      grant !== null &&
      !grant.revoked &&
      grant.absoluteExpiresAt > now &&
      (resource === undefined || resource === record.resource) &&
      isUserAllowed(config, record.uid);
    if (!valid || !grant) return { kind: 'invalid' };

    // אפשר לצמצם scope ב-refresh, לא להרחיב (RFC 6749 §6)
    const scope = requestedScopes ? requestedScopes.join(' ') : record.scope;
    if (!isScopeSubset(scope, record.scope)) return 'bad_scope';

    tx.updateToken(tokenHash, { used: true });
    tx.touchGrant(grant.grantId, now);
    return { kind: 'issued', response: issueTokens(tx, grant, scope, record.resource, now) };
  });

  if (outcome === 'bad_scope') throw new OAuthError('invalid_scope', 'Scope exceeds the original grant');
  return outcome;
};

export const exchangeToken = async ({
  store,
  params,
  now,
}: {
  store: OAuthStore;
  params: Record<string, unknown>;
  now: number;
}): Promise<TokenResponse> => {
  const grantType = singleParam(params.grant_type);
  if (grantType === undefined || grantType === null) throw missing();

  let outcome: Outcome;
  if (grantType === 'authorization_code') outcome = await exchangeCode(store, params, now);
  else if (grantType === 'refresh_token') outcome = await refresh(store, params, now);
  else throw new OAuthError('unsupported_grant_type', 'Unsupported grant_type');

  if (outcome.kind === 'issued') return outcome.response;
  if (outcome.kind === 'reuse') await store.revokeGrantTokens(outcome.grantId);
  throw invalidGrant();
};
