/**
 * קומפוננטה המציגה כרטיס פתק בודד
 */

import { Eye, GripVertical, Pin, Trash2 } from 'lucide-react';
import { Note } from '@/types/note';
import { Button } from '@/components/common/Button';
import { getNotePreview } from '@/utils/notePreview';

interface NoteCardProps {
  note: Note;
  onView: (note: Note) => void;
  onDelete: (noteId: string) => void;
  onTogglePin?: (noteId: string, isPinned: boolean) => void;
  onDragStart?: (note: Note) => void;
  onDragEnd?: () => void;
  onDragOver?: (note: Note) => void;
  onDrop?: (targetNote: Note) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  onView,
  onDelete,
  onTogglePin,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDragging = false,
  isDragOver = false,
}) => {
  const handleView = () => {
    onView(note);
  };

  const handleDelete = () => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק פתק זה?')) {
      onDelete(note.id);
    }
  };

  const handleTogglePin = () => {
    if (onTogglePin) {
      onTogglePin(note.id, !note.isPinned);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (onDragStart) {
      onDragStart(note);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', note.id);
    }
  };

  const handleDragEnd = () => {
    if (onDragEnd) {
      onDragEnd();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (onDragOver) {
      onDragOver(note);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (onDrop) {
      onDrop(note);
    }
  };

  const displayContent = getNotePreview(note.content);

  return (
    <div
      onDragOver={onDragOver ? handleDragOver : undefined}
      onDrop={onDrop ? handleDrop : undefined}
      className={`flex-shrink-0 w-52 sm:w-64 h-44 bg-surface-light dark:bg-surface-dark rounded-lg p-4 border border-hairline-light dark:border-hairline-dark border-s-4 shadow-e1 transition-smooth flex flex-col cursor-pointer ${
        isDragging ? 'opacity-50 scale-95' : ''
      } ${
        isDragOver ? 'ring-2 ring-brand shadow-e2 scale-105' : 'hover:shadow-e2'
      }`}
      // פס הצבע בתכונה לוגית: `borderRight` היה מצייר אותו בצד שמאל
      // החזותי בעברית, כלומר בקצה שבו השורה נגמרת במקום שבו היא מתחילה.
      style={{ borderInlineStartColor: note.color || '#4F46E5' }}
      onClick={handleView}
    >
      {/* כותרת ואייקון הצמדה */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {onDragStart && (
            <span
              draggable={true}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              className="text-ink-3-light dark:text-ink-3-dark flex-shrink-0 hover:text-ink-light dark:hover:text-ink-dark transition-colors cursor-grab active:cursor-grabbing"
              title="גרור להזזה"
            >
              <GripVertical size={16} strokeWidth={1.75} />
            </span>
          )}
          <h4 className="text-h2 text-ink-light dark:text-ink-dark flex-1 line-clamp-1">
            {note.title}
          </h4>
        </div>
        {onTogglePin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTogglePin();
            }}
            className={`transition-smooth flex-shrink-0 hover:scale-110 ${
              note.isPinned
                ? 'text-cat-orange dark:text-cat-orange-dark'
                : 'text-ink-3-light dark:text-ink-3-dark hover:text-cat-orange'
            }`}
            title={note.isPinned ? 'ביטול הצמדה' : 'הצמדה'}
          >
            {/* מוצמד = אייקון מלא, לא אייקון אחר. שני אימוג'י שונים
                (📌 מול 📍) קראו כשני דברים ולא כשני מצבים של אותו דבר. */}
            <Pin size={18} strokeWidth={1.75} fill={note.isPinned ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      {/* תוכן הפתק */}
      <div className="flex-1 overflow-hidden mb-3">
        <p className="text-body-sm text-ink-2-light dark:text-ink-2-dark whitespace-pre-wrap line-clamp-3">
          {displayContent}
        </p>
      </div>

      {/* תגיות */}
      {note.tags && note.tags.length > 0 && (
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {note.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="text-caption bg-raised-light dark:bg-raised-dark text-ink-2-light dark:text-ink-2-dark px-2.5 py-1 rounded-full"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* כפתורי פעולה */}
      <div className="flex gap-2 mt-auto pt-3">
        <Button
          variant="primary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleView();
          }}
          className="flex-1"
        >
          <Eye size={16} strokeWidth={1.75} />
          הצג
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          className="flex-1"
        >
          <Trash2 size={16} strokeWidth={1.75} />
          מחק
        </Button>
      </div>
    </div>
  );
};
