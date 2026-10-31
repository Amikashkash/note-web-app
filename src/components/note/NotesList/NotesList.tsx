/**
 * קומפוננטה המציגה רשימת פתקים בגלילה אופקית
 */

import { Note } from '@/types/note';
import { NoteCard } from '../NoteCard';

interface NotesListProps {
  notes: Note[];
  onView: (note: Note) => void;
  onDelete: (noteId: string) => void;
  onTogglePin?: (noteId: string, isPinned: boolean) => void;
  onDragStart?: (note: Note) => void;
  onDragEnd?: () => void;
  onDragOver?: (note: Note) => void;
  onDrop?: (targetNote: Note) => void;
  draggingNoteId?: string;
  dragOverNoteId?: string;
}

export const NotesList: React.FC<NotesListProps> = ({
  notes,
  onView,
  onDelete,
  onTogglePin,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  draggingNoteId,
  dragOverNoteId,
}) => {
  // מיון: פתקים מוצמדים קודם, ואז לפי סדר
  const sortedNotes = [...notes].sort((a, b) => {
    // קודם כל, מוצמדים לפני לא-מוצמדים
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    // בתוך אותה קבוצה (מוצמדים או לא), מיון לפי order
    const orderA = a.order ?? 0;
    const orderB = b.order ?? 0;
    return orderA - orderB;
  });

  if (notes.length === 0) {
    return (
      // בלי כפתור משלו: יש "+" אחד במסך הבית, והוא יוצר בקטגוריה הפתוחה (v1.40.0)
      <p className="py-6 text-center text-body text-ink-3-light dark:text-ink-3-dark">
        אין פתקים בקטגוריה. ה-+ שבתחתית המסך יוצר פתק כאן.
      </p>
    );
  }

  return (
    <div className="relative">
      {/* רשימת פתקים עם גלילה אופקית */}
      <div className="overflow-x-auto scrollbar-hide pb-4 pt-2" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        <div className="flex gap-4 rtl:flex-row-reverse min-w-max">
          {sortedNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onView={onView}
              onDelete={onDelete}
              onTogglePin={onTogglePin}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDrop={onDrop}
              isDragging={draggingNoteId === note.id}
              isDragOver={dragOverNoteId === note.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
