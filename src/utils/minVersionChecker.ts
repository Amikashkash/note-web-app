/**
 * מתי לקרוא את `config/app.minClientVersion` מהשרת (D4a). טהור: הקריאה,
 * הזמן והטיימרים מוזרקים, כדי לבדוק בלי Firestore ובלי DOM.
 *
 * למה לא מספיקים המאזין החי וקריאה אחת בחזרה לאפליקציה (v1.33.0):
 * - אחרי שינה של הטלפון החיבור של Firestore מת. `getDocFromServer` נכשל
 *   מיד ("client is offline") או מחכה עד שהחיבור נופל, והמאזין מתחבר
 *   מחדש רק אחרי backoff של עד דקה וחצי. קריאה אחת בחזרה - נכשלה בשקט,
 *   ואף אחד לא ניסה שוב. המשתמש הספיק לערוך בלי חסימה.
 * - `online` לא מגיע, כי מבחינת הדפדפן הרשת לא נפלה.
 *
 * לכן:
 * - **כישלון → ניסיון חוזר** (`MIN_VERSION_RETRY_DELAYS_MS`), כל עוד הדף גלוי.
 * - **בדיקה תקופתית** כל `MIN_VERSION_RECHECK_MS` כשהדף גלוי.
 * - **לפני כתיבה** (`check('write')`): אם הבדיקה המוצלחת האחרונה ישנה
 *   מ-`MIN_VERSION_WRITE_STALE_MS`, בודקים. לא חוסם את הכתיבה הנוכחית -
 *   אבל עריכה רציפה נעצרת תוך שניות.
 * - בדיקות כפולות (focus ו-visibilitychange יחד) מתאחדות: אחת בכל פעם,
 *   ולא שוב תוך `MIN_VERSION_MIN_GAP_MS` מהצלחה.
 */

export const MIN_VERSION_RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000];
export const MIN_VERSION_RECHECK_MS = 5 * 60_000;
export const MIN_VERSION_WRITE_STALE_MS = 60_000;
export const MIN_VERSION_MIN_GAP_MS = 30_000;

export type CheckReason = 'start' | 'resume' | 'online' | 'retry' | 'periodic' | 'write';

export interface MinVersionCheckerDeps {
  fetch: () => Promise<unknown>;
  onValue: (value: unknown) => void;
  onResult?: (result: { ok: boolean; at: number; reason: CheckReason }) => void;
  isVisible: () => boolean;
  now: () => number;
  setTimer: (callback: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

export interface MinVersionChecker {
  check: (reason: CheckReason) => void;
  stop: () => void;
}

export const createMinVersionChecker = (deps: MinVersionCheckerDeps): MinVersionChecker => {
  let inFlight = false;
  let stopped = false;
  let lastSuccessAt = -Infinity;
  let failures = 0;
  let timer: unknown = null;

  const schedule = (ms: number, reason: CheckReason) => {
    if (timer !== null) deps.clearTimer(timer);
    timer = deps.setTimer(() => {
      timer = null;
      // דף מוסתר לא בודק; החזרה אליו (`resume`) תבדוק
      if (deps.isVisible()) check(reason);
    }, ms);
  };

  const check = (reason: CheckReason) => {
    if (stopped || inFlight) return;
    const sinceSuccess = deps.now() - lastSuccessAt;
    if (reason === 'write' && sinceSuccess < MIN_VERSION_WRITE_STALE_MS) return;
    if (reason !== 'retry' && sinceSuccess < MIN_VERSION_MIN_GAP_MS) return;

    inFlight = true;
    deps.fetch().then(
      (value) => {
        inFlight = false;
        if (stopped) return;
        lastSuccessAt = deps.now();
        failures = 0;
        deps.onValue(value);
        deps.onResult?.({ ok: true, at: lastSuccessAt, reason });
        schedule(MIN_VERSION_RECHECK_MS, 'periodic');
      },
      () => {
        inFlight = false;
        if (stopped) return;
        const delay = MIN_VERSION_RETRY_DELAYS_MS[Math.min(failures, MIN_VERSION_RETRY_DELAYS_MS.length - 1)];
        failures += 1;
        deps.onResult?.({ ok: false, at: deps.now(), reason });
        schedule(delay, 'retry');
      }
    );
  };

  return {
    check,
    stop: () => {
      stopped = true;
      if (timer !== null) deps.clearTimer(timer);
      timer = null;
    },
  };
};
