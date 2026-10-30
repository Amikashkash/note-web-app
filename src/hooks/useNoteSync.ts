/**
 * עורך פתק שלא דורס (C-1): טיוטה מקומית, שמירה מושהית, והאזנה לשינויים
 * מרחוק. ההחלטות עצמן ב-`utils/noteSync.ts` (טהור, עם בדיקות); כאן רק
 * החיבור ל-React ול-Firestore.
 *
 * - הפתק הפתוח מאזין למסמך שלו, עם metadata, כדי להבחין בין הד מקומי
 *   לגרסה שהשרת אישר.
 * - כל שמירה נושאת `revision` מפורש (הבסיס + 1). אם מישהו אחר כתב בינתיים,
 *   ה-rules דוחים אותה, וה-snapshot שחוזר מוביל להתנגשות - לא לדריסה.
 * - שינוי מרחוק בלי עריכה מקומית: מאומץ בשקט. עם עריכה: מיזוג כשבטוח
 *   (פריטים שונים), אחרת בחירה של המשתמש.
 * - כל שמירה נרשמת ב-`draftJournal` לפני שהיא יוצאת, ונמחקת משם כשהשרת
 *   מאשר או כשהמשתמש הכריע בהתנגשות. שמירה שנדחית אחרי שהעורך נסגר (גם
 *   בהפעלה הבאה) - ה-journal ממזג או מעתיק (`hooks/useDraftJournal.ts`).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useDebouncedPatch } from '@/hooks/useDebouncedPatch';
import * as noteAPI from '@/services/api/notes';
import { registerOpenEditor } from '@/services/api/noteRecovery';
import { reportConflict } from '@/services/api/conflictEvents';
import { AUTOSAVE_DELAY_MS, AUTOSAVE_MAX_WAIT_MS, LENGTH_LIMITS, PENDING_WRITES_BADGE_DELAY_MS } from '@/utils/constants';
import { getErrorMessage, getFirebaseErrorCode } from '@/utils/errors';
import { logger } from '@/utils/logger';
import type { NoteText } from '@/utils/noteMerge';
import {
  baseForNextEntry,
  dropEntry,
  entriesOnlyInMemory,
  getEntry,
  onJournalChange,
  recordEntry,
  TAB_ID,
} from '@/utils/draftJournal';
import { createDelayedFlag } from '@/utils/delayedFlag';
import { saveStatus, type SaveStatus } from '@/utils/saveStatus';
import { useAppVersionStore, writesBlocked } from '@/store/appVersionStore';
import {
  awaitingServer,
  editDraft,
  hasUnconfirmedEdits,
  initialSync,
  markSent,
  onSnapshot,
  takeRemote,
  type Conflict,
  type SyncState,
} from '@/utils/noteSync';
import type { Note } from '@/types/note';

const fromNote = (note: Note): SyncState =>
  initialSync({
    title: note.title,
    content: note.content,
    revision: note.revision,
    saveId: note.saveId ?? null,
    templateType: note.templateType,
    // לא ידוע כאן. ה-snapshot הראשון של המאזין יגלה אם זה הד של כתיבה ממתינה
    pending: false,
  });

export interface NoteSync {
  title: string;
  content: string;
  /** עריכה של המשתמש. חסומה בזמן התנגשות */
  edit: (patch: noteAPI.NoteTextPatch) => void;
  /** שולח מיד את מה שממתין (סגירה, פתיחת היסטוריה) */
  flush: () => void;
  /** התנגשות שממתינה להחלטה, או `null` */
  conflict: Conflict | null;
  /** אחרי "טען את הגרסה העדכנית": הטקסט של המשתמש, להעתקה, עד שייסגר */
  discarded: NoteText | null;
  dismissDiscarded: () => void;
  /** "טען את הגרסה העדכנית" */
  reloadRemote: () => void;
  /** "שמור את הגרסה שלי כפתק חדש", ואז טוען את העדכנית */
  saveMineAsNew: () => Promise<void>;
  /** אחרי שחזור גרסה מההיסטוריה: מאמצים את מה שיגיע, בלי התנגשות */
  onRestored: () => void;
  /** זורק עריכה שעוד לא נשלחה (ארכוב, יציאה משיתוף) */
  cancel: () => void;
  /** הגרסה ישנה מדי לשמור (`minClientVersion`): העורך לקריאה בלבד */
  writesBlocked: boolean;
  /** שורת המצב: "נשמר" / "שומר…" / "ממתין לחיבור" / "לא נשמר" (`utils/saveStatus.ts`) */
  status: SaveStatus;
}

