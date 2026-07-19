/**
 * שורת קטגוריה בדף הבית - מציגה את פתקי הקטגוריה בגלילה אופקית
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
      className="mb-4 bg-white dark:bg-gray-800 rounded-card p-5 shadow-card dark:shadow-card-dark hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-smooth hover-slide overflow-visible"
      style={{ borderRight: `6px solid ${category.color}` }}
    >
      {/* כותרת הקטגוריה */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={() => setManuallyExpanded((previous) => !previous)}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors text-base"
            title={isExpanded ? 'קפל' : 'הרחב'}
          >
            {isExpanded ? '▼' : '◀'}
          </button>
          {category.icon && <span className="text-2xl">{category.icon}</span>}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                {category.name}
              </h3>
              <button
                onClick={() => navigate(`/category/${category.id}`)}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                title="פתח בתצוגה מלאה"
              >
                🔍 הצג הכל
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{categoryNotes.length} פתקים</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              onClick={() => setShowShareManagement(true)}
              className={`px-3 py-1.5 text-sm rounded-xl transition-smooth font-medium ${
                isShared
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 hover:-translate-y-0.5'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:-translate-y-0.5'
              }`}
              title={isShared ? `משותף עם ${category.sharedWith.length} משתמשים` : 'שתף קטגוריה'}
            >
              {isShared ? `🔗 ${category.sharedWith.length}` : '🔗'}
            </button>
          )}
          {!isOwner && isShared && (
            <span className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-xl font-medium">
              👥 משותף
            </span>
          )}
          <button
            onClick={() => {
              setEditingNote(null);
              setShowNoteForm(true);
            }}
            className="px-5 py-2.5 text-sm bg-gradient-primary dark:bg-gradient-primary-dark text-white rounded-xl font-medium shadow-button dark:shadow-button-dark hover:shadow-button-hover dark:hover:shadow-button-hover-dark transition-smooth hover:-translate-y-0.5"
          >
            + פתק
          </button>
        </div>
      </div>

      {/* תצוגה מקופלת - כותרות בלבד */}
      {!isExpanded && categoryNotes.length > 0 && (
        <div className="pb-2 border-t border-gray-100 dark:border-gray-700 mt-3 pt-3">
          <div className="overflow-x-auto notes-scroll" dir="rtl">
            <div className="flex gap-3">
              {collapsedPreview.map((note) => (
                <button
                  key={note.id}
                  onClick={() => setViewingNote(note)}
                  className="px-4 py-2 bg-gradient-note hover:shadow-note dark:hover:shadow-note-dark rounded-note text-sm text-gray-700 dark:text-gray-200 transition-smooth hover-lift border-r-3 flex-shrink-0 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap"
                  style={{
                    borderRightColor: note.color || category.color,
                    borderRightWidth: '3px',
                  }}
                >
                  {note.isPinned && '📌 '}
                  {note.title}
                </button>
              ))}
              {hiddenCount > 0 && (
                <button
                  onClick={() => setManuallyExpanded(true)}
                  className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center whitespace-nowrap transition-smooth flex-shrink-0"
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
