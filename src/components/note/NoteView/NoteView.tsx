/**
 * קומפוננטה להצגת פתק מלא במודאל
 * תומכת בעריכה ישירה (inline editing) - כמו Google Keep
 */

import { useState } from 'react';
import { Note } from '@/types/note';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { EnhancedTextarea } from '@/components/common/EnhancedTextarea';
import { AccountingTemplate } from '@/components/note/templates/AccountingTemplate';
import { ChecklistTemplate } from '@/components/note/templates/ChecklistTemplate';
import { RecipeTemplate } from '@/components/note/templates/RecipeTemplate';
import { ShoppingTemplate } from '@/components/note/templates/ShoppingTemplate';
import { WorkPlanTemplate } from '@/components/note/templates/WorkPlanTemplate';
import { shareViaWhatsApp, shareViaEmail, copyToClipboard, shareViaNative } from '@/utils/share';

interface NoteViewProps {
  note: Note;
  onClose: () => void;
  onEdit: (note: Note) => void;
  onDelete: (noteId: string) => void;
  onTogglePin?: (noteId: string, isPinned: boolean) => void;
  onUpdate?: (noteId: string, updates: { title?: string; content?: string }) => void;
}

export const NoteView: React.FC<NoteViewProps> = ({
  note,
  onClose,
  onEdit,
  onDelete,
  onTogglePin,
  onUpdate,
}) => {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);

  const handleDelete = () => {
    if (window.confirm('האם אתה בטוח שברצונך להעביר פתק זה לארכיון?\n\nתוכל לשחזר אותו מהארכיון במידת הצורך.')) {
      onDelete(note.id);
      onClose();
    }
  };

  const handleTogglePin = () => {
    if (onTogglePin) {
      onTogglePin(note.id, !note.isPinned);
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (onUpdate) {
      onUpdate(note.id, { title: newTitle });
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    if (onUpdate) {
      onUpdate(note.id, { content: newContent });
    }
  };

  const handleShare = async () => {
    // ניסיון להשתמש ב-Web Share API במובייל
    const nativeShareSuccess = await shareViaNative(note);
    if (nativeShareSuccess) {
      return;
    }

    // אם לא עבד, הצג תפריט שיתוף
    setShowShareMenu(!showShareMenu);
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(note);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="max-h-[80vh] overflow-y-auto">
        {/* כותרת */}
        <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200">
          <div className="flex-1">
            <Input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="text-2xl font-bold text-gray-800 mb-2 border-none focus:ring-2 focus:ring-blue-300 rounded px-2"
              placeholder="כותרת הפתק..."
            />
            <div className="flex items-center gap-2 text-sm text-gray-500 px-2">
              <span>
                {note.templateType === 'plain' && '📝 טקסט'}
                {note.templateType === 'checklist' && '✅ משימות'}
                {note.templateType === 'recipe' && '🍳 מתכון'}
                {note.templateType === 'shopping' && '🛒 קניות'}
                {note.templateType === 'workplan' && '📋 תכנית עבודה'}
                {note.templateType === 'accounting' && '💰 חשבונאות'}
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
          {note.templateType === 'accounting' ? (
            <AccountingTemplate value={content} onChange={handleContentChange} readOnly={false} />
          ) : note.templateType === 'checklist' ? (
            <ChecklistTemplate value={content} onChange={handleContentChange} readOnly={false} />
          ) : note.templateType === 'recipe' ? (
            <RecipeTemplate value={content} onChange={handleContentChange} readOnly={false} />
          ) : note.templateType === 'shopping' ? (
            <ShoppingTemplate value={content} onChange={handleContentChange} readOnly={false} />
          ) : note.templateType === 'workplan' ? (
            <WorkPlanTemplate value={content} onChange={handleContentChange} readOnly={false} />
          ) : (
            <EnhancedTextarea
              value={content}
              onChange={handleContentChange}
              placeholder="הזן תוכן..."
              rows={8}
              className="min-h-[200px]"
            />
          )}
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

        {/* כפתורי שיתוף */}
        {showShareMenu && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">שתף פתק:</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  shareViaWhatsApp(note);
                  setShowShareMenu(false);
                }}
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
              >
                <span className="text-green-600">📱</span>
                WhatsApp
              </Button>
              <Button
                onClick={() => {
                  shareViaEmail(note);
                  setShowShareMenu(false);
                }}
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
              >
                <span>📧</span>
                אימייל
              </Button>
              <Button
                onClick={handleCopy}
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
              >
                <span>{copySuccess ? '✓' : '📋'}</span>
                {copySuccess ? 'הועתק!' : 'העתק'}
              </Button>
            </div>
          </div>
        )}

        {/* כפתורי פעולה */}
        <div className="flex flex-col gap-2 pt-4 border-t border-gray-200">
          <div className="flex gap-2">
            <Button onClick={handleShare} variant="outline" className="flex-1">
              🔗 שתף
            </Button>
            <Button variant="danger" onClick={handleDelete} className="flex-1">
              🗑 מחק
            </Button>
          </div>
          <Button variant="secondary" onClick={onClose} className="w-full">
            ✕ סגור
          </Button>
        </div>
      </div>
    </Modal>
  );
};
