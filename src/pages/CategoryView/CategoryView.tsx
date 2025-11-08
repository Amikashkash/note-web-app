/**
 * דף תצוגה מלאה של קטגוריה
 * מציג את כל הפתקים בקטגוריה ברשימה אנכית
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useCategoryStore } from '@/store/categoryStore';
import { useNotes } from '@/hooks/useNotes';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/common';
import { NoteCard } from '@/components/note/NoteCard';
import { NoteForm } from '@/components/note/NoteForm';
import { NoteView } from '@/components/note/NoteView';
import type { Note } from '@/types/note';
import { Timestamp } from 'firebase/firestore';

export const CategoryView: React.FC = () => {
  const navigate = useNavigate();
  const { categoryId } = useParams<{ categoryId: string }>();
  const { user } = useAuthStore();
  const { categories } = useCategoryStore();
  const { allNotes, createNote, updateNote, deleteNote, togglePinNote } = useNotes();
  const { theme } = useTheme();
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showNoteView, setShowNoteView] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // מציאת הקטגוריה הנוכחית
  const category = categories.find((cat) => cat.id === categoryId);

  // סינון פתקים לפי קטגוריה זו וחיפוש
  const categoryNotes = allNotes.filter((note) => {
    if (note.categoryId !== categoryId) return false;

    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const titleMatch = note.title.toLowerCase().includes(query);
    const contentMatch = note.content.toLowerCase().includes(query);
    const tagsMatch = note.tags?.some((tag) => tag.toLowerCase().includes(query)) || false;

    return titleMatch || contentMatch || tagsMatch;
  });

  // מיון פתקים: מוצמדים קודם, ואז לפי סדר
  const sortedNotes = [...categoryNotes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return (a.order || 0) - (b.order || 0);
  });

  // רשימת קטגוריות להעברת פתק
  const categoriesForMove = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    icon: cat.icon || '📁',
  }));

  // חזרה לדף הבית אם הקטגוריה לא נמצאה
  useEffect(() => {
    if (!category && categories.length > 0) {
      navigate('/');
    }
  }, [category, categories, navigate]);

  if (!category) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 dark:text-gray-400">טוען...</p>
        </div>
      </div>
    );
  }

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
      const noteToMove = allNotes.find((n) => n.id === noteId);
      if (!noteToMove) return;

      await updateNote(noteId, {
        ...noteToMove,
        categoryId: newCategoryId,
      });

      // חזור לדף הבית אם הפתק הועבר
      if (categoryNotes.length === 1) {
        navigate('/');
      }
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
    reminderTime?: Date | null;
    reminderEnabled?: boolean;
  }) => {
    if (!user || !categoryId) return;

    try {
      if (editingNote) {
        // עדכון פתק קיים
        await updateNote(editingNote.id, {
          ...data,
          categoryId,
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
          categoryId,
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
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header
        className={`${
          theme === 'dark' ? 'bg-gradient-primary-dark' : 'bg-gradient-primary'
        } shadow-card mb-5 rounded-b-2xl`}
        style={{ borderBottom: `4px solid ${category.color}` }}
      >
        <div className="container mx-auto px-3 sm:px-6 py-4 sm:py-5">
          {/* שורה ראשונה - חזרה וכותרת */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                onClick={() => navigate('/')}
                className="text-white hover:bg-white/20 rounded-xl p-2 transition-colors"
                title="חזור לדף הבית"
              >
                ← חזור
              </button>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {category.icon && <span className="text-3xl">{category.icon}</span>}
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl sm:text-3xl font-bold text-white truncate">
                    {category.name}
                  </h1>
                  <p className="text-sm text-white/70">
                    {sortedNotes.length} פתקים
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleAddNote}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              + פתק חדש
            </Button>
          </div>

          {/* שדה חיפוש */}
          <div className="max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="חפש פתקים בקטגוריה..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pr-10 pl-10 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
                  title="נקה חיפוש"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* רשימת פתקים אנכית */}
      <main className="container mx-auto px-3 sm:px-6 pb-8">
        {sortedNotes.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">
              {searchQuery ? 'לא נמצאו פתקים תואמים' : 'אין פתקים בקטגוריה זו'}
            </p>
            {!searchQuery && (
              <Button onClick={handleAddNote}>צור פתק ראשון</Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onView={handleViewNote}
                onDelete={handleDeleteNote}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>
        )}
      </main>

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

      {/* טופס פתק */}
      {showNoteForm && (
        <NoteForm
          categoryId={categoryId!}
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

export default CategoryView;
