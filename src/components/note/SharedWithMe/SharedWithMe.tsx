/**
 * מקטע "שותף איתי"
 *
 * מציג פתקים ששותפו איתי בלי הקטגוריה שלהם. בלי המקטע הזה הם מגיעים
 * למכשיר ולא מוצגים בשום מקום, כי דף הבית בנוי סביב קטגוריות ולפתקים
 * האלה אין קטגוריה נראית.
 *
 * אותם כרטיסים ברוחב מלא כמו בקטגוריות (v1.42.0). "הסר אותי" בתפריט ⋮
 * של הכרטיס. אין ארכוב (הפתק לא שלי) ואין גרירה (אין כאן סדר משלי).
 *
 * לא מוצג כשאין פתקים כאלה - מקטע ריק קבוע רק מוסיף רעש.
 */

import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { useOrphanSharedNotes } from '@/hooks/useOrphanSharedNotes';
import { NoteCardList } from '@/components/note/NoteCardList';
import { NoteView } from '@/components/note/NoteView';
import { confirmLeaveSharedNote } from '@/components/note/leaveSharedNote';
import type { Note } from '@/types/note';

/** צבע הפס כשלפתק אין צבע משלו - אין כאן קטגוריה שלי שתיתן צבע */
const SHARED_COLOR = '#4F46E5';

export const SharedWithMe: React.FC = () => {
  const sharedNotes = useOrphanSharedNotes();
  const [viewingNote, setViewingNote] = useState<Note | null>(null);

  if (sharedNotes.length === 0) return null;

  const activeNote = viewingNote
    ? sharedNotes.find((note) => note.id === viewingNote.id) ?? viewingNote
    : null;

  return (
    <section className="mb-4 sm:mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Users size={20} strokeWidth={1.75} className="text-ink-2-light dark:text-ink-2-dark" />
        <h2 className="text-h2 text-ink-light dark:text-ink-dark">שותף איתי</h2>
        <span className="text-body-sm text-ink-3-light dark:text-ink-3-dark">
          {sharedNotes.length} פתקים
        </span>
      </div>

      <div className="paper-on-surface bg-surface-light dark:bg-surface-dark rounded-xl shadow-e1 border border-hairline-light dark:border-hairline-dark p-3 sm:p-4">
        <NoteCardList
          notes={sharedNotes}
          categoryColor={SHARED_COLOR}
          onOpen={setViewingNote}
          onLeave={confirmLeaveSharedNote}
          emptyText=""
        />
      </div>

      {activeNote && (
        <NoteView
          note={activeNote}
          onClose={() => setViewingNote(null)}
        />
      )}
    </section>
  );
};
