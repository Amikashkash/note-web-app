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

/**
 * גרסת הנוסח שהמשתמש אישר במסך ההסכמה. נשמרת ב-grant.
 * - 1 (עד v1.25): "יצירת פתקים חדשים, בלי עריכה".
 * - 2 (v1.26): גם עדכון משימות והוספת טקסט בסוף פתק.
 * - 3 (מ-v1.27): גם תכניות עבודה (הוספת סעיפים וטקסט בסעיף), החלפת טקסט
 *   מדויקת והסרת סעיפים - רק כשהמשתמש ביקש במפורש, והכל ניתן לשחזור.
 * - 4 (מ-v1.28): גם ארכוב ושחזור מהארכיון, העברה בין קטגוריות, והוספה
 *   והסרה של משימות.
 *
 * `notes.write` מכסה את שתיהן מבחינת הרשאה, אבל חיבור שאושר בנוסח 1
 * לא הסכים לעריכה. לכן כלי העריכה דורשים 2, וחיבור ישן מקבל הודעה
 * שצריך לחבר מחדש (בלי scope חדש).
 */
export const CONSENT_VERSION = 4;
/** עדכון משימות והוספה בסוף פתק טקסט */
export const EDIT_CONSENT_VERSION = 2;
/** מ-v1.27: סעיפים בתכנית עבודה, החלפת טקסט והסרת סעיפים */
export const REWRITE_CONSENT_VERSION = 3;
/** מ-v1.28: ארכוב ושחזור, העברה בין קטגוריות, הוספה והסרה של משימות */
export const ORGANIZE_CONSENT_VERSION = 4;
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
