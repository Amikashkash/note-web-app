/**
 * `draftJournal` (צעד 5 בסבב 2): שמירה שיצאה מהעורך ועוד לא אושרה, רשומה
 * במכשיר - כדי שאם השרת ידחה אותה, הטקסט לא ייעלם בשקט.
 *
 * הבעיה: עם persistence (v1.35.0) כתיבה ממתינה שורדת סגירה של האפליקציה,
 * ונשלחת בהפעלה הבאה. אם מכשיר אחר כתב בינתיים, ה-rules דוחים אותה, וה-cache
 * חוזר לגרסת השרת. ה-promise של הכתיבה היה בסשן הקודם - אין מי שיתפוס את
 * הדחייה. כשהפתק פתוח, העורך מזהה את זה (`unconfirmedBase`); כשהוא סגור - לא.
 *
 * הרשומה: לכל פתק, השמירה האחרונה שיצאה (`saveId`, הטקסט) והבסיס שלה - הגרסה
 * המאושרת שהיא נשענת עליה. נכתבת **לפני** הכתיבה ל-Firestore, באותו tick.
 *
 * ההכרעה (`resolveEntry`), כשמגיע מהשרת (לא מה-cache) snapshot בלי כתיבות ממתינות:
 * - ה-`saveId` בשרת הוא שלנו → הגיעה. מוחקים את הרשומה.
 * - השרת כבר מחזיק את אותו טקסט → אין מה להציל.
 * - אחרת היא נדחתה (או לא נשלחה בכלל). אם אפשר למזג בבטחה מול הבסיס
 *   (`mergeNote`, אותו מיזוג של העורך) → כותבים את המיזוג. אם לא → עותק
 *   בפתק חדש, "טקסט שלא נשמר" (מזהה קבוע לכל שמירה, כך שיש רק עותק אחד
 *   גם כשכמה לשוניות או הפעלות מגיעות לאותה מסקנה).
 *
 * **הכלל: ה-journal לעולם לא מוחק טקסט של המשתמש, רק ממזג או מעתיק.**
 *
 * למה localStorage ולא IndexedDB (כמו שכתוב בתכנית): הכתיבה סינכרונית, כך
 * שהרשומה קיימת לפני שהכתיבה ל-Firestore נכנסת לתור - גם אם הדף נהרג מיד
 * אחרי. מפתח לכל פתק, כדי שלשוניות לא ידרסו זו לזו רשומות של פתקים אחרים.
 * נמחק בהתנתקות יחד עם שאר הנתונים המקומיים (`services/firebase/localData.ts`).
 */

import { mergeNote, type MergeConflict, type NoteText } from './noteMerge';
import type { Note } from '@/types/note';

const KEY_PREFIX = 'notes4me.draftJournal.';

/** רשומה של לשונית אחרת: לא נוגעים בה מיד - הכתיבה שלה אולי עוד לא הגיעה לכאן */
export const FOREIGN_ENTRY_GRACE_MS = 10_000;

/** מזהה של הלשונית הזו, כדי להבחין ברשומות שלה */
export const TAB_ID: string =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `tab-${Date.now()}-${Math.random()}`;

export type RecoveryMeta = Pick<Note, 'categoryId' | 'tags' | 'color' | 'isSensitive' | 'isReadOnly'>;

export interface JournalEntry {
  noteId: string;
  /** השמירה האחרונה שיצאה לפתק הזה */
  saveId: string;
  revision: number;
  text: NoteText;
  templateType: Note['templateType'];
  /** הגרסה המאושרת שהטקסט נשען עליה. `null` - לא ידוע, ואז רק עותק, לא מיזוג */
  base: (NoteText & { revision: number }) | null;
  /** לעותק, אם יידרש: מאותה קטגוריה, רגיש ומוגן כמו המקור */
  meta: RecoveryMeta;
  clientVersion: string;
  tabId: string;
  at: number;
}

export interface JournalStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  keys: () => string[];
}

const browserStorage: JournalStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
  keys: () => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }
    return keys;
  },
};

let storage: JournalStorage = browserStorage;

/** לבדיקות */
export const setJournalStorage = (next: JournalStorage | null): void => {
  storage = next ?? browserStorage;
  memory.clear();
};

