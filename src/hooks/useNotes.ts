/**
 * Hook לשימוש בפתקים
 *
 * נרשם למנוי המשותף של הפתקים כל עוד הקומפוננטה חיה. המנוי עצמו
 * מנוהל ב-`noteStore` עם ספירת צרכנים, כך שאפשר לקרוא ל-hook הזה
 * מכמה קומפוננטות במקביל בלי לפתוח מאזינים מיותרים.
 */

import { useEffect, useMemo } from 'react';
import { useNoteStore } from '@/store/noteStore';
import { useAuthStore } from '@/store/authStore';
import { byPinnedThenOrder } from '@/services/api/mappers';
import type { Note } from '@/types/note';

export const useNotes = (categoryId?: string) => {
  const userId = useAuthStore((state) => state.user?.uid);

  const notes = useNoteStore((state) => state.notes);
  const isLoading = useNoteStore((state) => state.isLoading);
  const error = useNoteStore((state) => state.error);
  const subscribe = useNoteStore((state) => state.subscribe);
  const unsubscribe = useNoteStore((state) => state.unsubscribe);

  const createNote = useNoteStore((state) => state.createNote);
  const updateNote = useNoteStore((state) => state.updateNote);
  const archiveNote = useNoteStore((state) => state.archiveNote);
  const reorderNotes = useNoteStore((state) => state.reorderNotes);
  const togglePinNote = useNoteStore((state) => state.togglePinNote);
  const clearError = useNoteStore((state) => state.clearError);

  useEffect(() => {
    if (!userId) return;

    subscribe(userId);
    return () => unsubscribe();
  }, [userId, subscribe, unsubscribe]);

  // הסינון לפי קטגוריה נעשה מקומית מתוך הרשימה המשותפת -
  // זול יותר ממנוי נפרד לכל קטגוריה.
  const filteredNotes = useMemo<Note[]>(() => {
    if (!categoryId) return notes;
    return notes.filter((note) => note.categoryId === categoryId).sort(byPinnedThenOrder);
  }, [notes, categoryId]);

  return {
    notes: filteredNotes,
    allNotes: notes,
    isLoading,
    error,
    createNote,
    updateNote,
    archiveNote,
    reorderNotes,
    togglePinNote,
    clearError,
  };
};
