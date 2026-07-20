/**
 * קומפוננטה המציגה כרטיס פתק בודד
 */

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
      className={`flex-shrink-0 w-52 sm:w-64 h-44 bg-gradient-note rounded-note p-4 shadow-note dark:shadow-note-dark transition-smooth flex flex-col cursor-pointer ${
        isDragging ? 'opacity-50 scale-95' : ''
      } ${
        isDragOver ? 'ring-2 ring-primary-start shadow-note-hover dark:shadow-note-hover-dark scale-105' : 'hover:shadow-note-hover dark:hover:shadow-note-hover-dark hover:-translate-y-1'
      }`}
      style={{ borderRight: `4px solid ${note.color || '#667eea'}` }}
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
              className="text-gray-400 dark:text-gray-500 text-sm flex-shrink-0 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-grab active:cursor-grabbing"
              title="גרור להזזה"
            >
              ⋮⋮
            </span>
          )}
          <h4 className="font-bold text-gray-800 dark:text-gray-100 flex-1 line-clamp-1 text-base">
            {note.title}
          </h4>
        </div>
        {onTogglePin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTogglePin();
            }}
            className="text-gray-400 hover:text-yellow-500 dark:hover:text-yellow-400 transition-smooth flex-shrink-0 text-lg hover:scale-110"
            title={note.isPinned ? 'ביטול הצמדה' : 'הצמדה'}
          >
            {note.isPinned ? '📌' : '📍'}
          </button>
        )}
      </div>

      {/* תוכן הפתק */}
      <div className="flex-1 overflow-hidden mb-3">
        <p className="text-sm text-gray-700 dark:text-gray-100 whitespace-pre-wrap line-clamp-3 leading-relaxed">
          {displayContent}
        </p>
      </div>

      {/* תגיות */}
      {note.tags && note.tags.length > 0 && (
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {note.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="text-xs bg-white/70 dark:bg-gray-700/70 text-gray-700 dark:text-gray-200 px-2.5 py-1 rounded-full font-medium shadow-sm"
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
          className="flex-1 text-xs py-2 font-semibold"
        >
          👁 הצג
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          className="flex-1 text-xs py-2 font-semibold"
        >
          🗑 מחק
        </Button>
      </div>
    </div>
  );
};