/**
 * כשה-storage לא זמין או מלא: הרשומה נשמרת בזיכרון. מגן בתוך הסשן, לא
 * אחרי סגירה - ולכן **לא בשקט** (v1.36.1): `entriesOnlyInMemory` מחזיר
 * אותן, ו-`DeviceStorageWarning` מציג אותן למשתמש עם העתקה, עד שהשרת מאשר.
 */
const memory = new Map<string, string>();

const keyFor = (uid: string, noteId: string) => `${KEY_PREFIX}${uid}.${noteId}`;

const listeners = new Set<() => void>();

/** שינוי ברשומות בלשונית הזו (לשוניות אחרות: אירוע `storage`) */
export const onJournalChange = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const changed = () => listeners.forEach((listener) => listener());

export const isJournalKey = (key: string | null): boolean => key?.startsWith(KEY_PREFIX) ?? false;

const parse = (raw: string | null): JournalEntry | null => {
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as JournalEntry;
    return typeof entry?.noteId === 'string' && typeof entry.saveId === 'string' ? entry : null;
  } catch {
    return null;
  }
};

const read = (key: string): JournalEntry | null => {
  if (memory.has(key)) return parse(memory.get(key) ?? null);
  try {
    return parse(storage.getItem(key));
  } catch {
    return null;
  }
};

export const getEntry = (uid: string, noteId: string): JournalEntry | null => read(keyFor(uid, noteId));

export const listEntries = (uid: string): JournalEntry[] => {
  const prefix = `${KEY_PREFIX}${uid}.`;
  let keys: string[] = [];
  try {
    keys = storage.keys().filter((key) => key.startsWith(prefix));
  } catch {
    // אין storage: רק מה שבזיכרון
  }
  const all = new Set([...keys, ...[...memory.keys()].filter((key) => key.startsWith(prefix))]);
  return [...all].map(read).filter((entry): entry is JournalEntry => entry !== null);
};

/** `true` - נשמרה במכשיר. `false` - רק בזיכרון (storage מלא או לא זמין) */
export const recordEntry = (uid: string, entry: JournalEntry): boolean => {
  const key = keyFor(uid, entry.noteId);
  const raw = JSON.stringify(entry);
  let stored = true;
  try {
    storage.setItem(key, raw);
    memory.delete(key);
  } catch {
    memory.set(key, raw);
    stored = false;
  }
  changed();
  return stored;
};

/**
 * רשומות שלא נשמרו במכשיר: אם האפליקציה תיסגר לפני שהשרת יאשר אותן, אין
 * להן גיבוי. נעלמות מכאן כשהשרת מאשר (או כשהרשומה הבאה כן נשמרה).
 */
export const entriesOnlyInMemory = (uid: string): JournalEntry[] => {
  const prefix = `${KEY_PREFIX}${uid}.`;
  return [...memory.entries()]
    .filter(([key]) => key.startsWith(prefix))
    .map(([, raw]) => parse(raw))
    .filter((entry): entry is JournalEntry => entry !== null);
};

/**
 * מוחק את הרשומה - רק אם היא עדיין של השמירה הזו. אם בינתיים יצאה שמירה
 * חדשה יותר לאותו פתק, היא נשארת.
 */
export const dropEntry = (uid: string, noteId: string, saveId?: string): void => {
  const key = keyFor(uid, noteId);
  const current = read(key);
  if (!current || (saveId !== undefined && current.saveId !== saveId)) return;
  memory.delete(key);
  try {
    storage.removeItem(key);
  } catch {
    // אין storage: נמחק מהזיכרון
  }
  changed();
};

/** בהתנתקות שמוחקת את הנתונים המקומיים: כל הרשומות, של כל המשתמשים */
export const clearAllEntries = (): void => {
  memory.clear();
  try {
    storage.keys().filter(isJournalKey).forEach((key) => storage.removeItem(key));
  } catch {
    // אין storage: אין מה למחוק
  }
  changed();
};

/**
 * הבסיס לרשומה של שמירה חדשה מהעורך. עורך שנפתח על כתיבה ממתינה
 * (`unconfirmedBase`) לא יודע מה הבסיס האמיתי - אבל רשומה קודמת לאותו פתק
 * (מהסשן הקודם, או מלשונית אחרת) יודעת.
 */
