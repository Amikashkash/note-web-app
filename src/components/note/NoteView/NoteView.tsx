/**
 * הצגת פתק מלא במודאל, עם עריכה ישירה (inline)
 *
 * שמירה: העריכה משתמשת ב-debounce. בגרסה קודמת כל הקשה על מקש יצרה
 * כתיבה נפרדת ל-Firestore - כלומר משפט אחד היה עולה עשרות כתיבות,
 * ומרוץ מול המאזין בזמן אמת. כעת השינויים נצברים ונשמרים פעם אחת
 * אחרי הפסקה בהקלדה, ובכל מקרה בסגירת המודאל.
 */

import { useState } from 'react';
import { Eye, Pencil, X } from 'lucide-react';
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
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { AUTOSAVE_DELAY_MS, LENGTH_LIMITS } from '@/utils/constants';
import { getTemplateLabel, getTemplateMeta } from '@/utils/templates';
import * as noteAPI from '@/services/api/notes';

export interface NoteUpdates {
  title?: string;
  content?: string;
}

interface NoteViewProps {
  note: Note;
  onClose: () => void;
  onDelete: (noteId: string) => void;
  onTogglePin?: (noteId: string, isPinned: boolean) => void;
  onUpdate?: (noteId: string, updates: NoteUpdates) => void;
  onMoveToCategory?: (noteId: string, newCategoryId: string) => void;
  categories?: Array<{ id: string; name: string; icon: string }>;
}

/** תבניות שהתוכן שלהן נערך כטקסט ולכן יש להן מתג צפייה/עריכה */
const TOGGLEABLE_TEMPLATES = new Set(['plain', 'checklist', 'workplan']);

