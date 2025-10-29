/**
 * קומפוננטה המציגה רשימת פתקים בגלילה אופקית
 */

import { Note } from '@/types/note';
import { NoteCard } from '../NoteCard';
import { Button } from '@/components/common/Button';

interface NotesListProps {
  notes: Note[];
  onView: (note: Note) => void;
  onDelete: (noteId: string) => void;
  onTogglePin?: (noteId: string, isPinned: boolean) => void;
  onAddNote: () => void;
}

export const NotesList: React.FC<NotesListProps> = ({
  notes,
  onView,
  onDelete,
  onTogglePin,
  onAddNote,
}) => {
  // מיון: פתקים מוצמדים קודם, ואז לפי סדר
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return a.order - b.order;
  });

  if (notes.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <p className="text-gray-500 mb-4">אין פתקים בקטגוריה זו</p>
          <Button onClick={onAddNote} size="sm">
            + פתק ראשון
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* רשימת פתקים עם גלילה אופקית */}
      <div className="overflow-x-auto pb-4 pt-2">
        <div className="flex gap-4 rtl:flex-row-reverse">
          {sortedNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onView={onView}
              onDelete={onDelete}
              onTogglePin={onTogglePin}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
