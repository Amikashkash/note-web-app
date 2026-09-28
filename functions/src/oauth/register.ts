/**
 * `POST /oauth/register` - Dynamic Client Registration (RFC 7591, mcp-plan §2.3.3).
 *
 * רק public clients (`token_endpoint_auth_method: "none"`), רק
 * authorization_code ו-refresh_token, ורק redirect URIs מה-allowlist
 * בהתאמה מדויקת. כל השאר נדחה. מטא-דאטה שלא מוכרת (למשל `logo_uri`)
 * מתעלמים ממנה ולא שומרים.
 */

import { LIFETIMES, REDIRECT_URI_ALLOWLIST } from './config';
import { OAuthError } from './errors';
import { isAllowedRedirectUri } from './policy';
import type { OAuthStore } from './store';
import { randomSecret } from './tokens';

const GRANT_TYPES = ['authorization_code', 'refresh_token'];
const MAX_CLIENT_NAME = 100;

const invalidMetadata = (description: string) => new OAuthError('invalid_client_metadata', description);

/** שם לתצוגה במסך ההסכמה: בלי תווי בקרה, בלי רווחים כפולים, מקוצר */
const cleanClientName = (value: unknown): string => {
  if (value === undefined) return 'MCP client';
  if (typeof value !== 'string') throw invalidMetadata('client_name must be a string');
  // eslint-disable-next-line no-control-regex
  const name = value.replace(/[\u0000-\u001f\u007f-\u009f\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim();
  return (name || 'MCP client').slice(0, MAX_CLIENT_NAME);
};

const stringList = (value: unknown, field: string): string[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw invalidMetadata(`${field} must be an array of strings`);
  }
  return value;
};

export interface RegisterInput {
  store: OAuthStore;
  body: unknown;
  now: number;
}

export const registerClient = async ({ store, body, now }: RegisterInput) => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw invalidMetadata('Expected a JSON object');
  }
  const metadata = body as Record<string, unknown>;

  const redirectUris = stringList(metadata.redirect_uris, 'redirect_uris');
  if (!redirectUris || redirectUris.length === 0 || redirectUris.length > REDIRECT_URI_ALLOWLIST.length) {
    throw new OAuthError('invalid_redirect_uri', 'redirect_uris must list allowed redirect URIs');
  }
  if (!redirectUris.every(isAllowedRedirectUri)) {
    throw new OAuthError('invalid_redirect_uri', 'A redirect URI is not allowed');
  }

  const authMethod = metadata.token_endpoint_auth_method ?? 'none';
  if (authMethod !== 'none') throw invalidMetadata('Only public clients (token_endpoint_auth_method "none") are supported');

  const grantTypes = stringList(metadata.grant_types, 'grant_types') ?? GRANT_TYPES;
  if (grantTypes.length === 0 || !grantTypes.every((type) => GRANT_TYPES.includes(type))) {
    throw invalidMetadata('Unsupported grant_types');
  }

  const responseTypes = stringList(metadata.response_types, 'response_types') ?? ['code'];
  if (responseTypes.length === 0 || !responseTypes.every((type) => type === 'code')) {
    throw invalidMetadata('Unsupported response_types');
  }

  const clientId = randomSecret();
  const clientName = cleanClientName(metadata.client_name);
  const uniqueRedirects = [...new Set(redirectUris)];

  await store.createClient({
    clientId,
    clientName,
    redirectUris: uniqueRedirects,
    source: 'dcr',
    createdAt: now,
    expiresAt: now + LIFETIMES.unusedClient,
  });

  return {
    client_id: clientId,
    client_id_issued_at: Math.floor(now / 1000),
    client_name: clientName,
    redirect_uris: uniqueRedirects,
    grant_types: grantTypes,
    response_types: responseTypes,
    token_endpoint_auth_method: 'none',
  };
};
