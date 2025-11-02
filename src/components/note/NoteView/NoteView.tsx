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
import { FormattedText } from '@/components/common/FormattedText';
import { AccountingTemplate } from '@/components/note/templates/AccountingTemplate';
import { ChecklistTemplate } from '@/components/note/templates/ChecklistTemplate';
import { RecipeTemplate } from '@/components/note/templates/RecipeTemplate';
import { ShoppingTemplate } from '@/components/note/templates/ShoppingTemplate';
import { WorkPlanTemplate } from '@/components/note/templates/WorkPlanTemplate';
import { ShareManagement } from '@/components/common/ShareManagement';
import { shareViaWhatsApp, shareViaEmail, copyToClipboard, shareViaNative } from '@/utils/share';
import { useAuthStore } from '@/store/authStore';
import * as noteAPI from '@/services/api/notes';

interface NoteViewProps {
  note: Note;
  onClose: () => void;
  onDelete: (noteId: string) => void;
  onTogglePin?: (noteId: string, isPinned: boolean) => void;
  onUpdate?: (noteId: string, updates: { title?: string; content?: string }) => void;
  onMoveToCategory?: (noteId: string, newCategoryId: string) => void;
  categories?: Array<{ id: string; name: string; icon: string }>;
}

export const NoteView: React.FC<NoteViewProps> = ({
  note,
  onClose,
  onDelete,
  onTogglePin,
  onUpdate,
  onMoveToCategory,
  categories = [],
}) => {
  const { user } = useAuthStore();
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showShareManagement, setShowShareManagement] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [isEditMode, setIsEditMode] = useState(false);

  // Check if user is the owner of the note
  const isOwner = user && note.userId === user.uid;
  const isShared = note.sharedWith && note.sharedWith.length > 0;

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

  const handleMoveToCategory = (newCategoryId: string) => {
    if (onMoveToCategory && newCategoryId !== note.categoryId) {
      onMoveToCategory(note.id, newCategoryId);
      setShowMoveMenu(false);
      onClose();
    }
  };

  const handleShareNote = async (email: string) => {
    try {
      await noteAPI.shareNoteWithUser(note.id, email);
    } catch (error) {
      throw error;
    }
  };

  const handleUnshareNote = async (userId: string) => {
    try {
      await noteAPI.unshareNoteWithUser(note.id, userId);
    } catch (error) {
      throw error;
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="max-h-[80vh] overflow-y-auto">
        {/* כפתור חזרה */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
          title="חזרה"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        {/* כותרת */}
        <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700 pt-12">
          <div className="flex-1">
            <Input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2 border-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 rounded px-2 dark:bg-gray-800"
              placeholder="כותרת הפתק..."
            />
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 px-2">
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">תוכן:</h3>
            {note.templateType === 'plain' && (
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className="text-sm px-3 py-1 rounded-md bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              >
                {isEditMode ? '👁️ צפייה' : '✏️ עריכה'}
              </button>
            )}
          </div>
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
          ) : isEditMode ? (
            <EnhancedTextarea
              value={content}
              onChange={handleContentChange}
              placeholder="הזן תוכן..."
              rows={8}
              className="min-h-[200px]"
            />
          ) : (
            <FormattedText content={content} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg min-h-[200px]" />
          )}
        </div>

        {/* תגיות */}
        {note.tags.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">תגיות:</h3>
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
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">שתף פתק:</h3>
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

        {/* תפריט העברה לקטגוריה */}
        {showMoveMenu && categories.length > 0 && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">העבר לקטגוריה:</h3>
            <div className="grid grid-cols-2 gap-2">
              {categories
                .filter(cat => cat.id !== note.categoryId)
                .map((category) => (
                  <Button
                    key={category.id}
                    onClick={() => handleMoveToCategory(category.id)}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2 justify-start"
                  >
                    <span className="text-lg">{category.icon}</span>
                    <span className="truncate">{category.name}</span>
                  </Button>
                ))}
            </div>
          </div>
        )}

        {/* כפתורי פעולה */}
        <div className="flex flex-col gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            <Button onClick={handleShare} variant="outline" className="flex-1">
              🔗 שתף
            </Button>
            {isOwner && (
              <Button
                onClick={() => setShowShareManagement(true)}
                variant="outline"
                className={`flex-1 ${
                  isShared ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : ''
                }`}
              >
                {isShared ? `👥 ${note.sharedWith.length}` : '👥 שיתוף'}
              </Button>
            )}
            {!isOwner && isShared && (
              <span className="flex-1 px-3 py-2 text-xs sm:text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-medium flex items-center justify-center">
                👥 משותף
              </span>
            )}
            {onMoveToCategory && categories.length > 1 && (
              <Button onClick={() => setShowMoveMenu(!showMoveMenu)} variant="outline" className="flex-1">
                📁 העבר
              </Button>
            )}
            <Button variant="danger" onClick={handleDelete} className="flex-1">
              🗑 מחק
            </Button>
          </div>
          <Button variant="secondary" onClick={onClose} className="w-full">
            ✕ סגור
          </Button>
        </div>
      </div>

      {/* ניהול שיתוף */}
      {showShareManagement && (
        <ShareManagement
          itemType="note"
          itemId={note.id}
          itemName={note.title}
          currentSharedWith={note.sharedWith || []}
          onShare={handleShareNote}
          onUnshare={handleUnshareNote}
          onClose={() => setShowShareManagement(false)}
        />
      )}
    </Modal>
  );
};
