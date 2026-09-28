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
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useDebouncedPatch } from '@/hooks/useDebouncedPatch';
import * as noteAPI from '@/services/api/notes';
import { recoverRejectedText, registerOpenEditor } from '@/services/api/noteRecovery';
import { AUTOSAVE_DELAY_MS, LENGTH_LIMITS } from '@/utils/constants';
import { getErrorMessage, getFirebaseErrorCode } from '@/utils/errors';
import { logger } from '@/utils/logger';
import type { NoteText } from '@/utils/noteMerge';
import {
  editDraft,
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
    templateType: note.templateType,
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
}

export const useNoteSync = (note: Note): NoteSync => {
  const uid = useAuthStore((state) => state.user?.uid);
  const [noteId, setNoteId] = useState(note.id);
  const [sync, setSyncState] = useState<SyncState>(() => fromNote(note));
  const [discarded, setDiscarded] = useState<NoteText | null>(null);

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
  }
  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);

  const save = useCallback(
    (patch: noteAPI.NoteTextPatch) => {
      const { state, revision } = markSent(syncRef.current);
      setSync(state);
      const current = noteRef.current;
      noteAPI.saveNoteText(current.id, patch, revision).catch((error: unknown) => {
        if (getFirebaseErrorCode(error) === 'permission-denied') {
          // מישהו כתב בינתיים. עורך פתוח יציג התנגשות; עורך שנסגר - עותק בפתק חדש
          if (uid) recoverRejectedText({ ...current, ...state.sent[revision] }, uid);
          return;
        }
        logger.error('Note save failed:', error);
        window.alert(getErrorMessage(error));
      });
    },
    [setSync, uid]
  );

  const debouncer = useDebouncedPatch<noteAPI.NoteTextPatch>(save, AUTOSAVE_DELAY_MS);

  // עורך פתוח: שמירה שנדחית מוצגת כאן ולא הופכת לעותק
  useEffect(() => registerOpenEditor(note.id), [note.id]);

  useEffect(() => {
    return noteAPI.subscribeToNoteText(
      note.id,
      (live) => {
        if (!live.exists) return;
        if (adoptNextRef.current && !live.pending) {
          adoptNextRef.current = false;
          setSync(initialSync(live));
          return;
        }
        const { state, action } = onSnapshot(syncRef.current, live, debouncer.hasPending());
        if (state === syncRef.current) return;
        setSync(state);
        if (action.kind === 'conflict') debouncer.cancel();
        if (action.kind === 'merged') debouncer.call({ title: state.draft.title, content: state.draft.content });
      },
      (error) => logger.error('Live note listener failed:', error)
    );
  }, [note.id, debouncer, setSync]);

  const edit = useCallback(
    (patch: noteAPI.NoteTextPatch) => {
      if (syncRef.current.conflict) return;
      const text: Partial<NoteText> = {};
      if (patch.title !== undefined) text.title = patch.title;
      if (patch.content !== undefined) text.content = patch.content;
      setSync(editDraft(syncRef.current, text));
      debouncer.call(patch);
    },
    [debouncer, setSync]
  );

  const reloadRemote = useCallback(() => {
    const { state, discarded: mine } = takeRemote(syncRef.current);
    debouncer.cancel();
    setSync(state);
    setDiscarded(mine);
  }, [debouncer, setSync]);

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
    debouncer.cancel();
    setSync(state);
    setDiscarded(null);
  }, [debouncer, setSync, uid]);

  const onRestored = useCallback(() => {
    debouncer.cancel();
    adoptNextRef.current = true;
  }, [debouncer]);

  return {
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
  };
};

