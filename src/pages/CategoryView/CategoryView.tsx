/**
 * דף תצוגה מלאה של קטגוריה - כל הפתקים ברשת אנכית
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight, Plus, Search, X } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { useNoteEditor } from '@/hooks/useNoteEditor';
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
  // דרך `useCategories` ולא ישירות מה-store: ההוק הוא שמקים את המנוי.
  // קריאה ישירה עבדה רק כשהגיעו לכאן מדף הבית, שכבר טען אותן. כניסה
  // ישירה לכתובת - למשל מלחיצה על התראת תזכורת - השאירה את הרשימה
  // ריקה לנצח ואת המסך תקוע על "טוען".
  const { categories, hasLoaded: categoriesLoaded } = useCategories();

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
  // ממתינים לתשובה מהשרת ולא לרשימה לא-ריקה: למשתמש בלי קטגוריות כלל
  // התנאי הישן לא היה מתקיים לעולם, והמסך היה נשאר תקוע.
  useEffect(() => {
    if (categoriesLoaded && !category) {
      navigate('/', { replace: true });
    }
  }, [categoriesLoaded, category, navigate]);

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
      <div className="min-h-screen bg-app-light dark:bg-app-dark flex items-center justify-center">
        <p className="text-xl text-ink-2-light dark:text-ink-2-dark">טוען...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-light dark:bg-app-dark transition-colors">
      {/* כותרת על משטח נקי ולא על גרדיאנט: הגרדיאנט נשמר למסך ההתחברות
          בלבד, כרגע המיתוג היחיד. זהות הקטגוריה מסומנת בפס צבע דק
          בראש הכותרת במקום ברקע מלא שמתחרה בתוכן. */}
      <header
        className="bg-surface-light dark:bg-surface-dark border-b border-hairline-light dark:border-hairline-dark mb-5"
        style={{ borderTop: `3px solid ${category.color}` }}
      >
        <div className="container mx-auto px-3 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* ב-RTL "חזור" מצביע ימינה - לכיוון שממנו הגענו */}
              <button
                onClick={() => navigate('/')}
                className="h-11 w-11 grid place-items-center rounded-xl text-ink-2-light dark:text-ink-2-dark hover:bg-raised-light dark:hover:bg-raised-dark transition-colors flex-shrink-0"
                title="חזור לדף הבית"
              >
                <ChevronRight size={24} strokeWidth={1.75} />
              </button>
              {category.icon && <span className="text-2xl flex-shrink-0">{category.icon}</span>}
              <div className="flex-1 min-w-0">
                <h1 className="text-h1 text-ink-light dark:text-ink-dark truncate">
                  {category.name}
                </h1>
                <p className="text-caption text-ink-3-light dark:text-ink-3-dark">
                  {visibleNotes.length} פתקים
                </p>
              </div>
            </div>

            <Button
              onClick={() => {
                setEditingNote(null);
                setShowNoteForm(true);
              }}
              className="flex-shrink-0"
            >
              <Plus size={18} strokeWidth={2} />
              פתק חדש
            </Button>
          </div>

          <div className="max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="חפש פתקים בקטגוריה..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 ps-10 pe-10 rounded-lg bg-raised-light dark:bg-raised-dark border border-hairline-light dark:border-hairline-dark text-body text-ink-light dark:text-ink-dark focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-all"
              />
              <Search
                size={18}
                strokeWidth={1.75}
                className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-3-light dark:text-ink-3-dark pointer-events-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-ink-3-light dark:text-ink-3-dark hover:text-ink-light dark:hover:text-ink-dark transition-colors"
                  title="נקה חיפוש"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-6 pb-8">
        {visibleNotes.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-ink-3-light dark:text-ink-3-dark text-lg mb-4">
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
