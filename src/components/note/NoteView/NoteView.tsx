/**
 * קומפוננטה להצגת פתק מלא במודאל
 */

import { Note } from '@/types/note';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';

interface NoteViewProps {
  note: Note;
  onClose: () => void;
  onEdit: (note: Note) => void;
  onDelete: (noteId: string) => void;
  onTogglePin?: (noteId: string, isPinned: boolean) => void;
}

export const NoteView: React.FC<NoteViewProps> = ({
  note,
  onClose,
  onEdit,
  onDelete,
  onTogglePin,
}) => {
  const handleEdit = () => {
    onEdit(note);
  };

  const handleDelete = () => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק פתק זה?')) {
      onDelete(note.id);
      onClose();
    }
  };

  const handleTogglePin = () => {
    if (onTogglePin) {
      onTogglePin(note.id, !note.isPinned);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="max-h-[80vh] overflow-y-auto">
        {/* כותרת */}
        <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{note.title}</h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>
                {note.templateType === 'plain' && '📝 טקסט'}
                {note.templateType === 'checklist' && '✅ משימות'}
                {note.templateType === 'recipe' && '🍳 מתכון'}
                {note.templateType === 'shopping' && '🛒 קניות'}
                {note.templateType === 'idea' && '💡 רעיון'}
              </span>
              <span>•</span>
              <span>
                {new Date(note.updatedAt.toDate()).toLocaleDateString('he-IL', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
          {onTogglePin && (
            <button
              onClick={handleTogglePin}
              className="text-2xl hover:scale-110 transition-transform"
              title={note.isPinned ? 'ביטול הצמדה' : 'הצמדה'}
            >
              {note.isPinned ? '📌' : '📍'}
            </button>
          )}
        </div>

        {/* תוכן */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">תוכן:</h3>
          <div
            className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border border-gray-200 min-h-[200px]"
            style={{ borderRightColor: note.color || '#3B82F6', borderRightWidth: '4px' }}
          >
            {note.content || 'אין תוכן'}
          </div>
        </div>

        {/* תגיות */}
        {note.tags.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">תגיות:</h3>
            <div className="flex flex-wrap gap-2">
              {note.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* כפתורי פעולה */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <Button onClick={handleEdit} className="flex-1">
            ✎ ערוך פתק
          </Button>
          <Button variant="danger" onClick={handleDelete} className="flex-1">
            🗑 מחק פתק
          </Button>
          <Button variant="secondary" onClick={onClose} className="flex-1">
            ✕ סגור
          </Button>
        </div>
      </div>
    </Modal>
  );
};
