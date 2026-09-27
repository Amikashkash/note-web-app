/**
 * זהות מאומתת - הדרך היחידה לבנות `UserScope` (mcp-plan §3.2.2).
 *
 * `VerifiedIdentity` הוא טיפוס ממותג: אי אפשר לבנות אותו מאובייקט
 * `{ uid }` רגיל, גם לא עם `as`, כי `UserScope.for` בודק בזמן ריצה שהאובייקט
 * יצא מ-`mintVerifiedIdentity`. כך `uid` לא יכול להגיע מקלט של tool.
 *
 * `mintVerifiedIdentity` נקרא רק אחרי אימות token. ESLint חוסם ייבוא
 * שלו בכל `functions/src` חוץ מ-`oauth/verify.ts` (שלב 1ב, עוד לא קיים),
 * כך שב-PR הזה אין לו אף קורא מחוץ לבדיקות.
 */

import { InvalidError } from './errors';

declare const verifiedBrand: unique symbol;

export interface VerifiedIdentity {
  readonly uid: string;
  readonly [verifiedBrand]: true;
}

/** כל זהות שנוצרה כאן. WeakSet: לא מחזיק זהויות בזיכרון אחרי הבקשה */
const minted = new WeakSet<object>();

/** אותה מגבלה כמו מזהה משתמש של Firebase Auth */
const MAX_UID_LENGTH = 128;

/**
 * ⚠️ רק אחרי שה-token אומת ו-`uid` נלקח ממנו. לעולם לא מקלט של בקשה.
 */
export const mintVerifiedIdentity = (uid: string): VerifiedIdentity => {
  if (typeof uid !== 'string' || uid.length === 0 || uid.length > MAX_UID_LENGTH || uid.includes('/')) {
    throw new InvalidError('Invalid uid');
  }
  const identity = Object.freeze({ uid }) as VerifiedIdentity;
  minted.add(identity);
  return identity;
};

export const isVerifiedIdentity = (value: unknown): value is VerifiedIdentity =>
  typeof value === 'object' && value !== null && minted.has(value);
