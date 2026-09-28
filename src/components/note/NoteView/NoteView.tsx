/**
 * הצגת פתק מלא במודאל, עם עריכה ישירה (inline)
 *
 * שמירה: העריכה משתמשת ב-debounce. בגרסה קודמת כל הקשה על מקש יצרה
 * כתיבה נפרדת ל-Firestore - כלומר משפט אחד היה עולה עשרות כתיבות,
 * ומרוץ מול המאזין בזמן אמת. כעת השינויים נצברים ונשמרים פעם אחת
 * אחרי הפסקה בהקלדה, ובכל מקרה בסגירת המודאל.
 *
 * דריסה (C-1): הטיוטה, השמירה וההאזנה לשינויים מרחוק ב-`useNoteSync`.
 * שינוי שהגיע מבחוץ מאומץ, ממוזג, או מוביל לבחירה של המשתמש - אף פעם
 * לא נדרס בשקט.
 */

import { useState } from 'react';
import { Eye, Lock, PenOff, Pencil, Sparkles, X } from 'lucide-react';
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
import { NoteHistory } from '@/components/note/NoteHistory/NoteHistory';
import type { NoteVersion } from '@/types/version';
import { shareViaWhatsApp, shareViaEmail, copyToClipboard, shareViaNative } from '@/utils/share';
import { useAuthStore } from '@/store/authStore';
import { useNoteSync } from '@/hooks/useNoteSync';
import { useNotePresence } from '@/hooks/useNotePresence';
import { presenceMessage } from '@/utils/presence';
import { LENGTH_LIMITS } from '@/utils/constants';
import { DiscardedTextPanel, NoteConflictPanel } from './NoteConflict';
import { getTemplateLabel, getTemplateMeta } from '@/utils/templates';
import * as noteAPI from '@/services/api/notes';
import { getErrorMessage } from '@/utils/errors';

interface NoteViewProps {
  note: Note;
  onClose: () => void;
  /** ארכוב - רק לבעלים. מי שאינו בעלים מקבל "הסר אותי" במקומו */
  onDelete?: (noteId: string) => void;
  onTogglePin?: (noteId: string, isPinned: boolean) => void;
  onMoveToCategory?: (noteId: string, newCategoryId: string) => void;
  categories?: Array<{ id: string; name: string; icon: string; isSensitive?: boolean; isReadOnly?: boolean }>;
}

/** תבניות שהתוכן שלהן נערך כטקסט ולכן יש להן מתג צפייה/עריכה */
const TOGGLEABLE_TEMPLATES = new Set(['plain', 'checklist', 'workplan']);

