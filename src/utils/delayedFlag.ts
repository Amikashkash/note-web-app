/**
 * דגל שנדלק רק אחרי שהיה דלוק ברציפות `delayMs`, וכבה מיד. ל"ממתין לחיבור":
 * כל שמירה רגילה ממתינה כמה עשרות מילישניות עד שהשרת מאשר, וזה לא שווה
 * הבהוב. טהור: הטיימרים מוזרקים.
 */

export interface DelayedFlagDeps {
  delayMs: number;
  onChange: (on: boolean) => void;
  setTimer: (callback: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

export const createDelayedFlag = ({ delayMs, onChange, setTimer, clearTimer }: DelayedFlagDeps) => {
  let shown = false;
  let timer: unknown = null;
  const cancel = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };
  return {
    set: (on: boolean) => {
      if (!on) {
        cancel();
        if (shown) onChange((shown = false));
        return;
      }
      if (shown || timer !== null) return;
      timer = setTimer(() => {
        timer = null;
        onChange((shown = true));
      }, delayMs);
    },
    stop: cancel,
  };
};
