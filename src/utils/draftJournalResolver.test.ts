/**
 * הריצה של `draftJournal` מול "שרת" מזויף: הפער שנשאר פתוח ב-PR #21 -
 * שמירה מסשן קודם שנדחית כשהפתק לא פתוח - ומה שקורה סביבו (לשוניות,
 * עורך פתוח, חסימת גרסה, עותק אחד בלבד).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getEntry,
  listEntries,
  onJournalChange,
  recordEntry,
  setJournalStorage,
  type JournalEntry,
  type JournalStorage,
  type ServerView,
} from './draftJournal';
import { createJournalResolver, type ResolverDeps } from './draftJournalResolver';

const UID = 'u1';

const mapStorage = (store = new Map<string, string>()): JournalStorage => ({
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => {
    store.set(key, value);
  },
  removeItem: (key) => {
    store.delete(key);
  },
  keys: () => [...store.keys()],
});

const entry = (overrides: Partial<JournalEntry> = {}): JournalEntry => ({
  noteId: 'n1',
  saveId: 'A6',
  revision: 6,
  text: { title: 'קניות', content: 'חלב וביצים' },
  templateType: 'plain',
  base: { title: 'קניות', content: 'חלב', revision: 5 },
  meta: { categoryId: 'c1', tags: ['בית'], color: null, isSensitive: true, isReadOnly: false },
  clientVersion: '1.36.0',
  tabId: 'yesterday',
  at: 0,
  ...overrides,
});

const view = (overrides: Partial<Extract<ServerView, { kind: 'snapshot' }>> = {}): ServerView => ({
  kind: 'snapshot',
  exists: true,
  fromCache: false,
  pending: false,
  title: 'קניות',
  content: 'חלב',
  templateType: 'plain',
  revision: 5,
  saveId: 'S5',
  ...overrides,
});

/** שרת מזויף: מאזינים לפי פתק, עותקים שנוצרו, ושמירות שנשלחו */
const fakeServer = () => {
  const listeners = new Map<string, (view: ServerView) => void>();
  const copies = new Map<string, JournalEntry>();
  const saves: Array<{ noteId: string; content: string; chain: { revision: number; saveId: string; baseSaveId: string | null } }> = [];
  const reports: string[] = [];
  let editorOpen = false;
  let blocked = false;
  let online = true;
  let nextSaveId = 0;
  let clock = 1_000_000;
  const timers: Array<() => void> = [];

  const deps = (overrides: Partial<ResolverDeps> = {}): ResolverDeps => ({
    uid: UID,
    tabId: 'tab-me',
    clientVersion: '1.36.0',
    now: () => clock,
    newSaveId: () => `M${++nextSaveId}`,
    subscribe: (noteId, onView) => {
      listeners.set(noteId, onView);
      return () => listeners.delete(noteId);
    },
    isEditorOpen: () => editorOpen,
    writesBlocked: () => blocked,
    copyExists: async (copyId) => {
      if (!online) throw new Error('offline');
      return copies.has(copyId);
    },
    createCopy: async (copyId, journaled) => {
      if (!online) throw new Error('offline');
      copies.set(copyId, journaled);
    },
    saveText: async (noteId, text, chain) => {
      saves.push({ noteId, content: text.content, chain });
    },
    report: (why) => reports.push(why.reason),
    setTimer: (callback) => timers.push(callback),
    onError: () => undefined,
    ...overrides,
  });

  return {
    deps,
    copies,
    saves,
    reports,
    timers,
    emit: (noteId: string, next: ServerView) => listeners.get(noteId)?.(next),
    listening: () => [...listeners.keys()],
    setEditorOpen: (open: boolean) => (editorOpen = open),
    setBlocked: (value: boolean) => (blocked = value),
    setOnline: (value: boolean) => (online = value),
    advance: (ms: number) => (clock += ms),
  };
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('draftJournal resolver', () => {
  beforeEach(() => setJournalStorage(mapStorage()));
  afterEach(() => setJournalStorage(null));

  it('THE GAP FROM PR #21: an offline save from a previous session, rejected while its note is not open, becomes a copy', async () => {
    // הסשן הקודם: שמירה יצאה offline ונרשמה. האפליקציה נסגרה
    recordEntry(UID, entry());
    // הסשן הזה: ה-cache מציג את הכתיבה הממתינה; אחר כך השרת דוחה (טלפון כתב קודם)
    const server = fakeServer();
    const resolver = createJournalResolver(server.deps());
    const stop = onJournalChange(resolver.sync);
    resolver.sync();
    expect(server.listening()).toEqual(['n1']);
    server.emit('n1', view({ fromCache: true, pending: true, content: 'חלב וביצים' }));
    server.emit('n1', view({ pending: true, content: 'חלב וביצים' }));
    expect(server.copies.size).toBe(0);
    server.emit('n1', view({ content: 'חלב סויה', revision: 6, saveId: 'P6' }));
    await settle();

    expect([...server.copies.keys()]).toEqual(['recovery-A6']);
    const copy = server.copies.get('recovery-A6');
    expect(copy?.text).toEqual({ title: 'קניות', content: 'חלב וביצים' });
    expect(copy?.meta).toMatchObject({ categoryId: 'c1', isSensitive: true });
    expect(server.reports).toEqual(['text']);
    expect(listEntries(UID)).toEqual([]);
    // הרשומה נמחקה → מפסיקים להאזין לפתק
    expect(server.listening()).toEqual([]);
    stop();
    resolver.stop();
  });

  it('the same save landed: the record is dropped, nothing is copied or written', async () => {
    recordEntry(UID, entry());
    const server = fakeServer();
    const resolver = createJournalResolver(server.deps());
    const stop = onJournalChange(resolver.sync);
    resolver.sync();
    server.emit('n1', view({ content: 'חלב וביצים', revision: 6, saveId: 'A6' }));
    await settle();
    expect(listEntries(UID)).toEqual([]);
    expect(server.copies.size + server.saves.length).toBe(0);
    stop();
    resolver.stop();
  });

  it('rejected but mergeable: writes the merge on top of the server version, chained to it, and records it first', async () => {
    recordEntry(UID, entry());
    const server = fakeServer();
    const resolver = createJournalResolver(server.deps());
    const stop = onJournalChange(resolver.sync);
    resolver.sync();
    server.emit('n1', view({ title: 'קניות לשבת', revision: 6, saveId: 'P6' }));
    await settle();
    expect(server.saves).toEqual([
      { noteId: 'n1', content: 'חלב וביצים', chain: { revision: 7, saveId: 'M1', baseSaveId: 'P6' } },
    ]);
    // הכתיבה אושרה (ה-promise) → הרשומה של המיזוג נמחקה
    expect(listEntries(UID)).toEqual([]);
    expect(server.copies.size).toBe(0);
    stop();
    resolver.stop();
  });

  it('a merge that is itself rejected is decided again against the newer version - not looped, not lost', async () => {
    recordEntry(UID, entry());
    const server = fakeServer();
    const resolver = createJournalResolver(
      server.deps({ saveText: () => new Promise<void>(() => undefined) }) // לא מאושר מיד
    );
    const stop = onJournalChange(resolver.sync);
    resolver.sync();
    server.emit('n1', view({ title: 'קניות לשבת', revision: 6, saveId: 'P6' }));
    expect(getEntry(UID, 'n1')).toMatchObject({ saveId: 'M1', base: { title: 'קניות לשבת', content: 'חלב', revision: 6 } });
    // בלי snapshot חדש - לא מכריעים שוב (המצב שראינו הוא מלפני המיזוג)
    resolver.recheck('n1');
    expect(getEntry(UID, 'n1')?.saveId).toBe('M1');
    // מכשיר אחר כתב שוב, והמיזוג נדחה: הטקסט שונה בשני הצדדים → עותק
    server.emit('n1', view({ title: 'קניות לשבת', content: 'חלב שקדים', revision: 7, saveId: 'P7' }));
    await settle();
    expect([...server.copies.keys()]).toEqual(['recovery-M1']);
    expect(server.copies.get('recovery-M1')?.text.content).toBe('חלב וביצים');
    stop();
    resolver.stop();
  });

  it('only one copy, even when two tabs (or two launches) reach the same conclusion', async () => {
    const shared = mapStorage();
    setJournalStorage(shared);
    recordEntry(UID, entry());
    const server = fakeServer();
    const first = createJournalResolver(server.deps({ tabId: 'tab-1' }));
    first.sync();
    server.emit('n1', view({ content: 'חלב סויה', revision: 6, saveId: 'P6' }));
    await settle();
    // לשונית שנייה עם אותה רשומה (נקראה לפני שהראשונה מחקה)
    recordEntry(UID, entry());
    const second = createJournalResolver(server.deps({ tabId: 'tab-2' }));
    second.sync();
    server.emit('n1', view({ content: 'חלב סויה', revision: 6, saveId: 'P6' }));
    await settle();
    expect(server.copies.size).toBe(1);
    expect(server.reports).toHaveLength(1);
    first.stop();
    second.stop();
  });

  it('two queued saves of the same note, both rejected: one record, so one copy - with the later text', async () => {
    const server = fakeServer();
    recordEntry(UID, entry({ saveId: 'A6', text: { title: 'קניות', content: 'חלב וביצים' } }));
    recordEntry(UID, entry({ saveId: 'A7', revision: 7, text: { title: 'קניות', content: 'חלב, ביצים ולחם' } }));
    const resolver = createJournalResolver(server.deps());
    resolver.sync();
    server.emit('n1', view({ content: 'חלב סויה', revision: 6, saveId: 'P6' }));
    await settle();
    expect([...server.copies.keys()]).toEqual(['recovery-A7']);
    expect(server.copies.get('recovery-A7')?.text.content).toBe('חלב, ביצים ולחם');
    resolver.stop();
  });

  it('offline: the copy waits (the record stays), and is made when the connection is back', async () => {
    recordEntry(UID, entry());
    const server = fakeServer();
    server.setOnline(false);
    const resolver = createJournalResolver(server.deps());
    resolver.sync();
    server.emit('n1', view({ content: 'חלב סויה', revision: 6, saveId: 'P6' }));
    await settle();
    expect(getEntry(UID, 'n1')).not.toBeNull();
    server.setOnline(true);
    server.emit('n1', view({ content: 'חלב סויה', revision: 6, saveId: 'P6' }));
    await settle();
    expect(server.copies.size).toBe(1);
    expect(getEntry(UID, 'n1')).toBeNull();
    resolver.stop();
  });

  it('the editor is open: nothing happens (it shows the choice); after it closes without a decision - a copy', async () => {
    recordEntry(UID, entry());
    const server = fakeServer();
    server.setEditorOpen(true);
    const resolver = createJournalResolver(server.deps());
    resolver.sync();
    server.emit('n1', view({ content: 'חלב סויה', revision: 6, saveId: 'P6' }));
    await settle();
    expect(server.copies.size).toBe(0);
    server.setEditorOpen(false);
    resolver.recheck('n1');
    await settle();
    expect(server.copies.size).toBe(1);
    resolver.stop();
  });

  it('a save made as the editor closes is not mistaken for rejected by the snapshot from before it', async () => {
    const server = fakeServer();
    const resolver = createJournalResolver(server.deps());
    const stop = onJournalChange(resolver.sync);
    // A6 נדחתה בזמן שהעורך פתוח (מכשיר אחר כתב P6): ה-journal מחכה לעורך
    recordEntry(UID, entry({ saveId: 'A6', tabId: 'tab-me' }));
    server.setEditorOpen(true);
    server.emit('n1', view({ title: 'קניות לשבת', revision: 6, saveId: 'P6' }));
    // העורך מיזג ושמר A7 על P6 - בסגירה, ונסגר לפני שה-snapshot של A7 הגיע
    const merged = { title: 'קניות לשבת', content: 'חלב וביצים' };
    recordEntry(UID, entry({ saveId: 'A7', revision: 7, text: merged, base: { title: 'קניות לשבת', content: 'חלב', revision: 6 }, tabId: 'tab-me' }));
    server.setEditorOpen(false);
    resolver.recheck('n1');
    await settle();
    // P6 הוא מלפני A7: אסור להכריע לפיו (היה כותב את המיזוג פעם שנייה)
    expect(server.copies.size + server.saves.length).toBe(0);
    expect(getEntry(UID, 'n1')?.saveId).toBe('A7');
    server.emit('n1', view({ ...merged, pending: true, revision: 7 }));
    server.emit('n1', view({ ...merged, revision: 7, saveId: 'A7' }));
    expect(getEntry(UID, 'n1')).toBeNull();
    stop();
    resolver.stop();
  });

  it('a fresh record of another open tab: waits, then decides on the retry', async () => {
    const server = fakeServer();
    recordEntry(UID, entry({ tabId: 'other-tab', at: 1_000_000 }));
    const resolver = createJournalResolver(server.deps());
    resolver.sync();
    server.emit('n1', view({ content: 'חלב סויה', revision: 6, saveId: 'P6' }));
    await settle();
    expect(server.copies.size).toBe(0);
    expect(server.timers).toHaveLength(1);
    server.advance(10_000);
    server.timers[0]();
    await settle();
    expect(server.copies.size).toBe(1);
    resolver.stop();
  });

  it('a blocked version (minClientVersion) does not write; the record waits for the new version', async () => {
    recordEntry(UID, entry());
    const server = fakeServer();
    server.setBlocked(true);
    const resolver = createJournalResolver(server.deps());
    resolver.sync();
    server.emit('n1', view({ content: 'חלב סויה', revision: 6, saveId: 'P6' }));
    await settle();
    expect(server.copies.size + server.saves.length).toBe(0);
    expect(getEntry(UID, 'n1')).not.toBeNull();
    resolver.stop();
  });

  it('access to a shared note was removed: the text goes to a copy of our own', async () => {
    recordEntry(UID, entry());
    const server = fakeServer();
    const resolver = createJournalResolver(server.deps());
    resolver.sync();
    server.emit('n1', { kind: 'unreadable' });
    await settle();
    expect(server.copies.size).toBe(1);
    expect(server.reports).toEqual([]);
    resolver.stop();
  });

  it('another user’s records on the same browser are not touched', async () => {
    recordEntry('someone-else', entry());
    const server = fakeServer();
    const resolver = createJournalResolver(server.deps());
    resolver.sync();
    expect(server.listening()).toEqual([]);
    expect(listEntries('someone-else')).toHaveLength(1);
    resolver.stop();
  });

  it('after stop: no more decisions', async () => {
    recordEntry(UID, entry());
    const server = fakeServer();
    const createCopy = vi.fn(async () => undefined);
    const resolver = createJournalResolver(server.deps({ createCopy }));
    resolver.sync();
    resolver.stop();
    server.emit('n1', view({ content: 'חלב סויה', revision: 6, saveId: 'P6' }));
    await settle();
    expect(createCopy).not.toHaveBeenCalled();
  });
});
