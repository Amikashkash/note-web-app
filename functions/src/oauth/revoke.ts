/**
 * `POST /oauth/revoke` (RFC 7009, mcp-plan §2.3.10).
 *
 * תמיד 200 כשהבקשה בנויה נכון, גם כשה-token לא קיים או שייך ללקוח אחר:
 * התשובה לא מגלה אם token קיים. ביטול refresh token מבטל את כל ה-grant.
 */

import { OAuthError } from './errors';
import { singleParam } from './policy';
import type { OAuthStore } from './store';
import { ACCESS_TOKEN_PREFIX, isSecretShaped, REFRESH_TOKEN_PREFIX, sha256Hex } from './tokens';

export const revokeToken = async ({
  store,
  params,
}: {
  store: OAuthStore;
  params: Record<string, unknown>;
}): Promise<void> => {
  const token = singleParam(params.token);
  const clientId = singleParam(params.client_id);
  if (!token || !clientId) throw new OAuthError('invalid_request', 'Missing or repeated parameter');

  if (!isSecretShaped(token, ACCESS_TOKEN_PREFIX) && !isSecretShaped(token, REFRESH_TOKEN_PREFIX)) return;

  const tokenHash = sha256Hex(token);
  const revokedGrant = await store.run(async (tx) => {
    const record = await tx.getToken(tokenHash);
    if (!record || record.clientId !== clientId) return null;

    tx.updateToken(tokenHash, { revoked: true });
    if (record.type !== 'refresh') return null;
    tx.revokeGrant(record.grantId, 'revoked_by_client');
    return record.grantId;
  });

  if (revokedGrant) await store.revokeGrantTokens(revokedGrant);
};
