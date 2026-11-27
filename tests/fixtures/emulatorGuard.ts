/**
 * שומר הסף של סקריפט נתוני הבדיקה (`scripts/seed-emulator.ts`, סבב 4).
 *
 * הסקריפט כותב משתמש, קטגוריות ופתקים. מול הפרויקט האמיתי זה היה כותב לתוך
 * הנתונים שלך, ולכן הוא **מסרב לרוץ** אלא אם כל אלה נכונים, ונכשל לפני שהוא
 * יוצר חיבור כלשהו:
 * - `FIRESTORE_EMULATOR_HOST` ו-`FIREBASE_AUTH_EMULATOR_HOST` מוגדרים ומצביעים
 *   למחשב הזה (localhost, 127.0.0.1 או ::1). בלי שני אלה ה-Admin SDK פונה לענן.
 * - הפרויקט מתחיל ב-`demo-`: פרויקט שאינו קיים בענן, ו-Firebase לא ייתן לו
 *   לגעת במשאבים אמיתיים גם אם משהו אחר השתבש.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** host:port, או `[::1]:port`. רק את ה-host בודקים */
const hostOf = (value: string): string => {
  const ipv6 = /^\[([^\]]+)\](?::\d+)?$/.exec(value);
  if (ipv6) return ipv6[1];
  const colon = value.lastIndexOf(':');
  return colon === -1 ? value : value.slice(0, colon);
};

const isLocal = (value: string | undefined): boolean =>
  typeof value === 'string' && value.trim() !== '' && LOCAL_HOSTS.has(hostOf(value.trim()));

/**
 * מחזיר את מזהה הפרויקט כשמותר לרוץ, ואחרת זורק עם הסבר מה חסר.
 * `env` - בדרך כלל `process.env`.
 */
export const assertEmulatorOnly = (env: Record<string, string | undefined>): string => {
  const problems: string[] = [];
  for (const name of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
    if (!isLocal(env[name])) problems.push(`${name} must point to a local emulator (got: ${env[name] ?? 'not set'})`);
  }
  const projectId = env.GCLOUD_PROJECT ?? env.GOOGLE_CLOUD_PROJECT ?? '';
  if (!projectId.startsWith('demo-')) {
    problems.push(`the project must be a demo- project (got: ${projectId || 'not set'})`);
  }
  if (problems.length > 0) {
    throw new Error(`Refusing to run: this script writes test data and runs only against the emulator.\n- ${problems.join('\n- ')}`);
  }
  return projectId;
};
