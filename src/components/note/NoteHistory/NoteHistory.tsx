/**
 * היסטוריית הגרסאות של פתק
 *
 * רשימה לפי זמן ומי שינה, תצוגה מקדימה של גרסה, וכפתור "שחזר". השחזור
 * הוא עדכון רגיל של הפתק, ולכן הטריגר שומר את המצב שלפניו כגרסה חדשה -
 * כלומר גם שחזור אפשר לבטל, מאותה רשימה.
 *
 * הגרסאות נכתבות בשרת (`functions/src/versions.ts`): גרסה לכל רצף עריכה
 * של עשר דקות, ומיד כשמשתמש אחר עורך או כשהפתק מאורכב, מועבר או משנה סוג.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { History, RotateCcw } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/store/authStore';
import { fetchNoteVersions } from '@/services/api/versions';
import { restoreNoteVersion } from '@/services/api/notes';
import { getUserLookupEntries } from '@/services/api/users';
import { renderNoteContent } from '@/utils/backupFormat';
import { getTemplateLabel } from '@/utils/templates';
import { getErrorMessage } from '@/utils/errors';
import type { Note } from '@/types/note';
import type { NoteVersion, VersionReason } from '@/types/version';

interface NoteHistoryProps {
  note: Note;
  onClose: () => void;
  /** נקרא אחרי שחזור מוצלח, כדי שהעורך יחליף את הטיוטה המקומית שלו */
  onRestored: (version: NoteVersion) => void;
}

const REASON_LABELS: Record<VersionReason, string> = {
  time: '',
  writer: 'לפני עריכה של משתמש אחר',
  archive: 'לפני העברה לארכיון',
  template: 'לפני שינוי סוג הפתק',
  move: 'לפני העברת קטגוריה',
  restore: 'לפני שחזור',
};

const formatWhen = (timestamp: Timestamp): string =>
  new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp.toDate());

/** תצוגה מקדימה קריאה של תוכן הגרסה, בכל סוג פתק */
const previewText = (note: Note, version: NoteVersion): string =>
  renderNoteContent({
    ...note,
    title: version.title,
    content: version.content,
    templateType: version.templateType,
  });

export const NoteHistory: React.FC<NoteHistoryProps> = ({ note, onClose, onRestored }) => {
  const currentUid = useAuthStore((state) => state.user?.uid);

  const [versions, setVersions] = useState<NoteVersion[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchNoteVersions(note.id)
      .then(async (loaded) => {
        if (cancelled) return;
        setVersions(loaded);
        setSelectedId(loaded[0]?.id ?? null);

        // שמות תצוגה לכותבים. כישלון כאן לא חוסם - נשאר "משתמש אחר".
        const uids = [...new Set(loaded.map((version) => version.authoredBy))].filter(
          (uid): uid is string => uid !== null && !uid.startsWith('mcp:')
        );
        const entries = await getUserLookupEntries(uids);
        if (!cancelled) {
          setNames(Object.fromEntries(entries.map((entry) => [entry.uid, entry.displayName || entry.email])));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(getErrorMessage(error));
      });

    return () => {
      cancelled = true;
    };
  }, [note.id]);

  const selected = useMemo(
    () => versions?.find((version) => version.id === selectedId) ?? null,
    [versions, selectedId]
  );

  const whoWrote = (uid: string | null): string => {
    if (uid === null) return 'לא ידוע';
    if (uid === currentUid) return 'אתה';
    if (uid.startsWith('mcp:')) return 'Claude';
    return names[uid] ?? 'משתמש אחר';
  };

  const handleRestore = async () => {
    if (!selected) return;
    setRestoring(true);
    setRestoreError(null);
    try {
      await restoreNoteVersion(note.id, selected);
      onRestored(selected);
      onClose();
    } catch (error) {
      setRestoreError(getErrorMessage(error));
      setRestoring(false);
    }
  };

  return (
    <Modal onClose={onClose} title="היסטוריית גרסאות">
      <div className="space-y-4 sm:min-w-[40rem]">
        {loadError && (
          <p role="alert" className="text-sm text-danger dark:text-danger-dark">
            {loadError}
          </p>
        )}

        {versions === null && !loadError && (
          <div className="flex justify-center p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {versions?.length === 0 && (
          <div className="bg-raised-light dark:bg-raised-dark rounded-lg p-4 text-sm text-ink-2-light dark:text-ink-2-dark flex gap-3">
            <History size={20} strokeWidth={1.75} className="flex-shrink-0 mt-0.5" />
            <p>
              עדיין אין גרסאות קודמות. גרסה נשמרת כשמתחילים לערוך - אחת לכל רצף עריכה של עשר
              דקות, ומיד כשמישהו אחר עורך את הפתק.
            </p>
          </div>
        )}

        {versions && versions.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
            {/* רשימת הגרסאות */}
            <ul className="space-y-1 max-h-72 sm:max-h-[28rem] overflow-y-auto" aria-label="גרסאות קודמות">
              {versions.map((version) => {
                const when = version.authoredAt ?? version.capturedAt;
                const reason = REASON_LABELS[version.reason];
                const isSelected = version.id === selectedId;
                return (
                  <li key={version.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(version.id)}
                      aria-current={isSelected}
                      className={`w-full text-start rounded-lg px-3 py-2 border transition-colors ${
                        isSelected
                          ? 'border-brand bg-brand-soft dark:bg-brand-soft-dark dark:border-brand-dark'
                          : 'border-transparent hover:bg-raised-light dark:hover:bg-raised-dark'
                      }`}
                    >
                      <div className="text-sm font-medium text-ink-light dark:text-ink-dark">
                        {formatWhen(when)}
                      </div>
                      <div className="text-caption text-ink-3-light dark:text-ink-3-dark">
                        {whoWrote(version.authoredBy)}
                        {reason && ` · ${reason}`}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* תצוגה מקדימה */}
            {selected && (
              <div className="space-y-3 min-w-0">
                <div>
                  <h3 className="text-h2 text-ink-light dark:text-ink-dark break-words">
                    {selected.title || 'ללא כותרת'}
                  </h3>
                  <p className="text-caption text-ink-3-light dark:text-ink-3-dark">
                    {getTemplateLabel(selected.templateType)}
                    {selected.templateType !== note.templateType && ' · סוג שונה מהנוכחי'}
                  </p>
                </div>
                <pre
                  dir="auto"
                  className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-raised-light dark:bg-raised-dark p-3 text-body-sm text-ink-light dark:text-ink-dark font-sans"
                >
                  {previewText(note, selected)}
                </pre>

                {restoreError && (
                  <p role="alert" className="text-sm text-danger dark:text-danger-dark">
                    {restoreError}
                  </p>
                )}

                <Button onClick={handleRestore} disabled={restoring} className="inline-flex items-center gap-2">
                  <RotateCcw size={16} strokeWidth={1.75} />
                  {restoring ? 'משחזר…' : 'שחזר גרסה זו'}
                </Button>
                <p className="text-caption text-ink-3-light dark:text-ink-3-dark">
                  המצב הנוכחי יישמר בהיסטוריה, כך שאפשר לבטל את השחזור.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
