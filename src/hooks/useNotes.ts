/**
 * Custom Hook לשימוש בפתקים
 */

import { useEffect } from 'react';
import { useNoteStore } from '@/store/noteStore';
import { useAuthStore } from '@/store/authStore';

export const useNotes = (categoryId?: string) => {
  const { user } = useAuthStore();
  const {
    notes,
    isLoading,
    error,
    subscribeToNotes,
    subscribeToNotesByCategory,
    unsubscribeFromNotes,
    createNote,
    updateNote,
    deleteNote,
    reorderNote,
    togglePinNote,
    getNotesByCategory,
    clearError,
  } = useNoteStore();

  // מנוי לפתקים בעת טעינת הקומפוננטה
  useEffect(() => {
    if (user?.uid) {
      if (categoryId) {
        // מנוי לפתקים של קטגוריה ספציפית
        subscribeToNotesByCategory(categoryId);
      } else {
        // מנוי לכל הפתקים של המשתמש
        subscribeToNotes(user.uid);
      }
    }

    return () => {
      unsubscribeFromNotes();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, categoryId]);

  // אם נתבקשה קטגוריה ספציפית, מחזירים רק את הפתקים שלה
  const filteredNotes = categoryId ? getNotesByCategory(categoryId) : notes;

  return {
    notes: filteredNotes,
    allNotes: notes,
    isLoading,
    error,
    createNote,
    updateNote,
    deleteNote,
    reorderNote,
    togglePinNote,
    clearError,
  };
};