export const NoteView: React.FC<NoteViewProps> = ({
  note,
  onClose,
  onDelete,
  onTogglePin,
  onUpdate,
  onMoveToCategory,
  categories = [],
}) => {
  const user = useAuthStore((state) => state.user);
  const TemplateIcon = getTemplateMeta(note.templateType).Icon;
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showShareManagement, setShowShareManagement] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [isEditMode, setIsEditMode] = useState(false);
  const [draftNoteId, setDraftNoteId] = useState(note.id);

  // כשמוצג פתק אחר - מאתחלים את הטיוטה המקומית.
  // האיפוס נעשה בזמן הרינדור ולא ב-effect, כך שאין רינדור ביניים
  // שמציג את הפתק החדש עם הטקסט של הקודם.
  //
  // מסתנכרנים לפי מזהה הפתק בלבד: עדכון שמגיע מהמאזין בזמן אמת
  // לא אמור לדרוס טקסט שהמשתמש מקליד ברגע זה.
  if (draftNoteId !== note.id) {
    setDraftNoteId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setIsEditMode(false);
  }

  const isOwner = user !== null && note.userId === user.uid;
  const isShared = note.sharedWith.length > 0;

  const saveUpdates = useDebouncedCallback((updates: NoteUpdates) => {
    onUpdate?.(note.id, updates);
  }, AUTOSAVE_DELAY_MS);

  const handleTitleChange = (newTitle: string) => {
    const trimmed = newTitle.slice(0, LENGTH_LIMITS.NOTE_TITLE);
    setTitle(trimmed);
    saveUpdates.call({ title: trimmed });
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    saveUpdates.call({ content: newContent });
  };

  /** סוגר את המודאל אחרי ששמר שינוי שממתין */
  const handleClose = () => {
    saveUpdates.flush();
    onClose();
  };

  const handleDelete = () => {
    if (
      window.confirm(
        'האם אתה בטוח שברצונך להעביר פתק זה לארכיון?\n\nתוכל לשחזר אותו מהארכיון במידת הצורך.'
      )
    ) {
      saveUpdates.cancel();
      onDelete(note.id);
      onClose();
    }
  };

  const handleShare = async () => {
    const sharedNatively = await shareViaNative(note);
    if (!sharedNatively) {
      setShowShareMenu((previous) => !previous);
    }
  };

  const handleCopy = async () => {
    if (await copyToClipboard(note)) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleMoveToCategory = (newCategoryId: string) => {
    if (!onMoveToCategory || newCategoryId === note.categoryId) return;

    saveUpdates.flush();
    onMoveToCategory(note.id, newCategoryId);
    setShowMoveMenu(false);
    onClose();
  };

  const renderContent = () => {
    switch (note.templateType) {
      case 'accounting':
        return <AccountingTemplate value={content} onChange={handleContentChange} readOnly={false} />;
      case 'checklist':
        return <ChecklistTemplate value={content} onChange={handleContentChange} readOnly={!isEditMode} />;
      case 'recipe':
        return <RecipeTemplate value={content} onChange={handleContentChange} readOnly={false} />;
      case 'shopping':
        return <ShoppingTemplate value={content} onChange={handleContentChange} readOnly={false} />;
      case 'workplan':
        return <WorkPlanTemplate value={content} onChange={handleContentChange} readOnly={!isEditMode} />;
      default:
        return isEditMode ? (
          <EnhancedTextarea
            value={content}
            onChange={handleContentChange}
            placeholder="הזן תוכן..."
            rows={8}
            className="min-h-[200px]"
          />
        ) : (
          <FormattedText
            content={content}
            className="p-4 bg-raised-light dark:bg-raised-dark rounded-lg min-h-[200px]"
          />
        );
    }
  };

  return (
    <Modal onClose={handleClose}>
      <div className="max-h-[80vh] overflow-y-auto">
        {/* `end-4` ולא `right-4`: בעברית הסגירה שייכת לקצה שבו השורה
            נגמרת. כפתור סגירה עדין ולא צבעוני - הוא כרום, לא פעולה. */}
        <button
          onClick={handleClose}
          className="absolute top-4 end-4 z-10 h-11 w-11 grid place-items-center rounded-xl text-ink-3-light dark:text-ink-3-dark hover:text-ink-light dark:hover:text-ink-dark hover:bg-raised-light dark:hover:bg-raised-dark transition-colors"
          title="סגור"
        >
          <X size={24} strokeWidth={2} />
        </button>

        {/* כותרת */}
        <div className="flex items-start justify-between mb-4 pb-4 border-b border-hairline-light dark:border-hairline-dark pt-12">
          <div className="flex-1">
            <Input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              maxLength={LENGTH_LIMITS.NOTE_TITLE}
              className="text-2xl font-bold text-ink-light dark:text-ink-dark mb-2 border-none focus:ring-2 focus:ring-brand/40 dark:focus:ring-brand-dark/40 rounded px-2 dark:bg-surface-dark"
              placeholder="כותרת הפתק..."
            />
            <div className="flex items-center gap-2 text-body-sm text-ink-3-light dark:text-ink-3-dark px-2">
              <span className="inline-flex items-center gap-1.5">
                <TemplateIcon size={16} strokeWidth={1.75} />
                {getTemplateLabel(note.templateType)}
              </span>
              <span>•</span>
              <span>
                {note.updatedAt.toDate().toLocaleDateString('he-IL', {
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
              onClick={() => onTogglePin(note.id, !note.isPinned)}
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
            <h3 className="text-lg font-semibold text-ink-light dark:text-ink-dark">תוכן:</h3>
            {TOGGLEABLE_TEMPLATES.has(note.templateType) && (
              <button
                onClick={() => setIsEditMode((previous) => !previous)}
                className="inline-flex items-center gap-1.5 text-body-sm h-9 px-4 rounded-lg bg-raised-light dark:bg-raised-dark border border-hairline-light dark:border-hairline-dark text-ink-light dark:text-ink-dark hover:bg-hairline-light dark:hover:bg-hairline-dark transition-colors font-medium"
              >
                {isEditMode ? (
                  <>
                    <Eye size={16} strokeWidth={1.75} />
                    צפייה
                  </>
                ) : (
                  <>
                    <Pencil size={16} strokeWidth={1.75} />
                    עריכה
                  </>
                )}
              </button>
            )}
          </div>
          {renderContent()}
        </div>

        {/* תגיות */}
        {note.tags.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-ink-light dark:text-ink-dark mb-3">תגיות:</h3>
            <div className="flex flex-wrap gap-2">
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 bg-brand-soft dark:bg-brand-soft-dark text-brand-text dark:text-brand-text-dark text-sm rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* תפריט שיתוף חיצוני */}
        {showShareMenu && (
          <div className="mb-4 p-4 bg-raised-light dark:bg-raised-dark rounded-lg border border-hairline-light dark:border-hairline-dark">
            <h3 className="text-sm font-semibold text-ink-light dark:text-ink-dark mb-3">שתף פתק:</h3>
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
                <span className="text-success dark:text-success-dark">📱</span>
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
              <Button onClick={handleCopy} size="sm" variant="outline" className="flex items-center gap-2">
                <span>{copySuccess ? '✓' : '📋'}</span>
                {copySuccess ? 'הועתק!' : 'העתק'}
              </Button>
            </div>
          </div>
        )}

        {/* העברה לקטגוריה */}
        {showMoveMenu && categories.length > 0 && (
          <div className="mb-4 p-4 bg-raised-light dark:bg-raised-dark rounded-lg border border-hairline-light dark:border-hairline-dark">
            <h3 className="text-sm font-semibold text-ink-light dark:text-ink-dark mb-3">
              העבר לקטגוריה:
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {categories
                .filter((category) => category.id !== note.categoryId)
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

        {/* פעולות */}
        <div className="flex flex-col gap-2 pt-4 border-t border-hairline-light dark:border-hairline-dark">
          <div className="flex gap-2">
            <Button onClick={handleShare} variant="outline" className="flex-1">
              🔗 שתף
            </Button>
            {isOwner && (
              <Button
                onClick={() => setShowShareManagement(true)}
                variant="outline"
                className={`flex-1 ${
                  isShared ? 'bg-success/10 text-success dark:text-success-dark' : ''
                }`}
              >
                {isShared ? `👥 ${note.sharedWith.length}` : '👥 שיתוף'}
              </Button>
            )}
            {!isOwner && isShared && (
              <span className="flex-1 px-3 py-2 text-xs sm:text-sm bg-brand-soft dark:bg-brand-soft-dark text-brand-text dark:text-brand-text-dark rounded font-medium flex items-center justify-center">
                👥 משותף
              </span>
            )}
            {onMoveToCategory && categories.length > 1 && (
              <Button
                onClick={() => setShowMoveMenu((previous) => !previous)}
                variant="outline"
                className="flex-1"
              >
                📁 העבר
              </Button>
            )}
            <Button variant="danger" onClick={handleDelete} className="flex-1">
              🗑 מחק
            </Button>
          </div>
          <Button variant="secondary" onClick={handleClose} className="w-full">
            ✕ סגור
          </Button>
        </div>
      </div>

      {showShareManagement && (
        <ShareManagement
          itemType="note"
          itemId={note.id}
          itemName={note.title}
          currentSharedWith={note.sharedWith}
          onShare={(email) => noteAPI.shareNoteWithUser(note.id, email)}
          onUnshare={(userId) => noteAPI.unshareNoteWithUser(note.id, userId)}
          onClose={() => setShowShareManagement(false)}
        />
      )}
    </Modal>
  );
};
