/**
 * מקטע "שותף איתי"
 *
 * מציג פתקים ששותפו איתי בלי הקטגוריה שלהם. בלי המקטע הזה הם מגיעים
 * למכשיר ולא מוצגים בשום מקום, כי דף הבית בנוי סביב קטגוריות ולפתקים
 * האלה אין קטגוריה נראית.
 *
 * לא מוצג כשאין פתקים כאלה - מקטע ריק קבוע רק מוסיף רעש.
 */

import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { useOrphanSharedNotes } from '@/hooks/useOrphanSharedNotes';
import { NoteCard } from '@/components/note/NoteCard';
import { NoteView } from '@/components/note/NoteView';
import { leaveSharedNote } from '@/services/api/notes';
import { getErrorMessage } from '@/utils/errors';
import type { Note } from '@/types/note';

export const SharedWithMe: React.FC = () => {
  const sharedNotes = useOrphanSharedNotes();
  const [viewingNote, setViewingNote] = useState<Note | null>(null);

  // הפתקים שייכים לקטגוריה של מישהו אחר, ולכן אין כאן קטגוריה משלנו
  // להעביר. הפעולות: צפייה, עריכה, והסרה של עצמי מהשיתוף - מה שהכללים
  // מתירים למי ששותפו איתו. (קודם היה כאן "מחק" שלא עשה כלום.)
  // העריכה עצמה נשמרת מתוך NoteView (useNoteSync).

  const handleLeave = async (note: Note) => {
    if (
      !window.confirm(
        `להסיר אותך מהשיתוף של "${note.title || 'ללא כותרת'}"?

הפתק יפסיק להופיע אצלך. הבעלים יוכל לשתף אותו איתך שוב.`
      )
    ) {
      return;
    }
    try {
      await leaveSharedNote(note.id);
    } catch (error) {
      window.alert(getErrorMessage(error));
    }
  };

  if (sharedNotes.length === 0) return null;

  const activeNote = viewingNote
    ? sharedNotes.find((note) => note.id === viewingNote.id) ?? viewingNote
    : null;

  return (
    <section className="mb-4 sm:mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Users size={20} strokeWidth={1.75} className="text-ink-2-light dark:text-ink-2-dark" />
        <h2 className="text-h2 text-ink-light dark:text-ink-dark">שותף איתי</h2>
        <span className="text-caption text-ink-3-light dark:text-ink-3-dark">
          {sharedNotes.length} פתקים
        </span>
      </div>

      <div className="bg-surface-light dark:bg-surface-dark rounded-lg shadow-e1 border border-hairline-light dark:border-hairline-dark p-2 sm:p-4">
        <div className="overflow-x-auto" dir="rtl">
          <div className="flex gap-3">
            {sharedNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onView={setViewingNote}
                onLeave={handleLeave}
              />
            ))}
          </div>
        </div>
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