export const NoteView: React.FC<NoteViewProps> = ({
  note,
  onClose,
  onDelete,
  onTogglePin,
  onMoveToCategory,
  categories = [],
}) => {
  const user = useAuthStore((state) => state.user);
  const TemplateIcon = getTemplateMeta(note.templateType).Icon;
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showShareManagement, setShowShareManagement] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [shownNoteId, setShownNoteId] = useState(note.id);
  const editor = useNoteSync(note);
  const { title, content, conflict } = editor;
  // "פתוח גם במקום אחר": נוחות בלבד. ההגנה מדריסה היא ב-useNoteSync
  const presence = useNotePresence(note.id);
  const openElsewhere = presence.myUid ? presenceMessage(presence.others, presence.myUid) : null;

  // פתק אחר - חוזרים לצפייה (הטיוטה עצמה מתאפסת ב-useNoteSync)
  if (shownNoteId !== note.id) {
    setShownNoteId(note.id);
    setIsEditMode(false);
  }

  // בזמן התנגשות אין עריכה: העורך מציג את הטקסט של המשתמש, קפוא, עד שיבחר
  const editing = isEditMode && !conflict;

  const isOwner = user !== null && note.userId === user.uid;
  const isShared = note.sharedWith.length > 0;

  const handleTitleChange = (newTitle: string) => {
    editor.edit({ title: newTitle.slice(0, LENGTH_LIMITS.NOTE_TITLE) });
  };

  const handleContentChange = (newContent: string) => {
    editor.edit({ content: newContent });
  };

  /**
   * המרת הפתק לטקסט חופשי, כשהתוכן לא תואם לתבנית שלו.
   * התוכן לא משתנה - רק האופן שבו מציגים אותו. נשלח מיד ולא בהשהיה,
   * יחד עם כל שינוי שעוד ממתין.
   */
  const handleConvertToText = () => {
    editor.edit({ templateType: 'plain' });
    editor.flush();
  };

  /**
   * פתיחת ההיסטוריה שומרת קודם את מה שממתין, כדי שהעריכה האחרונה תיכלל
   * בגרסאות ולא תדרוס שחזור שייעשה מתוך החלון.
   */
  const handleOpenHistory = () => {
    editor.flush();
    setShowHistory(true);
  };

  /**
   * אחרי שחזור, הטיוטה המקומית מתחלפת בתוכן המשוחזר. בלי זה העריכה
   * הבאה הייתה שולחת את הטיוטה הישנה - ומבטלת את השחזור בשקט.
   */
  const handleRestored = (_version: NoteVersion) => {
    editor.onRestored();
  };

  /** סוגר את המודאל אחרי ששמר שינוי שממתין */
  const handleClose = () => {
    editor.flush();
    onClose();
  };

  const handleDelete = () => {
    if (
      window.confirm(
        'האם אתה בטוח שברצונך להעביר פתק זה לארכיון?\n\nתוכל לשחזר אותו מהארכיון במידת הצורך.'
      )
    ) {
      editor.cancel();
      onDelete?.(note.id);
      onClose();
    }
  };

  /**
   * נמען שמסיר את עצמו מהשיתוף. מחליף את "מחק" אצל מי שאינו בעלים:
   * מחיקה (ארכוב) של פתק של מישהו אחר היא לא ההחלטה שלו.
   */
  const handleLeave = async () => {
    if (
      !window.confirm(
        `להסיר אותך מהשיתוף של "${note.title || 'ללא כותרת'}"?

הפתק יפסיק להופיע אצלך. הבעלים יוכל לשתף אותו איתך שוב.`
      )
    ) {
      return;
    }

    editor.cancel();
    try {
      await noteAPI.leaveSharedNote(note.id);
      onClose();
    } catch (error) {
      window.alert(getErrorMessage(error));
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

  /** הקטגוריה של הפתק רגישה - ואז הפתק מוסתר מ-Claude גם בלי דגל משלו */
  const categoryIsSensitive =
    categories.find((category) => category.id === note.categoryId)?.isSensitive === true;

  /** הקטגוריה של הפתק לקריאה בלבד ל-Claude - ואז גם הפתק, בלי דגל משלו */
  const categoryIsReadOnly =
    categories.find((category) => category.id === note.categoryId)?.isReadOnly === true;

  /**
   * סימון רגיש (C6). רק לבעלים - ה-rules דוחים את זה משותף. לא יוצר
   * גרסה בהיסטוריה, כי זה לא שינוי תוכן.
   */
  const handleToggleSensitive = async () => {
    editor.flush();
    try {
      await noteAPI.setNoteSensitive(note.id, !note.isSensitive);
    } catch (error) {
      window.alert(getErrorMessage(error));
    }
  };

  /** קריאה בלבד ל-Claude. רק לבעלים (rules), ולא יוצר גרסה */
  const handleToggleReadOnly = async () => {
    editor.flush();
    try {
      await noteAPI.setNoteReadOnly(note.id, !note.isReadOnly);
    } catch (error) {
      window.alert(getErrorMessage(error));
    }
  };

  const handleMoveToCategory = (newCategoryId: string) => {
    if (!onMoveToCategory || newCategoryId === note.categoryId) return;

    // הרגישות נגזרת מהקטגוריה: העברה לקטגוריה רגילה חושפת את הפתק
    // ל-Claude, אלא אם יש לו דגל משלו (§12.1 בסקירה)
    const target = categories.find((category) => category.id === newCategoryId);
    if (
      categoryIsSensitive &&
      !note.isSensitive &&
      !target?.isSensitive &&
      !window.confirm(
        'הפתק עובר מקטגוריה רגישה לקטגוריה רגילה, ויהיה גלוי ל-Claude.\n\nכדי שיישאר מוסתר, סמנו אותו כרגיש לפני ההעברה. להמשיך בכל זאת?'
      )
    ) {
      return;
    }

    editor.flush();
    onMoveToCategory(note.id, newCategoryId);
    setShowMoveMenu(false);
    onClose();
  };

  const renderContent = () => {
    switch (note.templateType) {
      case 'accounting':
        return (
          <AccountingTemplate
            value={content}
            onChange={handleContentChange}
            readOnly={Boolean(conflict)}
            onConvertToText={handleConvertToText}
          />
        );
      case 'checklist':
        return (
          <ChecklistTemplate
            value={content}
            onChange={handleContentChange}
            readOnly={!editing}
            onConvertToText={handleConvertToText}
          />
        );
      case 'recipe':
        return (
          <RecipeTemplate
            value={content}
            onChange={handleContentChange}
            readOnly={Boolean(conflict)}
            onConvertToText={handleConvertToText}
          />
        );
      case 'shopping':
        return (
          <ShoppingTemplate
            value={content}
            onChange={handleContentChange}
            readOnly={Boolean(conflict)}
            onConvertToText={handleConvertToText}
          />
        );
      case 'workplan':
        return (
          <WorkPlanTemplate
            value={content}
            onChange={handleContentChange}
            readOnly={!editing}
            onConvertToText={handleConvertToText}
          />
        );
      default:
        return editing ? (
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
              {(note.isSensitive || categoryIsSensitive) && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1" title="מוסתר מ-Claude">
                    <Lock size={14} strokeWidth={2} />
                    רגיש
                  </span>
                </>
              )}
              {(note.isReadOnly || categoryIsReadOnly) && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1" title="Claude יכול לקרוא, לא לשנות">
                    <PenOff size={14} strokeWidth={2} />
                    קריאה בלבד ל-Claude
                  </span>
                </>
              )}
              {note.createdVia === 'mcp' && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-brand dark:text-brand-dark">
                    <Sparkles size={14} strokeWidth={2} />
                    נוצר ע״י Claude
                  </span>
                </>
              )}
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

        {openElsewhere && (
          <div
            role="status"
            className="mb-4 rounded-lg bg-brand-soft dark:bg-brand-soft-dark text-brand-text dark:text-brand-text-dark p-3 text-sm"
          >
            👥 {openElsewhere} שינויים של כל צד יופיעו אצל השני. אם שניכם תשנו את אותו מקום, תתבקשו לבחור איזו גרסה
            לשמור.
          </div>
        )}

        {/* התנגשות עם שינוי מרחוק (C-1): השמירה עצרה, המשתמש בוחר */}
        {conflict && <NoteConflictPanel onReload={editor.reloadRemote} onSaveMine={editor.saveMineAsNew} />}
        {editor.discarded && (
          <DiscardedTextPanel
            text={editor.discarded}
            templateType={note.templateType}
            onDismiss={editor.dismissDiscarded}
          />
        )}

        {/* תוכן */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-ink-light dark:text-ink-dark">תוכן:</h3>
            {TOGGLEABLE_TEMPLATES.has(note.templateType) && (
              <button
                onClick={() => setIsEditMode((previous) => !previous)}
                className="inline-flex items-center gap-1.5 text-body-sm h-9 px-4 rounded-lg bg-raised-light dark:bg-raised-dark border border-hairline-light dark:border-hairline-dark text-ink-light dark:text-ink-dark hover:bg-hairline-light dark:hover:bg-hairline-dark transition-colors font-medium"
              >
                {editing ? (
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

        {/* רגיש - רק הבעלים מסמן (C6) */}
        {isOwner && (
          <label className="flex items-start gap-3 mb-4 p-3 rounded-lg bg-raised-light dark:bg-raised-dark cursor-pointer">
            <input
              type="checkbox"
              checked={note.isSensitive}
              onChange={handleToggleSensitive}
              className="mt-1 h-4 w-4 accent-brand"
            />
            <span className="text-body-sm text-ink-light dark:text-ink-dark">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Lock size={14} strokeWidth={2} />
                רגיש - מוסתר מ-Claude
              </span>
              <span className="block text-caption text-ink-3-light dark:text-ink-3-dark mt-1">
                Claude לא יראה את הפתק הזה בכלל. מה שכבר נקרא בשיחה קודמת לא נמחק ממנה, וזו לא
                הצפנה - הפתק נשמר כרגיל.
              </span>
              {!note.isSensitive && categoryIsSensitive && (
                <span className="block text-caption text-ink-3-light dark:text-ink-3-dark mt-1">
                  הפתק כבר מוסתר, כי הקטגוריה שלו מסומנת כרגישה.
                </span>
              )}
            </span>
          </label>
        )}

        {/* קריאה בלבד ל-Claude - רק הבעלים מסמן */}
        {isOwner && (
          <label className="flex items-start gap-3 mb-4 p-3 rounded-lg bg-raised-light dark:bg-raised-dark cursor-pointer">
            <input
              type="checkbox"
              checked={note.isReadOnly}
              onChange={handleToggleReadOnly}
              className="mt-1 h-4 w-4 accent-brand"
            />
            <span className="text-body-sm text-ink-light dark:text-ink-dark">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <PenOff size={14} strokeWidth={2} />
                קריאה בלבד ל-Claude
              </span>
              <span className="block text-caption text-ink-3-light dark:text-ink-3-dark mt-1">
                Claude יכול לקרוא את הפתק אבל לא לשנות אותו. באפליקציה הוא נשאר ניתן לעריכה.
              </span>
              {!note.isReadOnly && categoryIsReadOnly && (
                <span className="block text-caption text-ink-3-light dark:text-ink-3-dark mt-1">
                  הפתק כבר לקריאה בלבד, כי הקטגוריה שלו מסומנת כך.
                </span>
              )}
            </span>
          </label>
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
            {/* העברה - רק לבעלים. ה-rules דוחים העברה משותף (C6 / SH-2) */}
            {isOwner && onMoveToCategory && categories.length > 1 && (
              <Button
                onClick={() => setShowMoveMenu((previous) => !previous)}
                variant="outline"
                className="flex-1"
              >
                📁 העבר
              </Button>
            )}
            {isOwner ? (
              <Button variant="danger" onClick={handleDelete} className="flex-1">
                🗑 מחק
              </Button>
            ) : (
              <Button variant="danger" onClick={handleLeave} className="flex-1">
                🚪 הסר אותי
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={handleOpenHistory} className="w-full">
            🕘 היסטוריה
          </Button>
          <Button variant="secondary" onClick={handleClose} className="w-full">
            ✕ סגור
          </Button>
        </div>
      </div>

      {showHistory && (
        <NoteHistory note={note} onClose={() => setShowHistory(false)} onRestored={handleRestored} />
      )}

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
