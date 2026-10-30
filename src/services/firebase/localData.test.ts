/**
 * הנתונים המקומיים בהתנתקות: לא נמחקים כשיש כתיבות שלא הגיעו לשרת (הקורא
 * שואל את המשתמש), ומחיקה שלא הסתיימה נשארת לטעינה הבאה. מאז v1.36.0 גם
 * `draftJournal` והטקסט שנשמר בצד בחסימת גרסה: נספרים, ונמחקים יחד.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase/firestore';
import { dropEntry, getEntry, recordEntry, type JournalEntry } from '@/utils/draftJournal';
import { readStash, stashUnsaved } from '@/utils/unsavedStash';

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
  localChangesSettle,
  pendingWritesSettle,
  requestLocalDataClear,
} from './localData';

const db = {} as Firestore;
const never = () => new Promise<void>(() => undefined);

const journaled = (): JournalEntry => ({
  noteId: 'n1',
  saveId: 'A6',
  revision: 6,
  text: { title: 'קניות', content: 'חלב' },
  templateType: 'plain',
  base: null,
  meta: { categoryId: 'c1', tags: [], color: null, isSensitive: false, isReadOnly: false },
  clientVersion: '1.36.0',
  tabId: 't',
  at: 0,
});

let store: Map<string, string>;

describe('local data on sign-out', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      get length() {
        return store.size;
      },
      key: (index: number) => [...store.keys()][index] ?? null,
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

  describe('everything kept outside Firestore (v1.36.0)', () => {
    it('nothing pending anywhere: safe to delete', async () => {
      firestore.waitForPendingWrites.mockResolvedValue(undefined);
      await expect(localChangesSettle(db, 'u1')).resolves.toBe(true);
    });

    it('a journal record that empties in time (the save was confirmed): safe to delete', async () => {
      firestore.waitForPendingWrites.mockResolvedValue(undefined);
      recordEntry('u1', journaled());
      const result = localChangesSettle(db, 'u1');
      await vi.advanceTimersByTimeAsync(400);
      dropEntry('u1', 'n1', 'A6');
      await vi.advanceTimersByTimeAsync(400);
      await expect(result).resolves.toBe(true);
    });

    it('a journal record that stays (offline, or a copy not made yet): not settled - the user is asked', async () => {
      firestore.waitForPendingWrites.mockResolvedValue(undefined);
      recordEntry('u1', journaled());
      const result = localChangesSettle(db, 'u1');
      await vi.advanceTimersByTimeAsync(5000);
      await expect(result).resolves.toBe(false);
    });

    it('text kept aside by a blocked version (minClientVersion): not settled', async () => {
      firestore.waitForPendingWrites.mockResolvedValue(undefined);
      stashUnsaved([{ noteId: 'n1', title: 'קניות', content: 'חלב' }]);
      await expect(localChangesSettle(db, 'u1')).resolves.toBe(false);
    });

    it('another user’s journal on this browser does not hold this sign-out', async () => {
      firestore.waitForPendingWrites.mockResolvedValue(undefined);
      recordEntry('someone-else', journaled());
      await expect(localChangesSettle(db, 'u1')).resolves.toBe(true);
    });

    it('clearing on sign-out removes the journal and the kept-aside text', async () => {
      recordEntry('u1', journaled());
      stashUnsaved([{ noteId: 'n1', title: 'קניות', content: 'חלב' }]);
      await clearLocalData(db);
      expect(getEntry('u1', 'n1')).toBeNull();
      expect(readStash()).toEqual([]);
    });

    it('a clear left for the next load removes them too, before Firestore starts', () => {
      recordEntry('u1', journaled());
      stashUnsaved([{ noteId: 'n1', title: 'קניות', content: 'חלב' }]);
      requestLocalDataClear();
      clearLocalDataIfRequested(db);
      expect(getEntry('u1', 'n1')).toBeNull();
      expect(readStash()).toEqual([]);
    });

    it('keeping the data (the user chose to) touches neither', () => {
      recordEntry('u1', journaled());
      stashUnsaved([{ noteId: 'n1', title: 'קניות', content: 'חלב' }]);
      clearLocalDataIfRequested(db);
      expect(getEntry('u1', 'n1')).not.toBeNull();
      expect(readStash()).toHaveLength(1);
    });
  });
});
