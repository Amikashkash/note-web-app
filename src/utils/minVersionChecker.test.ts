import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMinVersionChecker,
  MIN_VERSION_RECHECK_MS,
  MIN_VERSION_RETRY_DELAYS_MS,
  MIN_VERSION_WRITE_STALE_MS,
  type CheckReason,
} from './minVersionChecker';
import { isBelowMinimum } from './appVersion';

/** שרת מדומה: נגיש או לא, ומה הערך ב-`config/app` */
const setup = () => {
  const server = { reachable: true, value: undefined as unknown, reads: 0 };
  const page = { visible: true };
  const values: unknown[] = [];
  const results: { ok: boolean; reason: CheckReason }[] = [];

  const checker = createMinVersionChecker({
    fetch: () => {
      server.reads += 1;
      return server.reachable
        ? Promise.resolve(server.value)
        : Promise.reject(new Error('Failed to get document because the client is offline.'));
    },
    onValue: (value) => values.push(value),
    onResult: ({ ok, reason }) => results.push({ ok, reason }),
    isVisible: () => page.visible,
    now: () => Date.now(),
    setTimer: (callback, ms) => setTimeout(callback, ms),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  });

  const blocked = (running: string) => values.length > 0 && isBelowMinimum(running, values[values.length - 1]);
  return { server, page, values, results, checker, blocked };
};

describe('minVersionChecker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    return () => vi.useRealTimers();
  });

  it('the incident: resume after sleep, the first read fails, the block still arrives without another event', async () => {
    const { server, page, checker, blocked } = setup();
    // האפליקציה פתוחה מלפני, ה-config עוד ריק
    checker.check('start');
    await vi.advanceTimersByTimeAsync(0);
    expect(blocked('1.33.0')).toBe(false);

    // הבעלים קובע מינימום; הטלפון ישן, ומתעורר כשהחיבור של Firestore עוד מת
    page.visible = false;
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    server.value = '1.33.1';
    server.reachable = false;
    page.visible = true;
    checker.check('resume');
    await vi.advanceTimersByTimeAsync(0);
    expect(blocked('1.33.0')).toBe(false);

    // החיבור קם אחרי שנייה. אין visibilitychange נוסף, אין online.
    // v1.33.0 עצרה כאן: קריאה אחת, בלי ניסיון חוזר.
    await vi.advanceTimersByTimeAsync(1_000);
    server.reachable = true;
    await vi.advanceTimersByTimeAsync(MIN_VERSION_RETRY_DELAYS_MS[0]);
    expect(blocked('1.33.0')).toBe(true);
  });

  it('retries with growing delays while the server is unreachable, then stops retrying after success', async () => {
    const { server, results, checker } = setup();
    server.reachable = false;
    checker.check('start');
    await vi.advanceTimersByTimeAsync(0);
    expect(server.reads).toBe(1);

    for (const [index, delay] of MIN_VERSION_RETRY_DELAYS_MS.entries()) {
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(server.reads).toBe(index + 1);
      await vi.advanceTimersByTimeAsync(1);
      expect(server.reads).toBe(index + 2);
    }
    // אחרי האחרון - ממשיכים בקצב האחרון, לא מוותרים
    const last = MIN_VERSION_RETRY_DELAYS_MS[MIN_VERSION_RETRY_DELAYS_MS.length - 1];
    await vi.advanceTimersByTimeAsync(last);
    expect(server.reads).toBe(MIN_VERSION_RETRY_DELAYS_MS.length + 2);

    server.reachable = true;
    await vi.advanceTimersByTimeAsync(last);
    expect(results[results.length - 1]).toEqual({ ok: true, reason: 'retry' });
    const readsAfterSuccess = server.reads;
    await vi.advanceTimersByTimeAsync(MIN_VERSION_RECHECK_MS - 1);
    expect(server.reads).toBe(readsAfterSuccess);
  });

  it('rechecks periodically while visible, and a hidden page does not read', async () => {
    const { server, page, checker } = setup();
    checker.check('start');
    await vi.advanceTimersByTimeAsync(0);
    expect(server.reads).toBe(1);

    await vi.advanceTimersByTimeAsync(MIN_VERSION_RECHECK_MS);
    expect(server.reads).toBe(2);

    page.visible = false;
    await vi.advanceTimersByTimeAsync(MIN_VERSION_RECHECK_MS * 3);
    expect(server.reads).toBe(2);

    // חזרה לאפליקציה בודקת מיד, ומחדשת את הבדיקה התקופתית
    page.visible = true;
    checker.check('resume');
    await vi.advanceTimersByTimeAsync(0);
    expect(server.reads).toBe(3);
    await vi.advanceTimersByTimeAsync(MIN_VERSION_RECHECK_MS);
    expect(server.reads).toBe(4);
  });

  it('a retry that comes due while hidden waits for the resume', async () => {
    const { server, page, checker } = setup();
    server.reachable = false;
    checker.check('start');
    await vi.advanceTimersByTimeAsync(0);
    page.visible = false;
    await vi.advanceTimersByTimeAsync(MIN_VERSION_RETRY_DELAYS_MS[0] * 10);
    expect(server.reads).toBe(1);
  });

  it('a write checks only when the last successful read is stale', async () => {
    const { server, checker } = setup();
    checker.check('start');
    await vi.advanceTimersByTimeAsync(0);

    checker.check('write');
    await vi.advanceTimersByTimeAsync(MIN_VERSION_WRITE_STALE_MS - 1);
    checker.check('write');
    await vi.advanceTimersByTimeAsync(0);
    expect(server.reads).toBe(1);

    await vi.advanceTimersByTimeAsync(1);
    checker.check('write');
    await vi.advanceTimersByTimeAsync(0);
    expect(server.reads).toBe(2);
  });

  it('a write checks right away when no read has succeeded yet', async () => {
    const { server, checker } = setup();
    server.reachable = false;
    checker.check('start');
    await vi.advanceTimersByTimeAsync(0);
    server.reachable = true;
    checker.check('write');
    await vi.advanceTimersByTimeAsync(0);
    expect(server.reads).toBe(2);
  });

  it('events that arrive together (focus + visibilitychange + pageshow) make one read', async () => {
    const { server, checker } = setup();
    checker.check('resume');
    checker.check('resume');
    checker.check('resume');
    await vi.advanceTimersByTimeAsync(0);
    expect(server.reads).toBe(1);
    // ושוב מיד אחרי הצלחה - לא קוראים
    checker.check('resume');
    await vi.advanceTimersByTimeAsync(0);
    expect(server.reads).toBe(1);
  });

  it('stop cancels the pending timer and ignores a read that finishes later', async () => {
    const { server, values, checker } = setup();
    server.value = '9.0.0';
    checker.check('start');
    checker.stop();
    await vi.advanceTimersByTimeAsync(MIN_VERSION_RECHECK_MS * 2);
    expect(values).toEqual([]);
    expect(server.reads).toBe(1);
  });
});
