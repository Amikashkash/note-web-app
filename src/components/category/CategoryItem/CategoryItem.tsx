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
import { ShareManagement } from '@/components/common/ShareManagement';
import type { Note } from '@/types/note';
import * as categoryAPI from '@/services/api/categories';

interface CategoryItemProps {
  category: Category;
  searchQuery?: string;
}

export const CategoryItem: React.FC<CategoryItemProps> = ({
  category,
  searchQuery = '',
}) => {
  const { user } = useAuthStore();
  const { allNotes, createNote, updateNote, deleteNote, togglePinNote } = useNotes();
  const { categories } = useCategoryStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showNoteView, setShowNoteView] = useState(false);
  const [showShareManagement, setShowShareManagement] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [draggingNote, setDraggingNote] = useState<Note | null>(null);
  const [dragOverNote, setDragOverNote] = useState<Note | null>(null);

  // סינון פתקים לפי קטגוריה זו וחיפוש
  const categoryNotes = allNotes.filter(note => {
    if (note.categoryId !== category.id) return false;

    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const titleMatch = note.title.toLowerCase().includes(query);
    const contentMatch = note.content.toLowerCase().includes(query);
    const tagsMatch = note.tags?.some(tag => tag.toLowerCase().includes(query)) || false;

    return titleMatch || contentMatch || tagsMatch;
  });

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

  const handleShareCategory = async (email: string) => {
    try {
      await categoryAPI.shareCategoryWithUser(category.id, email);
    } catch (error) {
      throw error;
    }
  };

  const handleUnshareCategory = async (userId: string) => {
    try {
      await categoryAPI.unshareCategoryWithUser(category.id, userId);
    } catch (error) {
      throw error;
    }
  };

  // Check if user is the owner of the category
  const isOwner = user && category.userId === user.uid;
  const isShared = category.sharedWith && category.sharedWith.length > 0;

  // Drag and Drop handlers
  const handleDragStart = (note: Note) => {
    setDraggingNote(note);
  };

  const handleDragEnd = () => {
    setDraggingNote(null);
    setDragOverNote(null);
  };

  const handleDragOver = (note: Note) => {
    if (draggingNote && draggingNote.id !== note.id) {
      setDragOverNote(note);
    }
  };

  const handleDrop = async (targetNote: Note) => {
    if (!draggingNote || draggingNote.id === targetNote.id) {
      setDragOverNote(null);
      return;
    }

    try {
      // Get the current order of notes
      const sortedNotes = [...categoryNotes].sort((a, b) => (a.order || 0) - (b.order || 0));

      // Find positions
      const dragIndex = sortedNotes.findIndex(n => n.id === draggingNote.id);
      const dropIndex = sortedNotes.findIndex(n => n.id === targetNote.id);

      if (dragIndex === -1 || dropIndex === -1) return;

      // Reorder the array
      const newNotes = [...sortedNotes];
      const [removed] = newNotes.splice(dragIndex, 1);
      newNotes.splice(dropIndex, 0, removed);

      // Update order for all affected notes
      const updates = newNotes.map((note, index) => {
        if (note.order !== index) {
          return updateNote(note.id, { ...note, order: index });
        }
        return Promise.resolve();
      });

      await Promise.all(updates);
      console.log('✅ Note order updated successfully');
    } catch (error) {
      console.error('❌ Error reordering notes:', error);
      alert('שגיאה בשינוי סדר הפתקים');
    }

    setDragOverNote(null);
  };

  const handleSubmitNote = async (data: {
    title: string;
    content: string;
    templateType: any;
    tags: string[];
    color: string | null;
    reminderTime?: Date | null;
    reminderEnabled?: boolean;
  }) => {
    if (!user) return;

    try {
      // Import Timestamp for reminder conversion
      const { Timestamp } = await import('firebase/firestore');

      if (editingNote) {
        // עדכון פתק קיים
        await updateNote(editingNote.id, {
          ...data,
          categoryId: category.id,
          userId: user.uid,
          order: editingNote.order,
          sharedWith: editingNote.sharedWith,
          isPinned: editingNote.isPinned,
          reminderTime: data.reminderTime ? Timestamp.fromDate(data.reminderTime) : null,
          reminderEnabled: data.reminderEnabled || false,
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
          reminderTime: data.reminderTime ? Timestamp.fromDate(data.reminderTime) : null,
          reminderEnabled: data.reminderEnabled || false,
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
    <div
      className="mb-4 bg-white dark:bg-gray-800 rounded-card p-5 shadow-card dark:shadow-card-dark hover:shadow-card-hover dark:hover:shadow-card-hover-dark transition-smooth hover-slide overflow-visible"
      style={{ borderRight: `6px solid ${category.color}` }}
    >
      {/* כותרת הקטגוריה */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors text-base"
          >
            {isExpanded ? '▼' : '◀'}
          </button>
          {category.icon && <span className="text-2xl">{category.icon}</span>}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{category.name}</h3>
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
            onClick={handleAddNote}
            className="px-5 py-2.5 text-sm bg-gradient-primary dark:bg-gradient-primary-dark text-white rounded-xl font-medium shadow-button dark:shadow-button-dark hover:shadow-button-hover dark:hover:shadow-button-hover-dark transition-smooth hover:-translate-y-0.5"
          >
            + פתק
          </button>
        </div>
      </div>

      {/* תצוגה מקדימה של כותרות פתקים כשהקטגוריה סגורה */}
      {!isExpanded && categoryNotes.length > 0 && (
        <div className="pb-2 border-t border-gray-100 dark:border-gray-700 mt-3 pt-3">
          <div className="overflow-x-auto notes-scroll">
            <div className="flex gap-3 min-w-max">
              {categoryNotes.slice(0, 10).map((note) => (
                <button
                  key={note.id}
                  onClick={() => handleViewNote(note)}
                  className="px-4 py-2 bg-gradient-note dark:bg-gradient-note-dark hover:shadow-note dark:hover:shadow-note-dark rounded-note text-sm text-gray-700 dark:text-gray-200 whitespace-nowrap transition-smooth hover-lift border-r-3"
                  style={{ borderRightColor: note.color || category.color, borderRightWidth: '3px' }}
                >
                  {note.isPinned && '📌 '}
                  {note.title}
                </button>
              ))}
              {categoryNotes.length > 10 && (
                <button
                  onClick={() => setIsExpanded(true)}
                  className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center whitespace-nowrap transition-smooth"
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
        <div className="border-t border-gray-100 dark:border-gray-700 mt-3 pt-3">
          <NotesList
            notes={categoryNotes}
            onView={handleViewNote}
            onDelete={handleDeleteNote}
            onTogglePin={handleTogglePin}
            onAddNote={handleAddNote}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            draggingNoteId={draggingNote?.id}
            dragOverNoteId={dragOverNote?.id}
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

      {/* ניהול שיתוף */}
      {showShareManagement && (
        <ShareManagement
          itemType="category"
          itemId={category.id}
          itemName={category.name}
          currentSharedWith={category.sharedWith || []}
          onShare={handleShareCategory}
          onUnshare={handleUnshareCategory}
          onClose={() => setShowShareManagement(false)}
        />
      )}
    </div>
  );
};
