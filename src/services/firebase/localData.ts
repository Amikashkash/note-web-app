/**
 * הנתונים ש-Firestore שומר במכשיר (persistence, v1.35.0): הפתקים שנקראו,
 * וכתיבות שעוד לא הגיעו לשרת. שורדים סגירה של האפליקציה - וזו הכוונה:
 * פתיחה בלי רשת, ומה שנכתב offline לא נעלם.
 *
 * **בהתנתקות מוחקים אותם**, כדי שמי שמשתמש אחר כך באותו דפדפן לא יראה
 * את הפתקים (`clearLocalData`). אבל קודם בודקים שאין כתיבות ממתינות
 * (`pendingWritesSettle`): מחיקה הייתה זורקת אותן. אם יש - המשתמש בוחר
 * (`ProfileMenu`), ולעולם לא נמחקות בשקט.
 *
 * למה דגל ב-localStorage: `clearIndexedDbPersistence` עובד רק על מופע
 * שנעצר (`terminate`), וכל הלשוניות צריכות לשחרר את מסד הנתונים. אם
 * המחיקה לא הסתיימה (לשונית אחרת תקועה, הדף נסגר באמצע), הדגל נשאר,
 * והטעינה הבאה מוחקת לפני ש-Firestore מתחיל (`clearLocalDataIfRequested`
 * ב-`config.ts`). לשוניות אחרות רואות את ההתנתקות (Auth משותף), רואות את
 * הדגל, ונטענות מחדש (`authStore`).
 *
 * הערה מהתיעוד של Firebase: המחיקה לא "משמידה" את הנתונים ברמת הדיסק.
 * מספיק נגד מי שפותח את האפליקציה אחרי; לא נגד ניתוח פורנזי של המכשיר.
 */

import { clearIndexedDbPersistence, terminate, waitForPendingWrites, type Firestore } from 'firebase/firestore';
import { logger } from '@/utils/logger';

const CLEAR_FLAG = 'notes4me.clearLocalData';

/** כמה זמן לחכות שהכתיבות הממתינות יגיעו לשרת לפני שמחליטים שאין חיבור */
export const PENDING_WRITES_WAIT_MS = 5_000;
/** כמה זמן לחכות למחיקה לפני שממשיכים (והדגל משאיר אותה לטעינה הבאה) */
const CLEAR_WAIT_MS = 4_000;

const timeout = (ms: number) => new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ms));

/**
 * `true` - אין כתיבות ממתינות (או שכולן הגיעו לשרת בזמן). `false` - נשארו
 * כתיבות שלא הגיעו: בדרך כלל אין חיבור. כתיבה **שנדחתה** נחשבת שהגיעה:
 * הדחייה כבר טופלה (התנגשות בעורך, או עותק בפתק חדש).
 */
export const pendingWritesSettle = async (db: Firestore, waitMs = PENDING_WRITES_WAIT_MS): Promise<boolean> => {
  try {
    return (await Promise.race([waitForPendingWrites(db).then(() => 'done' as const), timeout(waitMs)])) === 'done';
  } catch (error) {
    logger.warn('waitForPendingWrites failed:', error);
    return false;
  }
};

export const isClearRequested = (): boolean => {
  try {
    return localStorage.getItem(CLEAR_FLAG) === '1';
  } catch {
    return false;
  }
};

const setClearRequested = (requested: boolean) => {
  try {
    if (requested) localStorage.setItem(CLEAR_FLAG, '1');
    else localStorage.removeItem(CLEAR_FLAG);
  } catch (error) {
    logger.warn('Could not update the clear-local-data flag:', error);
  }
};

let signingOutHere = false;

/**
 * הלשונית הזו מתנתקת ומוחקת: היא תיטען מחדש בעצמה כשהמחיקה תסתיים. לשונית
 * אחרת שרואה את הדגל (ולא את זה) נטענת מחדש מיד (`authStore`).
 */
export const isSigningOutHere = (): boolean => signingOutHere;

/** לפני ההתנתקות עצמה, כדי שלשוניות אחרות יידעו להיטען מחדש */
export const requestLocalDataClear = (): void => {
  signingOutHere = true;
  setClearRequested(true);
};
export const cancelLocalDataClear = (): void => {
  signingOutHere = false;
  setClearRequested(false);
};

/**
 * עוצר את Firestore ומוחק את הנתונים המקומיים. אחרי זה המופע מת: הקורא
 * חייב לטעון את הדף מחדש. לא זורק - כישלון משאיר את הדגל לטעינה הבאה.
 */
export const clearLocalData = async (db: Firestore): Promise<void> => {
  setClearRequested(true);
  try {
    await terminate(db);
    const result = await Promise.race([clearIndexedDbPersistence(db).then(() => 'done' as const), timeout(CLEAR_WAIT_MS)]);
    if (result === 'done') setClearRequested(false);
  } catch (error) {
    logger.warn('Could not clear local data now, will retry on the next load:', error);
  }
};

/**
 * בטעינה, לפני כל שימוש אחר ב-`db` (`config.ts`): מחיקה שלא הסתיימה
 * בהתנתקות הקודמת. מותר רק לפני ש-Firestore מתחיל, וזה המקום.
 */
export const clearLocalDataIfRequested = (db: Firestore): void => {
  if (!isClearRequested()) return;
  clearIndexedDbPersistence(db)
    .then(() => setClearRequested(false))
    .catch((error: unknown) => logger.warn('Clearing local data on load failed, will retry:', error));
};
