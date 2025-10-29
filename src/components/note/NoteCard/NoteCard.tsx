/**
 * קומפוננטה המציגה כרטיס פתק בודד
 */

import { Note } from '@/types/note';
import { Button } from '@/components/common/Button';

interface NoteCardProps {
  note: Note;
  onView: (note: Note) => void;
  onDelete: (noteId: string) => void;
  onTogglePin?: (noteId: string, isPinned: boolean) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  onView,
  onDelete,
  onTogglePin,
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

  // קיצור התוכן ל-50 תווים
  const truncatedContent = note.content.length > 50
    ? note.content.substring(0, 50) + '...'
    : note.content;

  return (
    <div
      className="flex-shrink-0 w-64 h-40 bg-white rounded-lg shadow-md p-3 border-r-4 hover:shadow-lg transition-shadow flex flex-col"
      style={{ borderRightColor: note.color || '#3B82F6' }}
    >
      {/* כותרת ואייקון הצמדה */}
      <div className="flex items-start justify-between mb-1">
        <h3 className="font-semibold text-gray-800 flex-1 line-clamp-1 text-sm">
          {note.title}
        </h3>
        {onTogglePin && (
          <button
            onClick={handleTogglePin}
            className="text-gray-400 hover:text-yellow-500 transition-colors flex-shrink-0 text-sm"
            title={note.isPinned ? 'ביטול הצמדה' : 'הצמדה'}
          >
            {note.isPinned ? '📌' : '📍'}
          </button>
        )}
      </div>

      {/* תוכן הפתק */}
      <div className="flex-1 overflow-hidden mb-2">
        <p className="text-gray-600 text-xs whitespace-pre-wrap line-clamp-2">
          {truncatedContent}
        </p>
      </div>

      {/* כפתורי פעולה */}
      <div className="flex gap-2 mt-auto">
        <Button
          variant="primary"
          size="sm"
          onClick={handleView}
          className="flex-1 text-xs py-1"
        >
          👁 הצג
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          className="flex-1 text-xs py-1"
        >
          🗑 מחק
        </Button>
      </div>
    </div>
  );
};
