/**
 * הגדרות ה-Authorization Server (mcp-plan §2.3).
 *
 * הכל כאן קבוע וציבורי: אין secrets. tokens אטומים לא דורשים מפתח
 * (§2.3.8), ו-allowlist המשתמשים יושב ב-Firestore (`config/mcp`) ולא בריפו.
 */

/** ה-origin של האפליקציה. גם ה-issuer וגם הבית של `/connect` (§1.3) */
export const ISSUER = 'https://notes-4-me.web.app';

/** ה-URL שהמשתמש מזין ב-Claude. חייב להיות זהה בדיוק (RFC 8707, RFC 9728) */
export const RESOURCE = `${ISSUER}/mcp`;

export const CONNECT_URL = `${ISSUER}/connect`;

/**
 * כתובות ה-redirect המותרות. **התאמה מדויקת בלבד**, תו אחר תו: בלי
 * prefix, בלי wildcard, בלי התעלמות מ-port.
 *
 * רק הממשקים המתארחים של Claude (web, desktop, mobile). Claude Code
 * משתמש ב-loopback עם port שמשתנה בכל session, ולכן **לא יכול להתחבר**
 * כרגע - החלטה מודעת (שלב 1ב). הוספתו מחייבת התאמה שמתעלמת מה-port
 * (RFC 8252 §7.3), כלומר שינוי בכלל הזה ולא רק ברשימה.
 */
export const REDIRECT_URI_ALLOWLIST: readonly string[] = ['https://claude.ai/api/mcp/auth_callback'];

/**
 * ה-scopes שה-AS מנפיק.
 * - `notes.read`: ארבעת כלי הקריאה.
 * - `notes.write`: מ-שלב 2א, `create_note` בלבד (יצירה, בלי עריכה).
 * `offline_access` מפורסם כדי ש-Claude יבקש refresh token (§2.3.11).
 *
 * `RESOURCE_SCOPES` מופיע ב-`WWW-Authenticate` וב-metadata, ולכן חיבור
 * חדש מבקש את שניהם. חיבור קיים שמחזיק רק `notes.read` לא מתרחב ב-refresh
 * (RFC 6749 §6): צריך לנתק ולחבר מחדש כדי לקבל כתיבה.
 */
export const RESOURCE_SCOPES = ['notes.read', 'notes.write'] as const;
export const SUPPORTED_SCOPES: readonly string[] = [...RESOURCE_SCOPES, 'offline_access'];
export const DEFAULT_SCOPE = 'notes.read';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** זמני חיים (§2.3.6, §2.3.7, טבלת Firestore ב-§2.3) */
export const LIFETIMES = {
  request: 10 * MINUTE,
  code: 60 * SECOND,
  accessToken: HOUR,
  /** sliding: כל refresh מאריך */
  refreshToken: 30 * DAY,
  /** תקרה מוחלטת מרגע ההסכמה, גם עם refresh */
  grant: 90 * DAY,
  /** לקוח שלא הונפק לו token נמחק (TTL) */
  unusedClient: DAY,
  /** התחברות ישנה מזה מחייבת התחברות מחדש לפני הסכמה */
  authTime: DAY,
} as const;

/**
 * הגבלות קצב, לכל IP ובנוסף תקרה כללית. התקרה הכללית קיימת כי ה-IP
 * נגזר מ-`X-Forwarded-For`, שלקוח יכול לזייף: זיוף עוקף את המגבלה לכל
 * IP, אבל לא את התקרה. Claude קורא מטווח IP משותף (160.79.104.0/21),
 * ולכן גם המגבלה לכל IP נדיבה ממה שמשתמש אחד צריך.
 */
export const RATE_LIMITS = {
  // Claude רושם לקוח חדש בכל חיבור חדש. חיבור הוא פעולה נדירה.
  register: {
    perIp: [
      { name: 'hour', windowMs: HOUR, max: 10 },
      { name: 'day', windowMs: DAY, max: 30 },
    ],
    global: [
      { name: 'hour', windowMs: HOUR, max: 60 },
      { name: 'day', windowMs: DAY, max: 300 },
    ],
  },
  authorize: {
    perIp: [
      { name: 'minute', windowMs: MINUTE, max: 20 },
      { name: 'day', windowMs: DAY, max: 300 },
    ],
    global: [{ name: 'minute', windowMs: MINUTE, max: 120 }],
  },
  // refresh פעם בשעה לכל חיבור, ועוד ניסיונות חוזרים אחרי 401
  token: {
    perIp: [
      { name: 'minute', windowMs: MINUTE, max: 30 },
      { name: 'day', windowMs: DAY, max: 1000 },
    ],
    global: [{ name: 'minute', windowMs: MINUTE, max: 300 }],
  },
  revoke: {
    perIp: [{ name: 'minute', windowMs: MINUTE, max: 30 }],
    global: [{ name: 'minute', windowMs: MINUTE, max: 300 }],
  },
} as const;

export type RateLimitWindow = { name: string; windowMs: number; max: number };
export type RateLimitedEndpoint = keyof typeof RATE_LIMITS;
