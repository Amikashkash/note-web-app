/**
 * שורת קטגוריה באקורדיון של מסך הבית (סבב 3, v1.40.0).
 *
 * מקופלת: שם, מספר הפתקים, ושורה שנייה עם כותרת הפתק שעודכן אחרון.
 * פתוחה: שורת פעולות (שיתוף / יציאה משיתוף, דף מלא) וכרטיסי הפתקים (`NoteCardList`).
 * כפתור "+ פתק" לכל קטגוריה הוסר - יש "+" אחד במסך (`CategoryList`).
 *
 * גרירה לשינוי הסדר: בכל השורה העליונה. במגע רק אחרי לחיצה ארוכה, ולכן
 * `touch-manipulation` ולא `touch-none` - גלילה שמתחילה על שורה גוללת.
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronLeft, Lock, LogOut, Maximize2, PenOff, Share2, Users } from 'lucide-react';
import type { Category } from '@/types';
import type { Note } from '@/types/note';
import { useNoteEditor } from '@/hooks/useNoteEditor';
import { useAuthStore } from '@/store/authStore';
import { useCategoryStore } from '@/store/categoryStore';
import { NoteCardList } from '@/components/note/NoteCardList';
import { NoteView } from '@/components/note/NoteView';
import { ShareManagement } from '@/components/common/ShareManagement';
import { filterNotesByQuery } from '@/utils/search';
import { getErrorMessage } from '@/utils/errors';
import { latestNote } from '@/utils/homeAccordion';
import * as categoryAPI from '@/services/api/categories';

interface CategoryItemProps {
  category: Category;
  searchQuery?: string;
  /** פתוחה באקורדיון. בזמן חיפוש מתעלמים מזה: כל קטגוריה עם תוצאות פתוחה */
  isOpen: boolean;
  onToggle: () => void;
  /** בזמן חיפוש (ובקטגוריה יחידה) אין גרירה */
  dragDisabled: boolean;
}

