/**
 * מסמכי ה-discovery (mcp-plan §2.3.1, §2.3.2).
 *
 * לא מפורסם `client_id_metadata_document_supported`: CIMD נדחה (§2.1),
 * ובלעדיו Claude נופל ל-DCR.
 */

import { ISSUER, RESOURCE, RESOURCE_SCOPES, SUPPORTED_SCOPES } from './config';

/** RFC 8414 */
export const authorizationServerMetadata = () => ({
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/oauth/authorize`,
  token_endpoint: `${ISSUER}/oauth/token`,
  registration_endpoint: `${ISSUER}/oauth/register`,
  revocation_endpoint: `${ISSUER}/oauth/revoke`,
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none'],
  revocation_endpoint_auth_methods_supported: ['none'],
  scopes_supported: [...SUPPORTED_SCOPES],
  authorization_response_iss_parameter_supported: true,
});

/** RFC 9728 */
export const protectedResourceMetadata = () => ({
  resource: RESOURCE,
  authorization_servers: [ISSUER],
  scopes_supported: [...RESOURCE_SCOPES],
  bearer_methods_supported: ['header'],
  resource_name: 'Notes 4 Me',
});

export const PROTECTED_RESOURCE_METADATA_URL = `${ISSUER}/.well-known/oauth-protected-resource/mcp`;
