/**
 * הגדרות שרת ה-MCP (mcp-plan §1.2, §5).
 */

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export const SERVER_INFO = { name: 'notes-4-me', version: '1.0.0' } as const;

/**
 * הגבלת קצב לכל משתמש, לפי ה-uid מה-token (לא ניתן לזיוף, בניגוד ל-IP).
 * שיחה עם Claude שעוברת על הפתקים היא עשרות קריאות, לא מאות בדקה.
 */
export const MCP_USER_LIMITS = [
  { name: 'minute', windowMs: MINUTE, max: 120 },
  { name: 'day', windowMs: DAY, max: 5000 },
] as const;

/**
 * גודל הפלט של tool. הפלט נכנס להקשר של Claude: פלט ענק דוחק החוצה את
 * השיחה עצמה. כשהפלט נחתך, הטקסט אומר זאת במפורש ואיך להמשיך.
 */
export const OUTPUT = {
  /** תווים לתשובה אחת */
  maxChars: 20_000,
  /** תצוגה מקדימה של פתק ברשימה */
  previewChars: 160,
  listDefault: 30,
  listMax: 100,
  searchDefault: 20,
  searchMax: 50,
} as const;

/** גוף בקשה ל-`/mcp`. קריאות קריאה קטנות; מגן מגופים ענקיים */
export const MAX_REQUEST_BODY = '256kb';
