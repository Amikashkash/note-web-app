/**
 * Hook לפעולות עריכה של פתקים בתוך קטגוריה
 *
 * מרכז את הלוגיקה שהייתה משוכפלת בין `CategoryItem` ל-`CategoryView`:
 * שמירה (יצירה/עדכון), מחיקה, הצמדה, העברה בין קטגוריות ושינוי סדר.
 */

import { useCallback } from 'react';
import { useNotes } from './useNotes';
import { useAuthStore } from '@/store/authStore';
import { getErrorMessage } from '@/utils/errors';
import { logger } from '@/utils/logger';
import type { Note, NoteFormData, NoteInput } from '@/types/note';

export const useNoteEditor = (categoryId: string) => {
  const user = useAuthStore((state) => state.user);
  const { notes, allNotes, createNote, updateNote, archiveNote, reorderNotes, togglePinNote } =
    useNotes(categoryId);

  /**
   * מריץ פעולה ומציג הודעה למשתמש בכישלון.
   * מחזיר `true` בהצלחה כדי שהקורא יוכל לסגור מודאל וכדומה.
   */
  const run = useCallback(async (action: () => Promise<unknown>): Promise<boolean> => {
    try {
      await action();
      return true;
    } catch (error) {
      logger.error('Note operation failed:', error);
      window.alert(getErrorMessage(error));
      return false;
    }
  }, []);

  /**
   * שמירת פתק - יצירה או עדכון, לפי האם התקבל פתק קיים
   */
  const saveNote = useCallback(
    (data: NoteFormData, existingNote?: Note | null): Promise<boolean> => {
      if (!user) return Promise.resolve(false);

      if (existingNote) {
        // רק השדות שהטופס עורך - לא אובייקט הפתק כולו
        return run(() =>
          updateNote(existingNote.id, {
            title: data.title,
            content: data.content,
            templateType: data.templateType,
            tags: data.tags,
            color: data.color,
          })
        );
      }

      const newNote: NoteInput = {
        title: data.title,
        content: data.content,
        templateType: data.templateType,
        tags: data.tags,
        color: data.color,
        categoryId,
        userId: user.uid,
        order: notes.length,
        sharedWith: [],
        isPinned: false,
        isSensitive: false,
        isReadOnly: false,
      };

      return run(() => createNote(newNote));
    },
    [categoryId, createNote, notes.length, run, updateNote, user]
  );

  const moveToCategory = useCallback(
    (noteId: string, newCategoryId: string) =>
      run(() => updateNote(noteId, { categoryId: newCategoryId })),
    [run, updateNote]
  );

  const deleteNote = useCallback((noteId: string) => run(() => archiveNote(noteId)), [run, archiveNote]);

  const pinNote = useCallback(
    (noteId: string, isPinned: boolean) => run(() => togglePinNote(noteId, isPinned)),
    [run, togglePinNote]
  );

  /**
   * שינוי סדר בגרירה: הסדר החדש של כל הפתקים בקטגוריה (כפי שהם מוצגים),
   * בכתיבה אטומית אחת.
   */
  const reorder = useCallback(
    (orderedIds: string[]): Promise<boolean> => run(() => reorderNotes(orderedIds)),
    [reorderNotes, run]
  );

  return {
    notes,
    allNotes,
    saveNote,
    moveToCategory,
    deleteNote,
    pinNote,
    reorder,
  };
};
