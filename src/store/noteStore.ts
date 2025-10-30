/**
 * Zustand Store לניהול מצב הפתקים
 */

import { create } from 'zustand';
import { Note, NoteInput } from '@/types/note';
import * as noteAPI from '@/services/api/notes';
import { Unsubscribe } from 'firebase/firestore';

interface NoteState {
  // State
  notes: Note[];
  isLoading: boolean;
  error: string | null;
  unsubscribe: Unsubscribe | null;

  // Actions
  subscribeToNotes: (userId: string) => void;
  subscribeToNotesByCategory: (categoryId: string) => void;
  unsubscribeFromNotes: () => void;
  createNote: (noteInput: NoteInput) => Promise<string>;
  updateNote: (noteId: string, updates: Partial<NoteInput>) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  reorderNote: (noteId: string, newOrder: number) => Promise<void>;
  togglePinNote: (noteId: string, isPinned: boolean) => Promise<void>;
  getNotesByCategory: (categoryId: string) => Note[];
  clearError: () => void;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  // Initial state
  notes: [],
  isLoading: false,
  error: null,
  unsubscribe: null,

  /**
   * מנוי לכל הפתקים של משתמש
   */
  subscribeToNotes: (userId: string) => {
    // ניקוי מנוי קודם אם קיים
    const { unsubscribe } = get();
    if (unsubscribe) {
      unsubscribe();
    }

    set({ isLoading: true });

    const newUnsubscribe = noteAPI.subscribeToNotes(userId, (notes) => {
      set({ notes, isLoading: false, error: null });
    });

    set({ unsubscribe: newUnsubscribe });
  },

  /**
   * מנוי לפתקים של קטגוריה ספציפית
   */
  subscribeToNotesByCategory: (categoryId: string) => {
    const { unsubscribe } = get();
    if (unsubscribe) {
      unsubscribe();
    }

    set({ isLoading: true });

    const newUnsubscribe = noteAPI.subscribeToNotesByCategory(categoryId, (notes) => {
      set({ notes, isLoading: false, error: null });
    });

    set({ unsubscribe: newUnsubscribe });
  },

  /**
   * ביטול מנוי
   */
  unsubscribeFromNotes: () => {
    const { unsubscribe } = get();
    if (unsubscribe) {
      unsubscribe();
      set({ unsubscribe: null, notes: [] });
    }
  },

  /**
   * יצירת פתק חדש
   */
  createNote: async (noteInput: NoteInput) => {
    try {
      set({ error: null });
      const noteId = await noteAPI.createNote(noteInput);
      return noteId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create note';
      set({ error: errorMessage });
      throw error;
    }
  },

  /**
   * עדכון פתק
   */
  updateNote: async (noteId: string, updates: Partial<NoteInput>) => {
    try {
      set({ error: null });
      await noteAPI.updateNote(noteId, updates);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update note';
      set({ error: errorMessage });
      throw error;
    }
  },

  /**
   * מחיקת פתק (העברה לארכיון)
   */
  deleteNote: async (noteId: string) => {
    try {
      set({ error: null });
      await noteAPI.archiveNote(noteId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to archive note';
      set({ error: errorMessage });
      throw error;
    }
  },

  /**
   * שינוי סדר פתק
   */
  reorderNote: async (noteId: string, newOrder: number) => {
    try {
      set({ error: null });
      await noteAPI.reorderNote(noteId, newOrder);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reorder note';
      set({ error: errorMessage });
      throw error;
    }
  },

  /**
   * הצמדה/ביטול הצמדה של פתק
   */
  togglePinNote: async (noteId: string, isPinned: boolean) => {
    try {
      set({ error: null });
      await noteAPI.togglePinNote(noteId, isPinned);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to toggle pin note';
      set({ error: errorMessage });
      throw error;
    }
  },

  /**
   * קבלת פתקים לפי קטגוריה (מהסטייט המקומי)
   */
  getNotesByCategory: (categoryId: string) => {
    return get().notes.filter(note => note.categoryId === categoryId);
  },

  /**
   * ניקוי שגיאות
   */
  clearError: () => set({ error: null }),
}));
