/**
 * `draftJournal` (צעד 5 בסבב 2): הרשומות, וההכרעה מה לעשות עם שמירה שלא
 * אושרה. הכלל שנבדק לאורך כל הקובץ: לעולם לא נמחק טקסט - רק מאושר,
 * ממוזג או מועתק.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  baseForNextEntry,
  clearAllEntries,
  dropEntry,
  FOREIGN_ENTRY_GRACE_MS,
  getEntry,
  listEntries,
  onJournalChange,
  recordEntry,
  recoveryCopyId,
  resolveEntry,
  setJournalStorage,
  type JournalEntry,
  type JournalStorage,
  type ResolveContext,
  type ServerView,
} from './draftJournal';

const mapStorage = (store = new Map<string, string>()): JournalStorage & { store: Map<string, string> } => ({
  store,
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => {
    store.set(key, value);
  },
  removeItem: (key) => {
    store.delete(key);
  },
  keys: () => [...store.keys()],
});

const list = (items: Array<[string, string, boolean?]>) =>
  JSON.stringify(items.map(([id, text, completed = false]) => ({ id, text, completed })));

const entry = (overrides: Partial<JournalEntry> = {}): JournalEntry => ({
  noteId: 'n1',
  saveId: 'A6',
  revision: 6,
  text: { title: 'קניות', content: 'חלב וביצים' },
  templateType: 'plain',
  base: { title: 'קניות', content: 'חלב', revision: 5 },
  meta: { categoryId: 'c1', tags: [], color: null, isSensitive: false, isReadOnly: false },
  clientVersion: '1.36.0',
  tabId: 'tab-me',
  at: 1_000,
  ...overrides,
});

const server = (overrides: Partial<Extract<ServerView, { kind: 'snapshot' }>> = {}): ServerView => ({
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

const context = (overrides: Partial<ResolveContext> = {}): ResolveContext => ({
  now: 2_000,
  tabId: 'tab-me',
  clientVersion: '1.36.0',
  editorOpen: false,
  writesBlocked: false,
  ...overrides,
});

describe('journal records', () => {
  let storage: ReturnType<typeof mapStorage>;
  beforeEach(() => {
    storage = mapStorage();
    setJournalStorage(storage);
  });
  afterEach(() => setJournalStorage(null));

  it('one record per note and user; a newer save replaces the older one', () => {
    recordEntry('u1', entry({ saveId: 'A6' }));
    recordEntry('u1', entry({ saveId: 'A7', revision: 7 }));
    recordEntry('u1', entry({ noteId: 'n2' }));
    recordEntry('u2', entry());
    expect(listEntries('u1').map((e) => [e.noteId, e.saveId]).sort()).toEqual([
      ['n1', 'A7'],
      ['n2', 'A6'],
    ]);
    expect(listEntries('u2')).toHaveLength(1);
  });

  it('dropping by saveId leaves a newer save alone', () => {
    recordEntry('u1', entry({ saveId: 'A7' }));
    dropEntry('u1', 'n1', 'A6');
    expect(getEntry('u1', 'n1')?.saveId).toBe('A7');
    dropEntry('u1', 'n1', 'A7');
    expect(getEntry('u1', 'n1')).toBeNull();
  });

  it('dropping without saveId (the user decided in the editor) drops whatever is there', () => {
    recordEntry('u1', entry({ saveId: 'A9' }));
    dropEntry('u1', 'n1');
    expect(getEntry('u1', 'n1')).toBeNull();
  });

  it('clearing (sign-out) removes every user’s records and nothing else', () => {
    storage.store.set('notes4me.theme', 'dark');
    recordEntry('u1', entry());
    recordEntry('u2', entry());
    clearAllEntries();
    expect([...storage.store.keys()]).toEqual(['notes4me.theme']);
  });

  it('a full or broken storage keeps the record in memory for this session', () => {
    setJournalStorage({
      ...mapStorage(),
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    recordEntry('u1', entry());
    expect(getEntry('u1', 'n1')?.saveId).toBe('A6');
    expect(listEntries('u1')).toHaveLength(1);
  });

  it('a corrupt record is ignored, not thrown', () => {
    storage.store.set('notes4me.draftJournal.u1.n1', '{not json');
    expect(getEntry('u1', 'n1')).toBeNull();
    expect(listEntries('u1')).toEqual([]);
  });

  it('changes are announced, so the resolver can follow them', () => {
    let calls = 0;
    const stop = onJournalChange(() => calls++);
    recordEntry('u1', entry());
    dropEntry('u1', 'n1', 'A6');
    stop();
    recordEntry('u1', entry());
    expect(calls).toBe(2);
  });
});

describe('the base of a new record', () => {
  const editorBase = { title: 'קניות', content: 'חלב', revision: 5 };

  it('an editor on a confirmed version: that version', () => {
    expect(baseForNextEntry(null, editorBase, false)).toEqual(editorBase);
  });

  it('an editor opened on a pending write: the base the previous record knew', () => {
    const previous = entry({ base: { title: 'קניות', content: 'ריק', revision: 4 } });
    expect(baseForNextEntry(previous, editorBase, true)).toEqual({ title: 'קניות', content: 'ריק', revision: 4 });
  });

  it('an editor opened on a pending write with no record: unknown - copy only, never merge', () => {
    expect(baseForNextEntry(null, editorBase, true)).toBeNull();
  });
});

describe('resolveEntry', () => {
  it('the server holds our saveId: confirmed', () => {
    expect(resolveEntry(entry(), server({ content: 'חלב וביצים', revision: 6, saveId: 'A6' }), context())).toEqual({
      kind: 'confirmed',
    });
  });

  it('confirmed even with the editor open, another tab or a blocked version - confirming never loses anything', () => {
    const landed = server({ content: 'חלב וביצים', revision: 6, saveId: 'A6' });
    expect(resolveEntry(entry({ tabId: 'other', at: 1_999 }), landed, context({ editorOpen: true, writesBlocked: true })).kind).toBe(
      'confirmed'
    );
  });

  it('from the cache, or with the write still queued: wait', () => {
    expect(resolveEntry(entry(), server({ fromCache: true }), context()).kind).toBe('wait');
    expect(resolveEntry(entry(), server({ pending: true, content: 'חלב וביצים' }), context()).kind).toBe('wait');
  });

  it('rejected, plain text edited on both sides: a copy, with the reason for measurement', () => {
    expect(resolveEntry(entry(), server({ content: 'חלב סויה', revision: 6, saveId: 'B6' }), context())).toEqual({
      kind: 'copy',
      why: { reason: 'text', fields: [] },
    });
  });

  it('rejected, but only our side changed the text (another device changed something else): merged', () => {
    const resolution = resolveEntry(entry(), server({ title: 'קניות לשבת', revision: 6, saveId: 'B6' }), context());
    expect(resolution).toEqual({ kind: 'merge', text: { title: 'קניות לשבת', content: 'חלב וביצים' } });
  });

  it('rejected checklist, different items changed: merged, both changes kept', () => {
    const base = list([['a', 'חלב'], ['b', 'לחם']]);
    const resolution = resolveEntry(
      entry({
        templateType: 'checklist',
        base: { title: 'קניות', content: base, revision: 5 },
        text: { title: 'קניות', content: list([['a', 'חלב', true], ['b', 'לחם']]) },
      }),
      server({ templateType: 'checklist', content: list([['a', 'חלב'], ['b', 'לחם מלא']]), revision: 6, saveId: 'B6' }),
      context()
    );
    expect(resolution).toEqual({
      kind: 'merge',
      text: { title: 'קניות', content: list([['a', 'חלב', true], ['b', 'לחם מלא']]) },
    });
  });

  it('rejected checklist, the same field changed differently: a copy', () => {
    const resolution = resolveEntry(
      entry({
        templateType: 'checklist',
        base: { title: 'קניות', content: list([['a', 'חלב']]), revision: 5 },
        text: { title: 'קניות', content: list([['a', 'חלב סויה']]) },
      }),
      server({ templateType: 'checklist', content: list([['a', 'חלב שקדים']]), revision: 6, saveId: 'B6' }),
      context()
    );
    expect(resolution.kind).toBe('copy');
  });

  it('rejected, but the server already has the same text: nothing to save', () => {
    expect(resolveEntry(entry(), server({ content: 'חלב וביצים', revision: 7, saveId: 'B7' }), context()).kind).toBe('kept');
  });

  it('rejected, and merging gives exactly what the server has: nothing to save', () => {
    // הצד שלנו הוסיף "ביצים"; בשרת כבר יש "ביצים" וגם שינוי כותרת
    const resolution = resolveEntry(
      entry({ templateType: 'checklist', base: { title: 'א', content: list([['a', 'חלב']]), revision: 5 }, text: { title: 'א', content: list([['a', 'חלב', true]]) } }),
      server({ templateType: 'checklist', title: 'ב', content: list([['a', 'חלב', true]]), revision: 6, saveId: 'B6' }),
      context()
    );
    expect(resolution.kind).toBe('kept');
  });

  it('no known base (opened on a pending write, no earlier record): a copy, never a merge', () => {
    expect(resolveEntry(entry({ base: null }), server({ title: 'קניות לשבת', revision: 6, saveId: 'B6' }), context())).toEqual({
      kind: 'copy',
      why: { reason: 'unconfirmed', fields: [] },
    });
  });

  it('written by another app version: a copy, never a merge into the note', () => {
    expect(
      resolveEntry(entry({ clientVersion: '1.35.0' }), server({ title: 'קניות לשבת', revision: 6, saveId: 'B6' }), context())
    ).toEqual({ kind: 'copy', why: null });
  });

  it('the template changed on one side: a copy', () => {
    expect(
      resolveEntry(entry(), server({ templateType: 'checklist', content: '[]', revision: 6, saveId: 'B6' }), context()).kind
    ).toBe('copy');
  });

  it('the note was deleted, or we lost access to it: a copy', () => {
    expect(resolveEntry(entry(), server({ exists: false }), context())).toEqual({ kind: 'copy', why: null });
    expect(resolveEntry(entry(), { kind: 'unreadable' }, context())).toEqual({ kind: 'copy', why: null });
  });

  it('the editor is open here: wait - it shows the choice itself', () => {
    expect(resolveEntry(entry(), server({ content: 'חלב סויה', revision: 6, saveId: 'B6' }), context({ editorOpen: true })).kind).toBe(
      'wait'
    );
  });

  it('the version is blocked (minClientVersion): wait for the new version, do not write', () => {
    expect(
      resolveEntry(entry(), server({ content: 'חלב סויה', revision: 6, saveId: 'B6' }), context({ writesBlocked: true })).kind
    ).toBe('wait');
  });

  it('a fresh record of another tab: wait until its write had time to show up here, then decide', () => {
    const rejected = server({ content: 'חלב סויה', revision: 6, saveId: 'B6' });
    const foreign = entry({ tabId: 'other', at: 1_000 });
    expect(resolveEntry(foreign, rejected, context({ now: 1_000 + 3_000 }))).toEqual({
      kind: 'wait',
      retryInMs: FOREIGN_ENTRY_GRACE_MS - 3_000,
    });
    expect(resolveEntry(foreign, rejected, context({ now: 1_000 + FOREIGN_ENTRY_GRACE_MS })).kind).toBe('copy');
  });

  it('a record from a previous session (another tab id, long ago): decided at once', () => {
    expect(
      resolveEntry(entry({ tabId: 'yesterday', at: 0 }), server({ content: 'חלב סויה', revision: 6, saveId: 'B6' }), context({ now: 86_400_000 })).kind
    ).toBe('copy');
  });

  it('the copy id is fixed per save, so it is created once', () => {
    expect(recoveryCopyId(entry())).toBe('recovery-A6');
    expect(recoveryCopyId(entry())).toBe(recoveryCopyId(entry({ tabId: 'other' })));
  });
});
