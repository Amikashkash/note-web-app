/**
 * יצירה, hash ואימות של ערכים סודיים (mcp-plan §2.3.6, §2.3.8).
 *
 * - tokens, codes, מזהי בקשות ו-nonces הם 32 בתים אקראיים ב-base64url.
 * - ל-access ו-refresh tokens יש prefix (`n4m_at_`, `n4m_rt_`), כדי
 *   ש-secret scanning יזהה אותם אם ידלפו.
 * - ב-Firestore נשמר רק SHA-256 hash של token, code ו-nonce. דליפה של
 *   המסד לא נותנת ערך שמיש.
 *
 * ⚠️ אף ערך שנוצר כאן לא נכתב ללוג, גם לא בחלקו. ה-hash לא רגיש, אבל
 * גם הוא לא נרשם - אין בו צורך לתחקור.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const ACCESS_TOKEN_PREFIX = 'n4m_at_';
export const REFRESH_TOKEN_PREFIX = 'n4m_rt_';

/** 32 בתים אקראיים = 43 תווי base64url */
export const randomSecret = (): string => randomBytes(32).toString('base64url');

export const newAccessToken = (): string => `${ACCESS_TOKEN_PREFIX}${randomSecret()}`;
export const newRefreshToken = (): string => `${REFRESH_TOKEN_PREFIX}${randomSecret()}`;

export const sha256Hex = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const RANDOM_PART = /^[A-Za-z0-9_-]{43}$/;

/** ערך שנראה כמו מה ש-`randomSecret` מייצר. כל דבר אחר נדחה לפני שנוגעים במסד */
export const isSecretShaped = (value: unknown, prefix = ''): value is string =>
  typeof value === 'string' && value.startsWith(prefix) && RANDOM_PART.test(value.slice(prefix.length));

/** RFC 7636 §4.1: 43 עד 128 תווים מ-unreserved */
const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;

/** S256 challenge: base64url של SHA-256, תמיד 43 תווים */
const S256_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

export const isCodeVerifier = (value: unknown): value is string => typeof value === 'string' && VERIFIER.test(value);

export const isS256Challenge = (value: unknown): value is string =>
  typeof value === 'string' && S256_CHALLENGE.test(value);

/** השוואה בזמן קבוע, כדי שזמן התגובה לא ידליף כמה תווים תאמו */
export const constantTimeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
};

/** PKCE, S256 בלבד (RFC 7636 §4.6). `plain` לא נתמך בשום מקום */
export const verifyPkceS256 = (verifier: string, challenge: string): boolean =>
  isCodeVerifier(verifier) &&
  isS256Challenge(challenge) &&
  constantTimeEqual(createHash('sha256').update(verifier, 'ascii').digest('base64url'), challenge);
