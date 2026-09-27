/**
 * `revokeMcpGrant` - ניתוק חיבור מתוך האפליקציה ("אפליקציות מחוברות"
 * בהגדרות, mcp-plan §2.3.10).
 *
 * route בתוך פונקציית `mcp` (`POST /oauth/grants/revoke`) ולא callable
 * נפרד: כך הפריסה נשארת `functions:mcp` בלבד. אותו דפוס כמו
 * `/oauth/decision`: Firebase ID token ב-header, בלי cookie.
 *
 * grant של משתמש אחר, או שלא קיים, מחזיר אותה שגיאה. grant שכבר בוטל -
 * הצלחה (הפעולה אידמפוטנטית).
 */

import type { Auth } from 'firebase-admin/auth';
import { firebaseUser } from './decision';
import { OAuthError } from './errors';
import type { OAuthStore } from './store';
import { isSecretShaped } from './tokens';

const notFound = () => new OAuthError('invalid_request', 'Connection not found', 404);

export const revokeMcpGrant = async ({
  store,
  auth,
  authorization,
  body,
}: {
  store: OAuthStore;
  auth: Auth;
  authorization: unknown;
  body: unknown;
}): Promise<{ grantId: string }> => {
  const { uid } = await firebaseUser(auth, authorization);
  const grantId = (typeof body === 'object' && body !== null ? (body as { grantId?: unknown }).grantId : undefined);
  if (!isSecretShaped(grantId)) throw notFound();

  const found = await store.run(async (tx) => {
    const grant = await tx.getGrant(grantId);
    if (!grant || grant.uid !== uid) return false;
    if (!grant.revoked) tx.revokeGrant(grantId, 'revoked_by_user');
    return true;
  });
  if (!found) throw notFound();

  await store.revokeGrantTokens(grantId);
  return { grantId };
};