export const baseForNextEntry = (
  previous: JournalEntry | null,
  editorBase: NoteText & { revision: number },
  unconfirmedBase: boolean
): JournalEntry['base'] => {
  if (!unconfirmedBase) return { title: editorBase.title, content: editorBase.content, revision: editorBase.revision };
  return previous?.base ?? null;
};

/** מה שהשרת מחזיק כרגע, כפי שהמאזין ראה */
export type ServerView =
  | {
      kind: 'snapshot';
      exists: boolean;
      fromCache: boolean;
      pending: boolean;
      title: string;
      content: string;
      templateType: string;
      revision: number;
      saveId: string | null;
    }
  /** אין הרשאה לקרוא (למשל השיתוף הוסר) */
  | { kind: 'unreadable' };

export type Resolution =
  | { kind: 'wait'; retryInMs?: number }
  /** השמירה הגיעה */
  | { kind: 'confirmed' }
  /** לא הגיעה, אבל השרת כבר מחזיק את אותו טקסט */
  | { kind: 'kept' }
  /** נדחתה, ואפשר למזג: לכתוב את `text` מעל הגרסה שבשרת */
  | { kind: 'merge'; text: NoteText }
  /** נדחתה, ואי אפשר למזג: עותק בפתק חדש. `why` - למדידה, כשיש */
  | { kind: 'copy'; why: MergeConflict | null };

export interface ResolveContext {
  now: number;
  tabId: string;
  /** הגרסה הרצה. רשומה של גרסה אחרת לא ממוזגת - רק מועתקת */
  clientVersion: string;
  /** העורך של הפתק פתוח בלשונית הזו: הוא מציג בחירה בעצמו */
  editorOpen: boolean;
  /** `minClientVersion`: הגרסה הזו לא כותבת. ממתינים לגרסה החדשה */
  writesBlocked: boolean;
}

const sameText = (a: NoteText, b: NoteText) => a.title === b.title && a.content === b.content;

export const resolveEntry = (entry: JournalEntry, view: ServerView, context: ResolveContext): Resolution => {
  if (view.kind === 'snapshot') {
    // מה-cache, או שהכתיבה עדיין בתור: עוד לא ידוע מה השרת יגיד
    if (view.fromCache || view.pending) return { kind: 'wait' };
    if (view.exists && view.saveId === entry.saveId) return { kind: 'confirmed' };
  }

  // מכאן: לא הגיעה. מי שמחליט מה לעשות איתה - רק אחד, ולא בחיפזון
  if (entry.tabId !== context.tabId) {
    const age = context.now - entry.at;
    if (age < FOREIGN_ENTRY_GRACE_MS) return { kind: 'wait', retryInMs: FOREIGN_ENTRY_GRACE_MS - age };
  }
  if (context.editorOpen || context.writesBlocked) return { kind: 'wait' };

  // הפתק נמחק, או שכבר אין לנו גישה אליו
  if (view.kind === 'unreadable' || !view.exists) return { kind: 'copy', why: null };

  if (sameText(view, entry.text) && view.templateType === entry.templateType) return { kind: 'kept' };

  // בלי בסיס ידוע אי אפשר לדעת מה השתנה בכל צד
  const { base } = entry;
  if (base === null) return { kind: 'copy', why: { reason: 'unconfirmed', fields: [] } };
  // גרסה אחרת כתבה את הטקסט (אולי בפורמט אחר), או שהתבנית הוחלפה: לא ממזגים
  if (entry.clientVersion !== context.clientVersion || view.templateType !== entry.templateType) {
    return { kind: 'copy', why: null };
  }

  const result = mergeNote(base, entry.text, view, view.templateType);
  if ('conflict' in result) return { kind: 'copy', why: result.conflict };
  return sameText(result.merged, view) ? { kind: 'kept' } : { kind: 'merge', text: result.merged };
};

/** המזהה של העותק: קבוע לכל שמירה, כך שהוא נוצר פעם אחת בלבד */
export const recoveryCopyId = (entry: JournalEntry): string => `recovery-${entry.saveId}`;
