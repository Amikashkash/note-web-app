/**
 * מריץ את ההכרעות של `draftJournal` (`resolveEntry`): מאזין לכל פתק שיש לו
 * רשומה, ופועל כשהשרת עונה. טהור מ-Firebase ומ-React - הכל מוזרק, כדי
 * שאפשר יהיה לבדוק אותו גם ביחידה וגם מול ה-emulator עם ה-SDK האמיתי.
 * החיבור לאפליקציה ב-`hooks/useDraftJournal.ts`.
 */

import {
  dropEntry,
  getEntry,
  listEntries,
  recordEntry,
  recoveryCopyId,
  resolveEntry,
  type JournalEntry,
  type ServerView,
} from './draftJournal';
import type { MergeConflict, NoteText } from './noteMerge';

export interface ResolverDeps {
  uid: string;
  tabId: string;
  clientVersion: string;
  now: () => number;
  newSaveId: () => string;
  subscribe: (noteId: string, onView: (view: ServerView) => void) => () => void;
  isEditorOpen: (noteId: string) => boolean;
  writesBlocked: () => boolean;
  /** האם העותק כבר קיים בשרת. נכשל (למשל offline) → ננסה שוב בהמשך */
  copyExists: (copyId: string) => Promise<boolean>;
  createCopy: (copyId: string, entry: JournalEntry) => Promise<void>;
  saveText: (
    noteId: string,
    text: NoteText,
    chain: { revision: number; saveId: string; baseSaveId: string | null }
  ) => Promise<void>;
  report: (why: MergeConflict, templateType: string) => void;
  setTimer: (callback: () => void, ms: number) => unknown;
  onError: (message: string, error: unknown) => void;
}

export interface JournalResolver {
  /** הרשומות השתנו (כאן או בלשונית אחרת): מאזינים לפתקים הנכונים */
  sync: () => void;
  /** לבדוק שוב פתק, עם מה שכבר ידוע עליו (עורך נסגר, החסימה הוסרה) */
  recheck: (noteId?: string) => void;
  stop: () => void;
}

export const createJournalResolver = (deps: ResolverDeps): JournalResolver => {
  const subscriptions = new Map<string, () => void>();
  const views = new Map<string, ServerView>();
  /** עותק בדרך לפתק הזה: לא מתחילים עוד אחד */
  const busy = new Set<string>();
  /** ה-saveId של הרשומה כשראינו אותה לאחרונה, לכל פתק */
  const seenSaveIds = new Map<string, string>();
  let stopped = false;

  const evaluate = (noteId: string) => {
    if (stopped || busy.has(noteId)) return;
    const entry = getEntry(deps.uid, noteId);
    const view = views.get(noteId);
    if (!entry || !view) return;

    const resolution = resolveEntry(entry, view, {
      now: deps.now(),
      tabId: deps.tabId,
      clientVersion: deps.clientVersion,
      editorOpen: deps.isEditorOpen(noteId),
      writesBlocked: deps.writesBlocked(),
    });

    switch (resolution.kind) {
      case 'wait':
        if (resolution.retryInMs !== undefined) deps.setTimer(() => evaluate(noteId), resolution.retryInMs);
        return;
      case 'confirmed':
      case 'kept':
        dropEntry(deps.uid, noteId, entry.saveId);
        return;
      case 'merge':
        merge(entry, view, resolution.text);
        return;
      case 'copy':
        void copy(entry, resolution.why);
    }
  };

  const merge = (entry: JournalEntry, view: ServerView, text: NoteText) => {
    if (view.kind !== 'snapshot') return;
    const saveId = deps.newSaveId();
    const revision = view.revision + 1;
    // רשומה חדשה לפני הכתיבה: אם גם המיזוג יידחה, ההכרעה חוזרת מול הגרסה הזו
    recordEntry(deps.uid, {
      ...entry,
      saveId,
      revision,
      text,
      base: { title: view.title, content: view.content, revision: view.revision },
      clientVersion: deps.clientVersion,
      tabId: deps.tabId,
      at: deps.now(),
    });
    try {
      deps
        .saveText(entry.noteId, text, { revision, saveId, baseSaveId: view.saveId })
        .then(() => dropEntry(deps.uid, entry.noteId, saveId))
        // נדחה: ה-snapshot הבא מהשרת יחזיר להכרעה
        .catch((error: unknown) => deps.onError('Journal merge was not saved:', error));
    } catch (error) {
      deps.onError('Journal merge could not be sent:', error);
    }
  };

  const copy = async (entry: JournalEntry, why: MergeConflict | null) => {
    busy.add(entry.noteId);
    try {
      const copyId = recoveryCopyId(entry);
      if (!(await deps.copyExists(copyId))) {
        await deps.createCopy(copyId, entry);
        if (why) deps.report(why, entry.templateType);
      }
      dropEntry(deps.uid, entry.noteId, entry.saveId);
    } catch (error) {
      // offline או שגיאה: הרשומה נשארת, וננסה שוב ב-snapshot הבא
      deps.onError('Journal recovery copy failed, will retry:', error);
    } finally {
      busy.delete(entry.noteId);
    }
  };

  const sync = () => {
    if (stopped) return;
    const entries = listEntries(deps.uid);
    const noteIds = new Set(entries.map((entry) => entry.noteId));
    for (const [noteId, unsubscribe] of subscriptions) {
      if (noteIds.has(noteId)) continue;
      unsubscribe();
      subscriptions.delete(noteId);
      views.delete(noteId);
      seenSaveIds.delete(noteId);
    }
    // שמירה חדשה לפתק: מה שראינו עד עכשיו הוא מ**לפני** הכתיבה שלה, ואסור
    // להכריע לפיו (היה נראה כאילו נדחתה). מחכים ל-snapshot הבא
    for (const entry of entries) {
      if (seenSaveIds.get(entry.noteId) === entry.saveId) continue;
      seenSaveIds.set(entry.noteId, entry.saveId);
      views.delete(entry.noteId);
    }
    for (const noteId of noteIds) {
      if (subscriptions.has(noteId)) {
        // רשומה חדשה לפתק שכבר מאזינים לו: אולי כבר אפשר להכריע
        evaluate(noteId);
        continue;
      }
      subscriptions.set(
        noteId,
        deps.subscribe(noteId, (view) => {
          views.set(noteId, view);
          evaluate(noteId);
        })
      );
    }
  };

  return {
    sync,
    recheck: (noteId) => (noteId ? evaluate(noteId) : [...subscriptions.keys()].forEach(evaluate)),
    stop: () => {
      stopped = true;
      subscriptions.forEach((unsubscribe) => unsubscribe());
      subscriptions.clear();
      views.clear();
      seenSaveIds.clear();
    },
  };
};
