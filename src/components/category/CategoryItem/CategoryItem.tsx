/**
 * CategoryItem Component
 * Displays a single category with its notes in horizontal scroll
 */

import React, { useState } from 'react';
import type { Category } from '@/types';
import { useNotes } from '@/hooks/useNotes';
import { useAuthStore } from '@/store/authStore';
import { NotesList } from '@/components/note/NotesList';
import { NoteForm } from '@/components/note/NoteForm';
import { NoteView } from '@/components/note/NoteView';
import type { Note } from '@/types/note';

interface CategoryItemProps {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (categoryId: string) => void;
}

export const CategoryItem: React.FC<CategoryItemProps> = ({
  category,
  onEdit,
  onDelete,
}) => {
  const { user } = useAuthStore();
  const { allNotes, createNote, updateNote, deleteNote, togglePinNote } = useNotes();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showNoteView, setShowNoteView] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);

  // סינון פתקים לפי קטגוריה זו
  const categoryNotes = allNotes.filter(note => note.categoryId === category.id);

  const handleAddNote = () => {
    setEditingNote(null);
    setShowNoteForm(true);
  };

  const handleViewNote = (note: Note) => {
    setViewingNote(note);
    setShowNoteView(true);
  };

  const handleEditNote = (note: Note) => {
    setShowNoteView(false);
    setEditingNote(note);
    setShowNoteForm(true);
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
    <div className="mb-6 bg-white rounded-lg shadow-md border-r-4" style={{ borderRightColor: category.color }}>
      {/* כותרת הקטגוריה */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            {isExpanded ? '▼' : '◀'}
          </button>
          {category.icon && <span className="text-2xl">{category.icon}</span>}
          <div>
            <h3 className="font-semibold text-gray-800">{category.name}</h3>
            <p className="text-sm text-gray-500">{categoryNotes.length} פתקים</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAddNote}
            className="px-3 py-1.5 text-sm bg-primary text-white hover:bg-blue-600 rounded transition-colors font-medium"
          >
            + פתק חדש
          </button>
          <button
            onClick={() => onEdit(category)}
            className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
          >
            ✎ ערוך
          </button>
          <button
            onClick={() => onDelete(category.id)}
            className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            🗑 מחק
          </button>
        </div>
      </div>

      {/* תצוגה מקדימה של כותרות פתקים כשהקטגוריה סגורה */}
      {!isExpanded && categoryNotes.length > 0 && (
        <div className="px-4 pb-3 border-t border-gray-100">
          <div className="overflow-x-auto">
            <div className="flex gap-2 py-2">
              {categoryNotes.slice(0, 5).map((note) => (
                <button
                  key={note.id}
                  onClick={() => setIsExpanded(true)}
                  className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-md text-sm text-gray-700 whitespace-nowrap transition-colors border border-gray-200"
                  style={{ borderRightColor: note.color || category.color, borderRightWidth: '3px' }}
                >
                  {note.isPinned && '📌 '}
                  {note.title}
                </button>
              ))}
              {categoryNotes.length > 5 && (
                <span className="px-3 py-1.5 text-sm text-gray-500 flex items-center">
                  +{categoryNotes.length - 5} עוד
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* רשימת הפתקים (מתקפלת) */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
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
          onEdit={handleEditNote}
          onDelete={handleDeleteNote}
          onTogglePin={handleTogglePin}
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
