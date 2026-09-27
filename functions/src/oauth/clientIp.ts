/**
 * כתובת הלקוח להגבלת קצב (שאלת ה-`X-Forwarded-For` מ-PR #9).
 *
 * מה ידוע על הדרך שבה בקשה מגיעה לפונקציה:
 * - **דרך Firebase Hosting** (`notes-4-me.web.app/...`): Hosting רץ על
 *   Fastly. Fastly מוסיף `Fastly-Client-IP` עם כתובת הלקוח, והערך
 *   האחרון ב-`X-Forwarded-For` הוא שרת ה-CDN, לא הלקוח. הערך הראשון ב-
 *   `X-Forwarded-For` הוא מה שהלקוח עצמו שלח - מה ש-PR #9 לקח, בטעות.
 * - **ישירות** (ה-URL של Cloud Run, שחייב להיות ציבורי כדי ש-Hosting
 *   יוכל לקרוא לו): אין `Fastly-Client-IP` אמיתי, וה-front end של Google
 *   מוסיף את כתובת המתחבר בסוף `X-Forwarded-For`.
 *
 * אף header לא אמין לגמרי: מי שקורא ישירות ל-URL של Cloud Run יכול לשלוח
 * `Fastly-Client-IP` מזויף. לכן ההגבלה לכל IP היא "best effort", וההגנה
 * שלא ניתנת לעקיפה היא התקרה הכללית (ובשרת ה-MCP - ההגבלה לכל משתמש,
 * שנגזרת מה-token). `source` נרשם בלוג כדי לאמת בפרודקשן מאיפה הכתובת הגיעה.
 */

import { isIP } from 'node:net';

export type IpSource = 'fastly-client-ip' | 'x-forwarded-for' | 'socket';

type Headers = Record<string, string | string[] | undefined>;

const single = (value: string | string[] | undefined): string | undefined =>
  (Array.isArray(value) ? value[value.length - 1] : value)?.trim() || undefined;

export const clientIp = (headers: Headers, remoteAddress: string | undefined): { ip: string; source: IpSource } => {
  const fastly = single(headers['fastly-client-ip']);
  if (fastly && isIP(fastly)) return { ip: fastly, source: 'fastly-client-ip' };

  // האחרון: מה שהוסיף ה-proxy האחרון לפני הפונקציה, לא מה שהלקוח שלח
  const forwarded = single(headers['x-forwarded-for'])?.split(',').map((part) => part.trim()).filter(Boolean);
  const last = forwarded?.[forwarded.length - 1];
  if (last && isIP(last)) return { ip: last, source: 'x-forwarded-for' };

  return { ip: remoteAddress ?? 'unknown', source: 'socket' };
};
