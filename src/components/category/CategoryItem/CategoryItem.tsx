/**
 * CategoryItem Component
 * Displays a single category with its notes in horizontal scroll
 */

import React, { useState } from 'react';
import type { Category } from '@/types';
import { useNotes } from '@/hooks/useNotes';
import { useAuthStore } from '@/store/authStore';
import { useCategoryStore } from '@/store/categoryStore';
import { NotesList } from '@/components/note/NotesList';
import { NoteForm } from '@/components/note/NoteForm';
import { NoteView } from '@/components/note/NoteView';
import type { Note } from '@/types/note';

interface CategoryItemProps {
  category: Category;
}

export const CategoryItem: React.FC<CategoryItemProps> = ({
  category,
}) => {
  const { user } = useAuthStore();
  const { allNotes, createNote, updateNote, deleteNote, togglePinNote } = useNotes();
  const { categories } = useCategoryStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showNoteView, setShowNoteView] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);

  // סינון פתקים לפי קטגוריה זו
  const categoryNotes = allNotes.filter(note => note.categoryId === category.id);

  // רשימת קטגוריות להעברת פתק
  const categoriesForMove = categories.map(cat => ({
    id: cat.id,
    name: cat.name,
    icon: cat.icon || '📁',
  }));

  const handleAddNote = () => {
    setEditingNote(null);
    setShowNoteForm(true);
  };

  const handleViewNote = (note: Note) => {
    setViewingNote(note);
    setShowNoteView(true);
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteNote(noteId);
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('שגיאה במחיקת הפתק');
    }
  };

  const handleTogglePin = async (noteId: string, isPinned: boolean) => {
    try {
      await togglePinNote(noteId, isPinned);
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  const handleMoveToCategory = async (noteId: string, newCategoryId: string) => {
    try {
      const noteToMove = allNotes.find(n => n.id === noteId);
      if (!noteToMove) return;

      await updateNote(noteId, {
        ...noteToMove,
        categoryId: newCategoryId,
      });
    } catch (error) {
      console.error('Error moving note:', error);
      alert('שגיאה בהעברת הפתק');
    }
  };

  const handleSubmitNote = async (data: {
    title: string;
    content: string;
    templateType: any;
    tags: string[];
    color: string | null;
  }) => {
    if (!user) return;

    try {
      if (editingNote) {
        // עדכון פתק קיים
        await updateNote(editingNote.id, {
          ...data,
          categoryId: category.id,
          userId: user.uid,
          order: editingNote.order,
          sharedWith: editingNote.sharedWith,
          isPinned: editingNote.isPinned,
        });
      } else {
        // יצירת פתק חדש
        const newOrder = categoryNotes.length;
        await createNote({
          ...data,
          categoryId: category.id,
          userId: user.uid,
          order: newOrder,
          sharedWith: [],
          isPinned: false,
        });
      }
      setShowNoteForm(false);
      setEditingNote(null);
    } catch (error) {
      console.error('Error saving note:', error);
      alert('שגיאה בשמירת הפתק');
    }
  };

  return (
    <div className="mb-3 sm:mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-md border-r-4 transition-colors" style={{ borderRightColor: category.color }}>
      {/* כותרת הקטגוריה */}
      <div className="flex items-center justify-between p-2 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3 flex-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors text-sm sm:text-base"
          >
            {isExpanded ? '▼' : '◀'}
          </button>
          {category.icon && <span className="text-xl sm:text-2xl">{category.icon}</span>}
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm sm:text-base">{category.name}</h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{categoryNotes.length} פתקים</p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={handleAddNote}
            className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm bg-primary dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 rounded transition-colors font-medium"
          >
            + פתק
          </button>
        </div>
      </div>

      {/* תצוגה מקדימה של כותרות פתקים כשהקטגוריה סגורה */}
      {!isExpanded && categoryNotes.length > 0 && (
        <div className="px-2 sm:px-4 pb-2 sm:pb-3 border-t border-gray-100 dark:border-gray-700">
          <div className="overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            <div className="flex gap-1.5 sm:gap-2 py-1.5 sm:py-2 min-w-max">
              {categoryNotes.slice(0, 10).map((note) => (
                <button
                  key={note.id}
                  onClick={() => handleViewNote(note)}
                  className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-200 whitespace-nowrap transition-colors border border-gray-200 dark:border-gray-600"
                  style={{ borderRightColor: note.color || category.color, borderRightWidth: '3px' }}
                >
                  {note.isPinned && '📌 '}
                  {note.title}
                </button>
              ))}
              {categoryNotes.length > 10 && (
                <button
                  onClick={() => setIsExpanded(true)}
                  className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center whitespace-nowrap"
                >
                  +{categoryNotes.length - 10} עוד...
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* רשימת הפתקים (מתקפלת) */}
      {isExpanded && (
        <div className="px-2 sm:px-4 pb-2 sm:pb-4 border-t border-gray-100 dark:border-gray-700">
          <NotesList
            notes={categoryNotes}
            onView={handleViewNote}
            onDelete={handleDeleteNote}
            onTogglePin={handleTogglePin}
            onAddNote={handleAddNote}
          />
        </div>
      )}

      {/* תצוגת פתק מלא */}
      {showNoteView && viewingNote && (
        <NoteView
          note={viewingNote}
          onClose={() => {
            setShowNoteView(false);
            setViewingNote(null);
          }}
          onDelete={handleDeleteNote}
          onTogglePin={handleTogglePin}
          onUpdate={async (noteId, updates) => {
            try {
              // עדכון מיידי של הפתק עם השינויים
              const updatedNote = {
                ...viewingNote,
                ...(updates.title !== undefined && { title: updates.title }),
                ...(updates.content !== undefined && { content: updates.content }),
              };

              await updateNote(noteId, updatedNote);
              setViewingNote(updatedNote);
            } catch (error) {
              console.error('Error updating note:', error);
            }
          }}
          onMoveToCategory={handleMoveToCategory}
          categories={categoriesForMove}
        />
      )}

      {/* טופס הפתק */}
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
    </div>
  );
};
