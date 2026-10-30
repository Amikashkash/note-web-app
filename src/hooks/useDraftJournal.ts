/**
 * מריץ את `draftJournal` כל עוד יש משתמש מחובר (`utils/draftJournal.ts`):
 * שמירות שלא אושרו - מהסשן הזה, מסשן קודם או מלשונית אחרת - מוכרעות
 * כשהשרת עונה. אישור → נמחקות; דחייה → מיזוג או עותק בפתק חדש.
 *
 * עלות: מאזין למסמך של כל פתק שיש לו רשומה - בדרך כלל אף אחד, ובזמן עריכה
 * הפתק הפתוח (שכבר יש לו מאזין: Firestore משתף אותו).
 */

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useAppVersionStore, writesBlocked } from '@/store/appVersionStore';
import { saveNoteText, subscribeToNoteText } from '@/services/api/notes';
import { createRecoveryCopy, isEditorOpen, onEditorClosed, recoveryCopyExists } from '@/services/api/noteRecovery';
import { reportConflict } from '@/services/api/conflictEvents';
import { isJournalKey, onJournalChange, TAB_ID } from '@/utils/draftJournal';
import { createJournalResolver } from '@/utils/draftJournalResolver';
import { getFirebaseErrorCode } from '@/utils/errors';
import { logger } from '@/utils/logger';

export const useDraftJournal = (): void => {
  const uid = useAuthStore((state) => state.user?.uid);

  useEffect(() => {
    if (!uid) return;
    const resolver = createJournalResolver({
      uid,
      tabId: TAB_ID,
      clientVersion: __APP_VERSION__,
      now: Date.now,
      newSaveId: () => crypto.randomUUID(),
      subscribe: (noteId, onView) =>
        subscribeToNoteText(
          noteId,
          (live) =>
            onView({
              kind: 'snapshot',
              exists: live.exists,
              fromCache: live.fromCache,
              pending: live.pending,
              title: live.title,
              content: live.content,
              templateType: live.templateType,
              revision: live.revision,
              saveId: live.saveId,
            }),
          (error) => {
            // אין יותר גישה לפתק (השיתוף הוסר): הטקסט עובר לעותק אצלנו
            if (getFirebaseErrorCode(error) === 'permission-denied') onView({ kind: 'unreadable' });
            else logger.warn('Draft journal listener failed:', error);
          }
        ),
      isEditorOpen,
      writesBlocked,
      copyExists: recoveryCopyExists,
      createCopy: (copyId, entry) => createRecoveryCopy(copyId, entry, uid),
      saveText: (noteId, text, chain) => saveNoteText(noteId, text, chain),
      report: reportConflict,
      setTimer: (callback, ms) => setTimeout(callback, ms),
      onError: (message, error) => logger.warn(message, error),
    });

    resolver.sync();
    const stopJournal = onJournalChange(resolver.sync);
    // לשונית אחרת כתבה או מחקה רשומה
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || isJournalKey(event.key)) resolver.sync();
    };
    window.addEventListener('storage', onStorage);
    const stopEditors = onEditorClosed((noteId) => resolver.recheck(noteId));
    // החסימה הוסרה (הבעלים הוריד את המינימום): מה שחיכה - עכשיו
    const stopBlocked = useAppVersionStore.subscribe((state, previous) => {
      if (previous.writesBlocked && !state.writesBlocked) resolver.recheck();
    });

    return () => {
      stopJournal();
      window.removeEventListener('storage', onStorage);
      stopEditors();
      stopBlocked();
      resolver.stop();
    };
  }, [uid]);
};