export const CategoryItem: React.FC<CategoryItemProps> = ({
  category,
  searchQuery = '',
  isOpen,
  onToggle,
  dragDisabled,
}) => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const categories = useCategoryStore((state) => state.categories);

  const { notes, moveToCategory, deleteNote, pinNote, reorder } = useNoteEditor(category.id);

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id, disabled: dragDisabled });

  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [showShareManagement, setShowShareManagement] = useState(false);

  const categoryNotes = useMemo(() => filterNotesByQuery(notes, searchQuery), [notes, searchQuery]);
  const latest = useMemo(() => latestNote(categoryNotes), [categoryNotes]);

  const categoriesForMove = useMemo(
    () =>
      categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        icon: cat.icon || '📁',
        isSensitive: cat.isSensitive,
        isReadOnly: cat.isReadOnly,
      })),
    [categories]
  );

  const hasSearch = searchQuery.trim().length > 0;
  const expanded = hasSearch ? categoryNotes.length > 0 : isOpen;

  // הפתק המוצג במודאל נלקח מהרשימה החיה, כדי שיתעדכן בזמן אמת
  const activeNote = viewingNote ? notes.find((note) => note.id === viewingNote.id) ?? viewingNote : null;

  const isOwner = user !== null && category.userId === user.uid;
  const isShared = category.sharedWith.length > 0;

  /**
   * נמען שיוצא מקטגוריה משותפת. יוצא גם מהפתקים שבה, כי שיתוף קטגוריה
   * משותף בפועל פתק-פתק (ראה `leaveSharedCategory`).
   */
  const handleLeaveCategory = async () => {
    if (
      !window.confirm(
        `לצאת מהקטגוריה המשותפת "${category.name}"?

הקטגוריה והפתקים שבה יפסיקו להופיע אצלך. הבעלים יוכל לשתף אותם איתך שוב.`
      )
    ) {
      return;
    }
    try {
      await categoryAPI.leaveSharedCategory(category.id);
    } catch (error) {
      window.alert(getErrorMessage(error));
    }
  };

  // בחיפוש ללא תוצאות - הקטגוריה לא מוצגת כלל
  if (hasSearch && categoryNotes.length === 0) {
    return null;
  }

  const countLabel = hasSearch ? `${categoryNotes.length} תוצאות` : `${categoryNotes.length} פתקים`;

  return (
    <div
      ref={setNodeRef}
      style={{
        // תכונה לוגית: בעברית `borderRight` צייר את הפס בקצה שבו השורה נגמרת
        borderInlineStartColor: category.color,
        transform: CSS.Translate.toString(transform),
        transition,
        position: 'relative',
        zIndex: isDragging ? 20 : undefined,
      }}
      className={`bg-surface-light dark:bg-surface-dark rounded-xl border border-hairline-light dark:border-hairline-dark border-s-4 transition-shadow ${
        isDragging ? 'shadow-e3' : expanded ? 'shadow-e2' : 'shadow-e1'
      }`}
    >
      {/* השורה העליונה: לחיצה פותחת/סוגרת, לחיצה ארוכה גוררת */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        onClick={onToggle}
        aria-expanded={expanded}
        // `attributes` של dnd-kit נותנים role="button" ותיאור לקורא מסך; הכותרת היא
        // גם כפתור הפתיחה, ולכן התיאור מזכיר את שניהם
        className="w-full flex items-center gap-3 px-4 py-3 min-h-[4.5rem] text-start rounded-xl touch-manipulation select-none [-webkit-touch-callout:none] hover:bg-raised-light/60 dark:hover:bg-raised-dark/60 transition-colors"
      >
        {category.icon && (
          <span className="text-2xl leading-none flex-shrink-0" aria-hidden="true">
            {category.icon}
          </span>
        )}
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-h2 text-ink-light dark:text-ink-dark truncate">{category.name}</span>
            {/* סימני מצב - רק מה שנכון עכשיו */}
            {category.isSensitive && (
              <Lock
                size={16}
                strokeWidth={2}
                className="flex-shrink-0 text-ink-3-light dark:text-ink-3-dark"
                aria-label="רגישה - מוסתרת מ-Claude"
              />
            )}
            {category.isReadOnly && (
              <PenOff
                size={16}
                strokeWidth={2}
                className="flex-shrink-0 text-ink-3-light dark:text-ink-3-dark"
                aria-label="קריאה בלבד ל-Claude"
              />
            )}
            {isShared && (
              <Users
                size={16}
                strokeWidth={2}
                className="flex-shrink-0 text-ink-3-light dark:text-ink-3-dark"
                aria-label={isOwner ? `משותפת עם ${category.sharedWith.length}` : 'שותפה איתך'}
              />
            )}
            <span className="ms-auto flex-shrink-0 text-body-sm text-ink-3-light dark:text-ink-3-dark">
              {countLabel}
            </span>
          </span>
          <span className="block mt-0.5 text-body-sm text-ink-2-light dark:text-ink-2-dark truncate">
            {latest ? latest.title || 'ללא כותרת' : 'אין פתקים עדיין'}
          </span>
        </span>
        {/* מקופל מצביע שמאלה: ב-RTL כיוון ההמשך הוא שמאלה, וחץ ימינה היה קורא כ"חזור" */}
        {expanded ? (
          <ChevronDown size={20} strokeWidth={1.75} className="flex-shrink-0 text-ink-3-light dark:text-ink-3-dark" />
        ) : (
          <ChevronLeft size={20} strokeWidth={1.75} className="flex-shrink-0 text-ink-3-light dark:text-ink-3-dark" />
        )}
      </button>

      {expanded && (
        <div className="paper-on-surface px-4 pb-4 border-t border-hairline-light dark:border-hairline-dark">
          <div className="flex flex-wrap items-center gap-2 pt-3">
            {isOwner && (
              <button
                onClick={() => setShowShareManagement(true)}
                className={`inline-flex items-center gap-1.5 h-10 px-3 text-body-sm rounded-lg transition-smooth font-medium ${
                  isShared
                    ? 'bg-success/10 text-success dark:text-success-dark hover:bg-success/20'
                    : 'bg-raised-light dark:bg-raised-dark text-ink-2-light dark:text-ink-2-dark hover:bg-hairline-light dark:hover:bg-hairline-dark'
                }`}
              >
                <Share2 size={16} strokeWidth={1.75} />
                {isShared ? `משותפת (${category.sharedWith.length})` : 'שיתוף'}
              </button>
            )}
            {!isOwner && isShared && (
              <button
                onClick={handleLeaveCategory}
                className="inline-flex items-center gap-1.5 h-10 px-3 text-body-sm rounded-lg font-medium bg-raised-light dark:bg-raised-dark text-ink-2-light dark:text-ink-2-dark hover:bg-danger-soft dark:hover:bg-danger-soft-dark hover:text-danger dark:hover:text-danger-dark transition-smooth"
                title="הסר אותי מהקטגוריה המשותפת"
              >
                <LogOut size={16} strokeWidth={1.75} />
                הסר אותי
              </button>
            )}
            <button
              onClick={() => navigate(`/category/${category.id}`)}
              className="inline-flex items-center gap-1.5 h-10 px-3 text-body-sm rounded-lg font-medium bg-raised-light dark:bg-raised-dark text-ink-2-light dark:text-ink-2-dark hover:bg-hairline-light dark:hover:bg-hairline-dark transition-smooth"
            >
              <Maximize2 size={16} strokeWidth={1.75} />
              דף מלא
            </button>
          </div>

          <div className="pt-3">
            <NoteCardList
              notes={categoryNotes}
              categoryColor={category.color}
              onOpen={setViewingNote}
              onArchive={deleteNote}
              onTogglePin={pinNote}
              // בחיפוש מוצג רק חלק מהפתקים - אין גרירה
              onReorder={hasSearch ? undefined : reorder}
              emptyText="אין פתקים בקטגוריה. ה-+ שבתחתית המסך יוצר פתק כאן."
            />
          </div>
        </div>
      )}

      {/* תצוגת פתק מלא */}
      {activeNote && (
        <NoteView
          note={activeNote}
          onClose={() => setViewingNote(null)}
          onDelete={deleteNote}
          onTogglePin={pinNote}
          onMoveToCategory={moveToCategory}
          categories={categoriesForMove}
        />
      )}

      {/* ניהול שיתוף */}
      {showShareManagement && (
        <ShareManagement
          itemType="category"
          itemId={category.id}
          itemName={category.name}
          currentSharedWith={category.sharedWith}
          onShare={(email) => categoryAPI.shareCategoryWithUser(category.id, email)}
          onUnshare={(userId) => categoryAPI.unshareCategoryWithUser(category.id, userId)}
          onClose={() => setShowShareManagement(false)}
        />
      )}
    </div>
  );
};
