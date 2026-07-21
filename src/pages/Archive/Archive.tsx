/**
 * דף הארכיון - פתקים שנמחקו (מחיקה רכה)
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// `Archive` מיובא בשם אחר: הדף עצמו נקרא `Archive`, ושם זהה היה
// מסתיר את הרכיב המיוצא מהקובץ.
import { Archive as ArchiveIcon, ChevronRight, RotateCcw, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common';
import { subscribeToArchivedNotes, restoreNote, permanentlyDeleteNote } from '@/services/api/notes';
import { TemplateIcon } from '@/components/common/TemplateIcon/TemplateIcon';
import { getErrorMessage } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { Note } from '@/types/note';

export const Archive: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.uid;
  const [archivedNotes, setArchivedNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  // תלוי במזהה ולא באובייקט המשתמש, כדי לא לפתוח מנוי מחדש
  // בכל פעם שנתוני המשתמש מתעדכנים
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeToArchivedNotes(userId, (notes) => {
      setArchivedNotes(notes);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const handleRestore = async (noteId: string) => {
    try {
      await restoreNote(noteId);
    } catch (error) {
      logger.error('Error restoring note:', error);
      alert(getErrorMessage(error));
    }
  };

  const handlePermanentDelete = async (noteId: string, title: string) => {
    const confirmed = window.confirm(
      `האם אתה בטוח שברצונך למחוק לצמיתות את "${title}"?\n\nלא ניתן יהיה לשחזר את הפתק לאחר מחיקה זו!`
    );

    if (!confirmed) return;

    try {
      await permanentlyDeleteNote(noteId);
    } catch (error) {
      logger.error('Error permanently deleting note:', error);
      alert(getErrorMessage(error));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-raised-light dark:bg-raised-dark flex items-center justify-center">
        <p className="text-ink-2-light dark:text-ink-2-dark">טוען...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-raised-light dark:bg-raised-dark">
      {/* Header */}
      <header className="bg-surface-light dark:bg-surface-dark shadow-e1">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="h-11 w-11 grid place-items-center rounded-xl text-ink-2-light dark:text-ink-2-dark hover:bg-raised-light dark:hover:bg-raised-dark transition-colors"
              title="חזרה לדף הבית"
            >
              <ChevronRight size={24} strokeWidth={1.75} />
            </button>
            <h1 className="text-lg sm:text-2xl font-bold text-ink-light dark:text-ink-dark">ארכיון פתקים</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {archivedNotes.length === 0 ? (
          <div className="bg-surface-light dark:bg-surface-dark rounded-lg shadow-e1 p-8 text-center">
            <ArchiveIcon size={56} strokeWidth={1.25} className="mx-auto mb-4 text-ink-3-light dark:text-ink-3-dark" />
            <h2 className="text-xl font-bold text-ink-light dark:text-ink-dark mb-2">הארכיון ריק</h2>
            <p className="text-ink-2-light dark:text-ink-2-dark mb-4">
              פתקים שתמחק יופיעו כאן, ותוכל לשחזר אותם או למחוק לצמיתות
            </p>
            <Button onClick={() => navigate('/')} variant="outline">
              חזרה לדף הבית
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-ink-2-light dark:text-ink-2-dark">
                {archivedNotes.length} פתק{archivedNotes.length === 1 ? '' : 'ים'} בארכיון
              </p>
            </div>

            {archivedNotes.map((note) => (
              <div
                key={note.id}
                className="bg-surface-light dark:bg-surface-dark rounded-lg shadow-sm p-4 border border-hairline-light dark:border-hairline-dark hover:shadow-e2 transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <TemplateIcon
                        type={note.templateType}
                        size={20}
                        className="flex-shrink-0 text-ink-2-light dark:text-ink-2-dark"
                      />
                      <h3 className="text-lg font-bold text-ink-light dark:text-ink-dark truncate">{note.title}</h3>
                    </div>

                    <div className="text-sm text-ink-3-light dark:text-ink-3-dark mb-2">
                      <span>
                        הועבר לארכיון:{' '}
                        {note.archivedAt
                          ? new Date(note.archivedAt.toDate()).toLocaleDateString('he-IL', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'לא ידוע'}
                      </span>
                    </div>

                    {note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {note.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-0.5 bg-raised-light dark:bg-raised-dark text-ink-2-light dark:text-ink-2-dark text-xs rounded-full"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Button
                      onClick={() => handleRestore(note.id)}
                      size="sm"
                      className="whitespace-nowrap"
                    >
                      <RotateCcw size={16} strokeWidth={1.75} />
                      שחזר
                    </Button>
                    <Button
                      onClick={() => handlePermanentDelete(note.id, note.title)}
                      variant="danger"
                      size="sm"
                      className="whitespace-nowrap"
                    >
                      <Trash2 size={16} strokeWidth={1.75} />
                      מחק לצמיתות
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
