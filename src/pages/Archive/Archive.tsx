/**
 * דף הארכיון - פתקים שנמחקו (מחיקה רכה)
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common';
import { subscribeToArchivedNotes, restoreNote, permanentlyDeleteNote } from '@/services/api/notes';
import { Note } from '@/types/note';

export const Archive: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [archivedNotes, setArchivedNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToArchivedNotes(user.uid, (notes) => {
      setArchivedNotes(notes);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleRestore = async (noteId: string) => {
    try {
      await restoreNote(noteId);
    } catch (error) {
      console.error('Error restoring note:', error);
      alert('שגיאה בשחזור הפתק');
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
      console.error('Error permanently deleting note:', error);
      alert('שגיאה במחיקת הפתק');
    }
  };

  const getTemplateIcon = (templateType: string): string => {
    const icons: Record<string, string> = {
      plain: '📝',
      checklist: '✅',
      recipe: '🍳',
      shopping: '🛒',
      workplan: '📋',
      accounting: '💰',
    };
    return icons[templateType] || '📝';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">טוען...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="text-gray-600 hover:text-gray-800 text-xl"
              title="חזרה לדף הבית"
            >
              ←
            </button>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800">🗄️ ארכיון פתקים</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {archivedNotes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="text-6xl mb-4">🗄️</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">הארכיון ריק</h2>
            <p className="text-gray-600 mb-4">
              פתקים שתמחק יופיעו כאן, ותוכל לשחזר אותם או למחוק לצמיתות
            </p>
            <Button onClick={() => navigate('/')} variant="outline">
              חזרה לדף הבית
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                {archivedNotes.length} פתק{archivedNotes.length === 1 ? '' : 'ים'} בארכיון
              </p>
            </div>

            {archivedNotes.map((note) => (
              <div
                key={note.id}
                className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{getTemplateIcon(note.templateType)}</span>
                      <h3 className="text-lg font-bold text-gray-800 truncate">{note.title}</h3>
                    </div>

                    <div className="text-sm text-gray-500 mb-2">
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
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
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
                      ↺ שחזר
                    </Button>
                    <Button
                      onClick={() => handlePermanentDelete(note.id, note.title)}
                      variant="danger"
                      size="sm"
                      className="whitespace-nowrap"
                    >
                      🗑 מחק לצמיתות
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
