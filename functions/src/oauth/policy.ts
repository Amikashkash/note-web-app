/**
 * כללי ההחלטה של ה-AS, טהורים: בלי Firestore ובלי Express.
 */

import { DEFAULT_SCOPE, REDIRECT_URI_ALLOWLIST, SUPPORTED_SCOPES } from './config';
import type { AccessConfig } from './store';

/**
 * התאמה מדויקת לרשימה, תו אחר תו. בלי נרמול: `HTTPS://claude.ai/...`,
 * סלאש בסוף, port מפורש או query - כולם נדחים.
 */
export const isAllowedRedirectUri = (uri: unknown): uri is string =>
  typeof uri === 'string' && REDIRECT_URI_ALLOWLIST.includes(uri);

/**
 * `scope` כפי שהלקוח שלח (רשימה מופרדת ברווחים), או `null` אם הוא לא
 * תקין או מבקש משהו שלא נתמך. חסר = ברירת המחדל.
 */
export const parseScope = (scope: unknown): string[] | null => {
  if (scope === undefined) return [DEFAULT_SCOPE];
  if (typeof scope !== 'string' || scope.length > 200) return null;
  const scopes = [...new Set(scope.split(' ').filter(Boolean))];
  if (scopes.length === 0) return [DEFAULT_SCOPE];
  return scopes.every((item) => SUPPORTED_SCOPES.includes(item)) ? scopes : null;
};

/** האם `requested` מוכל כולו ב-`granted` (שתיהן מחרוזות מופרדות ברווחים) */
export const isScopeSubset = (requested: string, granted: string): boolean => {
  const allowed = new Set(granted.split(' '));
  return requested.split(' ').filter(Boolean).every((item) => allowed.has(item));
};

/** allowlist המשתמשים (§2.3.5). fail-closed: רק `openToAll === true` או uid ברשימה */
export const isUserAllowed = (config: AccessConfig, uid: string): boolean =>
  config.openToAll === true || config.allowedUids.includes(uid);

/**
 * פרמטר בודד מ-query או מ-form. פרמטר שמופיע פעמיים (`?a=1&a=2`) נדחה:
 * RFC 6749 §3.1 אוסר, ו-Express הופך אותו למערך.
 */
export const singleParam = (value: unknown): string | undefined | null => {
  if (value === undefined) return undefined;
  return typeof value === 'string' ? value : null;
};
