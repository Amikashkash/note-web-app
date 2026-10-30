/**
 * הנתונים המקומיים בהתנתקות: לא נמחקים כשיש כתיבות שלא הגיעו לשרת (הקורא
 * שואל את המשתמש), ומחיקה שלא הסתיימה נשארת לטעינה הבאה.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase/firestore';

const firestore = vi.hoisted(() => ({
  waitForPendingWrites: vi.fn(),
  terminate: vi.fn(),
  clearIndexedDbPersistence: vi.fn(),
}));
vi.mock('firebase/firestore', () => firestore);

import {
  cancelLocalDataClear,
  clearLocalData,
  clearLocalDataIfRequested,
  isClearRequested,
  isSigningOutHere,
  pendingWritesSettle,
  requestLocalDataClear,
} from './localData';

const db = {} as Firestore;
const never = () => new Promise<void>(() => undefined);

describe('local data on sign-out', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    });
    firestore.terminate.mockResolvedValue(undefined);
    firestore.clearIndexedDbPersistence.mockResolvedValue(undefined);
    cancelLocalDataClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('no pending writes (or all sent in time): settled', async () => {
    firestore.waitForPendingWrites.mockResolvedValue(undefined);
    await expect(pendingWritesSettle(db, 5000)).resolves.toBe(true);
  });

  it('writes that do not reach the server in time (offline): not settled, so the caller asks', async () => {
    firestore.waitForPendingWrites.mockImplementation(never);
    const result = pendingWritesSettle(db, 5000);
    await vi.advanceTimersByTimeAsync(5000);
    await expect(result).resolves.toBe(false);
  });

  it('an error while waiting counts as not settled - never as "safe to delete"', async () => {
    firestore.waitForPendingWrites.mockRejectedValue(new Error('terminated'));
    await expect(pendingWritesSettle(db, 5000)).resolves.toBe(false);
  });

  it('clearing stops Firestore first, then deletes, and drops the flag', async () => {
    await clearLocalData(db);
    expect(firestore.terminate).toHaveBeenCalledBefore(firestore.clearIndexedDbPersistence);
    expect(isClearRequested()).toBe(false);
  });

  it('a delete that does not finish (another tab holds the database) leaves the flag for the next load', async () => {
    firestore.clearIndexedDbPersistence.mockImplementation(never);
    const done = clearLocalData(db);
    await vi.advanceTimersByTimeAsync(4000);
    await done;
    expect(isClearRequested()).toBe(true);
  });

  it('a delete that fails leaves the flag too', async () => {
    firestore.clearIndexedDbPersistence.mockRejectedValue(new Error('failed-precondition'));
    await clearLocalData(db);
    expect(isClearRequested()).toBe(true);
  });

  it('on load: clears only when asked, and drops the flag after', async () => {
    clearLocalDataIfRequested(db);
    expect(firestore.clearIndexedDbPersistence).not.toHaveBeenCalled();

    requestLocalDataClear();
    clearLocalDataIfRequested(db);
    await vi.advanceTimersByTimeAsync(0);
    expect(firestore.clearIndexedDbPersistence).toHaveBeenCalledTimes(1);
    expect(isClearRequested()).toBe(false);
  });

  it('the tab that signs out knows it is the one (other tabs reload, this one waits for the delete)', () => {
    expect(isSigningOutHere()).toBe(false);
    requestLocalDataClear();
    expect(isSigningOutHere()).toBe(true);
    expect(isClearRequested()).toBe(true);
    cancelLocalDataClear();
    expect(isSigningOutHere()).toBe(false);
    expect(isClearRequested()).toBe(false);
  });
});
