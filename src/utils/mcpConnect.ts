/**
 * מסך ההסכמה לחיבור Claude (`/connect`) - החלקים הטהורים.
 *
 * השרת הוא שמחליט (`functions/src/oauth/decision.ts`). כאן רק מפענחים
 * את התשובה שלו בזהירות, ומוודאים שה-redirect שהוא מחזיר הולך בדיוק
 * לאתר שהוצג למשתמש.
 */

export interface ConnectRequest {
  clientName: string;
  /** לאן הגישה תישלח. מוצג בבירור, לפי דרישת ה-spec */
  redirectHost: string;
  scopes: string[];
  nonce: string;
  expiresAt: string;
}

/** מה המשתמש רואה כשמשהו לא עובד */
export type ConnectProblem =
  /** הבקשה לא קיימת, פגה, כבר הוחלטה, או של חשבון אחר */
  | 'expired'
  /** החשבון לא ב-allowlist של שרת ה-MCP */
  | 'not_allowed'
  /** צריך להתחבר מחדש (התחברות ישנה מיממה, או token לא תקף) */
  | 'login_required'
  /** השרת לא זמין או תשובה לא צפויה */
  | 'unavailable';

export const SCOPE_LABELS: Record<string, string> = {
  'notes.read': 'קריאת הפתקים והקטגוריות שלך',
  'notes.write':
    'יצירת פתקים ועריכתם: משימות, תכניות עבודה, טקסט, העברה לארכיון ובין קטגוריות - לפי בקשה שלך',
  offline_access: 'שמירת החיבור לאורך זמן, בלי להתחבר מחדש בכל פעם',
};

export const scopeLabel = (scope: string): string => SCOPE_LABELS[scope] ?? scope;

/** האם הבקשה כוללת כתיבה - ואז מסך ההסכמה מדגיש את זה */
export const requestsWrite = (scopes: readonly string[]): boolean => scopes.includes('notes.write');

const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

export const parseConnectRequest = (value: unknown): ConnectRequest | null => {
  if (typeof value !== 'object' || value === null) return null;
  const { clientName, redirectHost, scopes, nonce, expiresAt } = value as Record<string, unknown>;
  if (!isString(clientName) || !isString(redirectHost) || !isString(nonce) || !isString(expiresAt)) return null;
  if (!Array.isArray(scopes) || !scopes.every(isString)) return null;
  return { clientName, redirectHost, scopes, nonce, expiresAt };
};

/** תשובת שגיאה מהשרת (פורמט OAuth) למצב שמוצג */
export const problemFrom = (status: number, body: unknown): ConnectProblem => {
  const error = typeof body === 'object' && body !== null ? (body as { error?: unknown }).error : undefined;
  if (status === 403 && error === 'access_denied') return 'not_allowed';
  if (status === 401) return 'login_required';
  if (status === 400 && error === 'invalid_request') return 'expired';
  return 'unavailable';
};

/**
 * ה-URL שאליו הדפדפן יעבור אחרי ההחלטה, או `null` אם הוא לא בדיוק מה
 * שהוצג: HTTPS, אותו host, בלי פרטי משתמש. השרת כבר מגביל את הכתובת
 * ל-allowlist; זו בדיקה שנייה, כדי שהדף לעולם לא ינווט למקום אחר ממה שהמשתמש אישר.
 */
export const safeRedirect = (redirectTo: unknown, expectedHost: string): string | null => {
  if (typeof redirectTo !== 'string') return null;
  let url: URL;
  try {
    url = new URL(redirectTo);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.host !== expectedHost || url.username || url.password) return null;
  return url.toString();
};

/**
 * האם הדף רץ בתוך frame. ה-headers (`frame-ancestors 'none'`) הם ההגנה
 * העיקרית מ-clickjacking; זו שכבה שנייה, למשל בשרת הפיתוח שאין בו headers.
 * גישה ל-`top` שנחסמת (origin אחר) נחשבת frame.
 */
export const isFramed = (win: Pick<Window, 'self' | 'top'>): boolean => {
  try {
    return win.self !== win.top;
  } catch {
    return true;
  }
};
