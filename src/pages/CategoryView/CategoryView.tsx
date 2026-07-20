/**
 * דף תצוגה מלאה של קטגוריה - כל הפתקים ברשת אנכית
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCategoryStore } from '@/store/categoryStore';
import { useNoteEditor } from '@/hooks/useNoteEditor';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/common';
import { NoteCard } from '@/components/note/NoteCard';
import { NoteForm } from '@/components/note/NoteForm';
import { NoteView } from '@/components/note/NoteView';
import { filterNotesByQuery } from '@/utils/search';
import type { Note } from '@/types/note';

export const CategoryView: React.FC = () => {
  const navigate = useNavigate();
  const { categoryId = '' } = useParams<{ categoryId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const categories = useCategoryStore((state) => state.categories);
  const { theme } = useTheme();

  const {
    notes,
    saveNote,
    updateNoteFields,
    moveToCategory,
    deleteNote,
    pinNote,
  } = useNoteEditor(categoryId);

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const category = categories.find((cat) => cat.id === categoryId);

  const visibleNotes = useMemo(
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

  // הקטגוריה נמחקה או שהקישור שגוי - חזרה לדף הבית.
  // ממתינים לטעינת הקטגוריות כדי לא לנווט בזמן הטעינה הראשונית.
  useEffect(() => {
    if (categories.length > 0 && !category) {
      navigate('/', { replace: true });
    }
  }, [categories.length, category, navigate]);

  /**
   * הפתק המוצג נגזר משני מקורות: לחיצה בתוך הדף (`viewingNote`), או
   * פרמטר בכתובת (`?note=<id>`) שמגיע מלחיצה על התראת תזכורת.
   *
   * הפרמטר נקרא ישירות ולא מועתק ל-state: העתקה הייתה מחייבת effect
   * שממתין לטעינת הפתקים ואז קורא ל-setState, כלומר רינדור מדורג מיותר.
   * כך הפתק נפתח מעצמו ברגע שהרשימה נטענת.
   */
  const requestedNoteId = searchParams.get('note');

  const activeNote = useMemo(() => {
    if (viewingNote) {
      return notes.find((note) => note.id === viewingNote.id) ?? viewingNote;
    }
    if (requestedNoteId) {
      return notes.find((note) => note.id === requestedNoteId) ?? null;
    }
    return null;
  }, [viewingNote, requestedNoteId, notes]);

  /** סגירה מנקה גם את הפרמטר, אחרת הפתק היה נפתח מיד מחדש */
  const handleCloseNoteView = () => {
    setViewingNote(null);

    if (requestedNoteId) {
      setSearchParams(
        (params) => {
          params.delete('note');
          return params;
        },
        { replace: true }
      );
    }
  };

  const handleSubmitNote = async (data: Parameters<typeof saveNote>[0]) => {
    const saved = await saveNote(data, editingNote);
    if (saved) {
      setShowNoteForm(false);
      setEditingNote(null);
    }
  };

  if (!category) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-xl text-gray-600 dark:text-gray-400">טוען...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 transition-colors">
      <header
        className={`${
          theme === 'dark' ? 'bg-gradient-primary-dark' : 'bg-gradient-primary'
        } shadow-card mb-5 rounded-b-2xl`}
        style={{ borderBottom: `4px solid ${category.color}` }}
      >
        <div className="container mx-auto px-3 sm:px-6 py-4 sm:py-5">
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
                  <p className="text-sm text-white/70">{visibleNotes.length} פתקים</p>
                </div>
              </div>
            </div>

            <Button
              onClick={() => {
                setEditingNote(null);
                setShowNoteForm(true);
              }}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              + פתק חדש
            </Button>
          </div>

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

      <main className="container mx-auto px-3 sm:px-6 pb-8">
        {visibleNotes.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">
              {searchQuery ? 'לא נמצאו פתקים תואמים' : 'אין פתקים בקטגוריה זו'}
            </p>
            {!searchQuery && (
              <Button
                onClick={() => {
                  setEditingNote(null);
                  setShowNoteForm(true);
                }}
              >
                צור פתק ראשון
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onView={setViewingNote}
                onDelete={deleteNote}
                onTogglePin={pinNote}
              />
            ))}
          </div>
        )}
      </main>

      {activeNote && (
        <NoteView
          note={activeNote}
          onClose={handleCloseNoteView}
          onDelete={deleteNote}
          onTogglePin={pinNote}
          onUpdate={updateNoteFields}
          onMoveToCategory={moveToCategory}
          categories={categoriesForMove}
        />
      )}

      {showNoteForm && (
        <NoteForm
          categoryId={categoryId}
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