export const useNoteSync = (note: Note): NoteSync => {
  const uid = useAuthStore((state) => state.user?.uid);
  const blocked = useAppVersionStore((state) => state.writesBlocked);
  const holdUnsaved = useAppVersionStore((state) => state.holdUnsaved);
  const [noteId, setNoteId] = useState(note.id);
  const [sync, setSyncState] = useState<SyncState>(() => fromNote(note));
  const [discarded, setDiscarded] = useState<NoteText | null>(null);
  // לשורת המצב
  const [failed, setFailed] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [browserOffline, setBrowserOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [slow, setSlow] = useState(false);
  const [, setJournalChanges] = useState(0);

  // הערכים העדכניים לקולבקים של Firestore ושל ה-debounce, שחיים מחוץ לרינדור
  const syncRef = useRef(sync);
  const noteRef = useRef(note);
  const adoptNextRef = useRef(false);
  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  const setSync = useCallback((next: SyncState) => {
    syncRef.current = next;
    setSyncState(next);
  }, []);

  // פתק אחר נפתח באותו רכיב: מתחילים מחדש (בזמן הרינדור, כמו קודם).
  // ה-ref מתעדכן ב-effect שלמטה, לפני שהמאזין של הפתק החדש נרשם
  if (noteId !== note.id) {
    setNoteId(note.id);
    setSyncState(fromNote(note));
    setDiscarded(null);
    setFailed(false);
  }
  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);

  // גרסה ישנה מדי (`minClientVersion`): מה שלא יצא נשמר בצד להעתקה. מה
  // שכבר יצא רשום ב-journal ויטופל בגרסה החדשה - לא פעמיים
  const holdDraft = useCallback(() => {
    const { draft } = syncRef.current;
    const noteId = noteRef.current.id;
    const journaled = uid ? getEntry(uid, noteId) : null;
    if (journaled && journaled.text.title === draft.title && journaled.text.content === draft.content) return;
    holdUnsaved({ noteId, title: draft.title, content: draft.content });
  }, [uid, holdUnsaved]);

  const save = useCallback(
    (patch: noteAPI.NoteTextPatch) => {
      // גרסה ישנה מדי (`minClientVersion`): לא שולחים. הטקסט נשאר בעורך,
      // ונשמר בצד כדי שמסך "יש גרסה חדשה" יציג אותו להעתקה
      if (writesBlocked()) {
        holdDraft();
        return;
      }
      const before = syncRef.current;
      const { state, revision, saveId, baseSaveId } = markSent(before);
      setSync(state);
      const current = noteRef.current;
      // נרשם לפני שהכתיבה יוצאת: אם תידחה כשהעורך כבר סגור (אולי רק בהפעלה
      // הבאה), ה-journal ימזג או יעתיק במקום שהטקסט ייעלם
      if (uid) {
        recordEntry(uid, {
          noteId: current.id,
          saveId,
          revision,
          text: state.sent[revision],
          templateType: patch.templateType ?? current.templateType,
          base: baseForNextEntry(getEntry(uid, current.id), before.base, before.unconfirmedBase),
          meta: {
            categoryId: current.categoryId,
            tags: current.tags,
            color: current.color,
            isSensitive: current.isSensitive,
            isReadOnly: current.isReadOnly,
          },
          clientVersion: __APP_VERSION__,
          tabId: TAB_ID,
          at: Date.now(),
        });
      }
      noteAPI
        .saveNoteText(current.id, patch, { revision, saveId, baseSaveId })
        .then(() => {
          if (uid) dropEntry(uid, current.id, saveId);
          setFailed(false);
        })
        .catch((error: unknown) => {
          // נדחתה (מישהו כתב בינתיים): עורך פתוח יציג התנגשות, עורך שנסגר -
          // ה-journal. גם אם הגרסה נחסמה בינתיים: הרשומה מחכה לגרסה החדשה
          if (getFirebaseErrorCode(error) === 'permission-denied') return;
          logger.error('Note save failed:', error);
          setFailed(true);
          window.alert(getErrorMessage(error));
        });
    },
    [setSync, uid, holdDraft]
  );

  const debouncer = useDebouncedPatch<noteAPI.NoteTextPatch>(save, AUTOSAVE_DELAY_MS, AUTOSAVE_MAX_WAIT_MS);

  // החסימה נכנסה בזמן שהפתק פתוח: מה שעוד לא נשלח לא יישלח, ונשמר בצד
  useEffect(() => {
    if (!blocked || !hasUnconfirmedEdits(syncRef.current, debouncer.hasPending())) return;
    debouncer.cancel();
    holdDraft();
  }, [blocked, debouncer, holdDraft]);

  // עורך פתוח: שמירה שנדחית מוצגת כאן ולא הופכת לעותק
  useEffect(() => registerOpenEditor(note.id), [note.id]);

  useEffect(() => {
    return noteAPI.subscribeToNoteText(
      note.id,
      (live) => {
        if (!live.exists) return;
        setFromCache(live.fromCache);
        if (adoptNextRef.current && !live.pending) {
          adoptNextRef.current = false;
          setSync(initialSync(live));
          return;
        }
        const { state, action } = onSnapshot(syncRef.current, live, debouncer.hasPending());
        if (state === syncRef.current) return;
        setSync(state);
        if (action.kind === 'conflict') {
          debouncer.cancel();
          // פעם אחת לכל התנגשות: snapshots נוספים בזמן ההתנגשות מחזירים 'none'
          reportConflict(action.why, live.templateType);
        }
        if (action.kind === 'merged') debouncer.call({ title: state.draft.title, content: state.draft.content });
      },
      (error) => logger.error('Live note listener failed:', error)
    );
  }, [note.id, debouncer, setSync]);

  const edit = useCallback(
    (patch: noteAPI.NoteTextPatch) => {
      // בזמן התנגשות, או כשהגרסה ישנה מדי לשמור - אין עריכה
      if (syncRef.current.conflict || writesBlocked()) return;
      const text: Partial<NoteText> = {};
      if (patch.title !== undefined) text.title = patch.title;
      if (patch.content !== undefined) text.content = patch.content;
      setSync(editDraft(syncRef.current, text));
      debouncer.call(patch);
    },
    [debouncer, setSync]
  );

  // המשתמש הכריע בהתנגשות: מה שה-journal שמר כבר לא צריך עותק
  const forgetJournal = useCallback(() => {
    if (uid) dropEntry(uid, noteRef.current.id);
  }, [uid]);

  const reloadRemote = useCallback(() => {
    const { state, discarded: mine } = takeRemote(syncRef.current);
    forgetJournal();
    debouncer.cancel();
    setSync(state);
    setDiscarded(mine);
  }, [debouncer, setSync, forgetJournal]);

  const saveMineAsNew = useCallback(async () => {
    const conflict = syncRef.current.conflict;
    const current = noteRef.current;
    if (!conflict || !uid) return;
    try {
      await noteAPI.createNote({
        title: `${conflict.local.title || 'ללא כותרת'} (הגרסה שלי)`.slice(0, LENGTH_LIMITS.NOTE_TITLE),
        content: conflict.local.content,
        templateType: current.templateType,
        categoryId: current.categoryId,
        tags: current.tags,
        color: current.color,
        userId: uid,
        order: 0,
        sharedWith: [],
        isPinned: false,
        isSensitive: current.isSensitive,
        isReadOnly: current.isReadOnly,
      });
    } catch (error) {
      window.alert(getErrorMessage(error));
      return;
    }
    const { state } = takeRemote(syncRef.current);
    forgetJournal();
    debouncer.cancel();
    setSync(state);
    setDiscarded(null);
  }, [debouncer, setSync, uid, forgetJournal]);

  const onRestored = useCallback(() => {
    debouncer.cancel();
    adoptNextRef.current = true;
  }, [debouncer]);

  // שורת המצב
  const unconfirmed = awaitingServer(sync);
  useEffect(() => {
    const goOnline = () => setBrowserOffline(false);
    const goOffline = () => setBrowserOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  // "שומר…" שלא אושר כמה שניות → "ממתין לחיבור", גם כשהדפדפן חושב שיש חיבור
  const slowFlag = useRef<ReturnType<typeof createDelayedFlag> | null>(null);
  useEffect(() => {
    const flag = createDelayedFlag({
      delayMs: PENDING_WRITES_BADGE_DELAY_MS,
      onChange: setSlow,
      setTimer: (callback, ms) => window.setTimeout(callback, ms),
      clearTimer: (handle) => window.clearTimeout(handle as number),
    });
    slowFlag.current = flag;
    return () => {
      flag.stop();
      slowFlag.current = null;
    };
  }, []);
  useEffect(() => {
    slowFlag.current?.set(unconfirmed);
  }, [unconfirmed]);
  useEffect(() => onJournalChange(() => setJournalChanges((count) => count + 1)), []);
  const notOnDevice = uid ? entriesOnlyInMemory(uid).some((entry) => entry.noteId === note.id) : false;
  const status = saveStatus({
    unconfirmed,
    conflict: sync.conflict !== null,
    writesBlocked: blocked,
    failed,
    offline: fromCache || browserOffline,
    slow,
    notOnDevice,
  });

  return {
    status,
    title: sync.draft.title,
    content: sync.draft.content,
    edit,
    flush: debouncer.flush,
    conflict: sync.conflict,
    discarded,
    dismissDiscarded: () => setDiscarded(null),
    reloadRemote,
    saveMineAsNew,
    onRestored,
    cancel: debouncer.cancel,
    writesBlocked: blocked,
  };
};

