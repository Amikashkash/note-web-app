/**
 * שגיאות OAuth בפורמט הסטנדרטי: `{ error, error_description }`
 * (RFC 6749 §5.2, RFC 7591 §3.2.2, RFC 6750 §3).
 *
 * `error_description` נכתב כאן ולא מקלט: הוא לא מצטט ערכים שהלקוח שלח,
 * ולעולם לא אומר אם משתמש או לקוח קיימים. "code לא קיים", "code של לקוח
 * אחר" ו-"לקוח לא קיים" הם כולם `invalid_grant` עם אותו תיאור.
 */

export type OAuthErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'unauthorized_client'
  | 'unsupported_grant_type'
  | 'unsupported_response_type'
  | 'invalid_scope'
  | 'invalid_target'
  | 'access_denied'
  | 'server_error'
  | 'temporarily_unavailable'
  | 'invalid_redirect_uri'
  | 'invalid_client_metadata'
  | 'invalid_token'
  | 'insufficient_scope'
  | 'login_required';

export class OAuthError extends Error {
  readonly error: OAuthErrorCode;
  readonly status: number;
  /** שניות, ל-`Retry-After` */
  readonly retryAfter?: number;

  constructor(error: OAuthErrorCode, description: string, status = 400, retryAfter?: number) {
    super(description);
    this.name = 'OAuthError';
    this.error = error;
    this.status = status;
    this.retryAfter = retryAfter;
  }

  toJSON(): { error: OAuthErrorCode; error_description: string } {
    return { error: this.error, error_description: this.message };
  }
}

/** אותה שגיאה לכל כשל של code או refresh token - אין רמז מה בדיוק נכשל */
export const invalidGrant = () => new OAuthError('invalid_grant', 'The grant is invalid, expired or revoked');

export const tooManyRequests = (retryAfterMs: number) =>
  new OAuthError('temporarily_unavailable', 'Too many requests', 429, Math.max(1, Math.ceil(retryAfterMs / 1000)));
