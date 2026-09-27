/**
 * לאן לחזור אחרי התחברות (ST-4)
 *
 * `ProtectedRoute` שולח משתמש לא מחובר ל-`/login` יחד עם המקום שממנו
 * הגיע, ו-`Login` מחזיר אותו לשם אחרי ההתחברות. קודם ההתחברות תמיד
 * הובילה לדף הבית: שיתוף נכנס (`/share?shareId=...`) או לחיצה על התראה
 * כשהמשתמש לא מחובר הלכו לאיבוד. גם מסך ההסכמה של MCP (`/connect?req=`)
 * יזדקק לזה.
 *
 * טהור - בלי React Router, כדי שאפשר לבדוק את בדיקת הבטיחות לבד.
 */

export interface ReturnLocation {
  pathname: string;
  search?: string;
  hash?: string;
}

/** ה-state שמצורף לניווט ל-`/login` */
export const loginRedirectState = (location: ReturnLocation) => ({
  from: { pathname: location.pathname, search: location.search ?? '', hash: location.hash ?? '' },
});

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * הנתיב לחזור אליו, או `/` כשאין יעד תקין.
 *
 * רק נתיב פנימי: מתחיל ב-`/` אחד. `//evil.com` או `/\evil.com` הם
 * כתובות של אתר אחר בעיני הדפדפן - open redirect. ה-state מגיע מה-history
 * של הדפדפן ולא מהמשתמש ישירות, אבל אין סיבה לסמוך עליו.
 */
export const safeReturnPath = (state: unknown): string => {
  const from = (state as { from?: unknown } | null | undefined)?.from;
  if (typeof from !== 'object' || from === null) return '/';

  const { pathname, search, hash } = from as Record<string, unknown>;
  if (typeof pathname !== 'string') return '/';

  const isInternal =
    pathname.startsWith('/') && !pathname.startsWith('//') && !pathname.startsWith('/\\');
  if (!isInternal || pathname === '/login') return '/';

  return `${pathname}${asText(search)}${asText(hash)}`;
};
