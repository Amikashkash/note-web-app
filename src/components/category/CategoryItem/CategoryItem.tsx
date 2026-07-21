/**
 * שורת קטגוריה בדף הבית - מציגה את פתקי הקטגוריה בגלילה אופקית
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronLeft, Pin, Plus, Search, Share2, Users } from 'lucide-react';
import type { Category } from '@/types';
import type { Note } from '@/types/note';
import { useNoteEditor } from '@/hooks/useNoteEditor';
import { useAuthStore } from '@/store/authStore';
import { useCategoryStore } from '@/store/categoryStore';
import { NotesList } from '@/components/note/NotesList';
import { NoteForm } from '@/components/note/NoteForm';
import { NoteView } from '@/components/note/NoteView';
import { ShareManagement } from '@/components/common/ShareManagement';
import { filterNotesByQuery } from '@/utils/search';
import * as categoryAPI from '@/services/api/categories';

interface CategoryItemProps {
  category: Category;
  searchQuery?: string;
}

/** כמה כותרות פתקים מוצגות בתצוגה המקופלת */
const COLLAPSED_PREVIEW_COUNT = 10;

export const CategoryItem: React.FC<CategoryItemProps> = ({ category, searchQuery = '' }) => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const categories = useCategoryStore((state) => state.categories);

  const {
    notes,
    saveNote,
    updateNoteFields,
    moveToCategory,
    deleteNote,
    pinNote,
    moveNoteBefore,
  } = useNoteEditor(category.id);

  const [manuallyExpanded, setManuallyExpanded] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [showShareManagement, setShowShareManagement] = useState(false);
  const [draggingNote, setDraggingNote] = useState<Note | null>(null);
  const [dragOverNote, setDragOverNote] = useState<Note | null>(null);

  const categoryNotes = useMemo(
    () => filterNotesByQuery(notes, searchQuery),
    [notes, searchQuery]
  );

  const categoriesForMove = useMemo(
    () =>
      categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        icon: cat.icon || '📁',
      })),
    [categories]
  );

  const hasSearch = searchQuery.trim().length > 0;
  const matchCount = categoryNotes.length;

  // בזמן חיפוש הקטגוריה נפתחת אוטומטית אם יש בה תוצאות, ומחוץ לחיפוש
  // נשמר מה שהמשתמש בחר. הערך נגזר ברינדור ולא מסונכרן דרך effect,
  // כדי למנוע רינדור כפול בכל הקלדה בשדה החיפוש.
  const isExpanded = hasSearch ? matchCount > 0 : manuallyExpanded;

  // הפתק המוצג במודאל נלקח מהרשימה החיה, כדי שיתעדכן בזמן אמת
  const activeNote = viewingNote
    ? notes.find((note) => note.id === viewingNote.id) ?? viewingNote
    : null;

  const isOwner = user !== null && category.userId === user.uid;
  const isShared = category.sharedWith.length > 0;

  const handleDrop = async (targetNote: Note) => {
    if (draggingNote) {
      await moveNoteBefore(draggingNote.id, targetNote.id);
    }
    setDragOverNote(null);
  };

  const handleSubmitNote = async (data: Parameters<typeof saveNote>[0]) => {
    const saved = await saveNote(data, editingNote);
    if (saved) {
      setShowNoteForm(false);
      setEditingNote(null);
    }
  };

  // בחיפוש ללא תוצאות - הקטגוריה לא מוצגת כלל
  if (hasSearch && matchCount === 0) {
    return null;
  }

  const collapsedPreview = [...categoryNotes].slice(0, COLLAPSED_PREVIEW_COUNT);
  const hiddenCount = categoryNotes.length - collapsedPreview.length;

  return (
    <div
      className="mb-4 bg-surface-light dark:bg-surface-dark rounded-xl p-5 border border-hairline-light dark:border-hairline-dark border-s-4 shadow-e1 hover:shadow-e2 transition-smooth overflow-visible"
      // תכונה לוגית: בעברית `borderRight` צייר את הפס בקצה שבו השורה
      // נגמרת, במקום בקצה שבו היא מתחילה.
      style={{ borderInlineStartColor: category.color }}
    >
      {/* כותרת הקטגוריה */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={() => setManuallyExpanded((previous) => !previous)}
            className="text-ink-3-light dark:text-ink-3-dark hover:text-ink-light dark:hover:text-ink-dark transition-colors"
            title={isExpanded ? 'קפל' : 'הרחב'}
          >
            {/* מקופל מצביע שמאלה ולא ימינה: ב-RTL כיוון ההמשך הוא שמאלה,
                וחץ ימינה היה קורא כ"חזור". */}
            {isExpanded ? (
              <ChevronDown size={18} strokeWidth={1.75} />
            ) : (
              <ChevronLeft size={18} strokeWidth={1.75} />
            )}
          </button>
          {category.icon && <span className="text-2xl">{category.icon}</span>}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-h2 text-ink-light dark:text-ink-dark">
                {category.name}
              </h3>
              <button
                onClick={() => navigate(`/category/${category.id}`)}
                className="inline-flex items-center gap-1 text-caption text-ink-3-light dark:text-ink-3-dark hover:text-brand-text dark:hover:text-brand-text-dark transition-colors px-2 py-1 rounded-lg hover:bg-raised-light dark:hover:bg-raised-dark"
                title="פתח בתצוגה מלאה"
              >
                <Search size={14} strokeWidth={1.75} />
                הצג הכל
              </button>
            </div>
            <p className="text-body-sm text-ink-3-light dark:text-ink-3-dark">{categoryNotes.length} פתקים</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              onClick={() => setShowShareManagement(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-body-sm rounded-lg transition-smooth font-medium ${
                isShared
                  ? 'bg-success/10 text-success dark:text-success-dark hover:bg-success/20'
                  : 'bg-raised-light dark:bg-raised-dark text-ink-2-light dark:text-ink-2-dark hover:bg-hairline-light dark:hover:bg-hairline-dark'
              }`}
              title={isShared ? `משותף עם ${category.sharedWith.length} משתמשים` : 'שתף קטגוריה'}
            >
              <Share2 size={16} strokeWidth={1.75} />
              {isShared && category.sharedWith.length}
            </button>
          )}
          {!isOwner && isShared && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-body-sm bg-brand-soft dark:bg-brand-soft-dark text-brand-text dark:text-brand-text-dark rounded-lg font-medium">
              <Users size={16} strokeWidth={1.75} />
              משותף
            </span>
          )}
          <button
            onClick={() => {
              setEditingNote(null);
              setShowNoteForm(true);
            }}
            className="inline-flex items-center gap-1 h-11 px-4 text-body-sm bg-brand dark:bg-brand-dark text-white rounded-lg font-medium shadow-e1 hover:bg-brand-2 dark:hover:bg-brand-2-dark transition-smooth"
          >
            <Plus size={18} strokeWidth={2} />
            פתק
          </button>
        </div>
      </div>

      {/* תצוגה מקופלת - כותרות בלבד */}
      {!isExpanded && categoryNotes.length > 0 && (
        <div className="pb-2 border-t border-hairline-light dark:border-hairline-dark mt-3 pt-3">
          <div className="overflow-x-auto notes-scroll" dir="rtl">
            <div className="flex gap-3">
              {collapsedPreview.map((note) => (
                <button
                  key={note.id}
                  onClick={() => setViewingNote(note)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-raised-light dark:bg-raised-dark hover:shadow-e1 rounded-lg text-body-sm text-ink-2-light dark:text-ink-2-dark transition-smooth border-s-[3px] flex-shrink-0 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap"
                  style={{ borderInlineStartColor: note.color || category.color }}
                >
                  {note.isPinned && (
                    <Pin
                      size={12}
                      strokeWidth={1.75}
                      fill="currentColor"
                      className="flex-shrink-0 text-cat-orange dark:text-cat-orange-dark"
                    />
                  )}
                  {note.title}
                </button>
              ))}
              {hiddenCount > 0 && (
                <button
                  onClick={() => setManuallyExpanded(true)}
                  className="px-4 py-2 text-body-sm text-ink-3-light dark:text-ink-3-dark hover:text-ink-light dark:hover:text-ink-dark flex items-center whitespace-nowrap transition-smooth flex-shrink-0"
                >
                  +{hiddenCount} עוד...
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* תצוגה מורחבת */}
      {isExpanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 mt-3 pt-3">
          <NotesList
            notes={categoryNotes}
            onView={setViewingNote}
            onDelete={deleteNote}
            onTogglePin={pinNote}
            onAddNote={() => {
              setEditingNote(null);
              setShowNoteForm(true);
            }}
            onDragStart={setDraggingNote}
            onDragEnd={() => {
              setDraggingNote(null);
              setDragOverNote(null);
            }}
            onDragOver={(note) => {
              if (draggingNote && draggingNote.id !== note.id) {
                setDragOverNote(note);
              }
            }}
            onDrop={handleDrop}
            draggingNoteId={draggingNote?.id}
            dragOverNoteId={dragOverNote?.id}
          />
        </div>
      )}

      {/* תצוגת פתק מלא */}
      {activeNote && (
        <NoteView
          note={activeNote}
          onClose={() => setViewingNote(null)}
          onDelete={deleteNote}
          onTogglePin={pinNote}
          onUpdate={updateNoteFields}
          onMoveToCategory={moveToCategory}
          categories={categoriesForMove}
        />
      )}

      {/* טופס פתק */}
      {showNoteForm && (
        <NoteForm
          categoryId={category.id}
          note={editingNote}
          onClose={() => {
            setShowNoteForm(false);
            setEditingNote(null);
          }}
          onSubmit={handleSubmitNote}
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
