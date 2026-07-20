/**
 * Hook לפעולות עריכה של פתקים בתוך קטגוריה
 *
 * מרכז את הלוגיקה שהייתה משוכפלת בין `CategoryItem` ל-`CategoryView`:
 * שמירה (יצירה/עדכון), מחיקה, הצמדה, העברה בין קטגוריות ושינוי סדר.
 */

import { useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
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

      const reminderTime = data.reminderTime ? Timestamp.fromDate(data.reminderTime) : null;
      const reminderEnabled = data.reminderEnabled ?? false;

      // תזכורת "חמושה" רק אם היא פעילה ומועדה עוד לפנינו. חישוב מחדש
      // בכל שמירה מטפל גם בהזזת מועד קדימה (חימוש מחדש) וגם בעריכת פתק
      // שתזכורתו כבר נשלחה (נשארת כבויה).
      const reminderPending = reminderEnabled && reminderTime !== null && reminderTime.toMillis() > Date.now();

      if (existingNote) {
        // רק השדות שהטופס עורך - לא אובייקט הפתק כולו
        return run(() =>
          updateNote(existingNote.id, {
            title: data.title,
            content: data.content,
            templateType: data.templateType,
            tags: data.tags,
            color: data.color,
            reminderTime,
            reminderEnabled,
            reminderPending,
            // מועד חדש מאפס את תיעוד השליחה הקודמת
            ...(reminderPending ? { reminderSentAt: null } : {}),
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
        reminderTime,
        reminderEnabled,
        reminderPending,
      };

      return run(() => createNote(newNote));
    },
    [categoryId, createNote, notes.length, run, updateNote, user]
  );

  /** עדכון חלקי מתוך תצוגת הפתק (עריכה inline) */
  const updateNoteFields = useCallback(
    (noteId: string, updates: { title?: string; content?: string }) =>
      run(() => updateNote(noteId, updates)),
    [run, updateNote]
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
   * שינוי סדר בגרירה: מזיז את הפתק הנגרר למקומו של פתק היעד
   * וכותב את הסדר החדש בכתיבה אטומית אחת.
   */
  const moveNoteBefore = useCallback(
    (draggedNoteId: string, targetNoteId: string): Promise<boolean> => {
      if (draggedNoteId === targetNoteId) return Promise.resolve(false);

      const ordered = [...notes].sort((a, b) => a.order - b.order).map((note) => note.id);
      const fromIndex = ordered.indexOf(draggedNoteId);
      const toIndex = ordered.indexOf(targetNoteId);

      if (fromIndex === -1 || toIndex === -1) return Promise.resolve(false);

      const [moved] = ordered.splice(fromIndex, 1);
      ordered.splice(toIndex, 0, moved);

      return run(() => reorderNotes(ordered));
    },
    [notes, reorderNotes, run]
  );

  return {
    notes,
    allNotes,
    saveNote,
    updateNoteFields,
    moveToCategory,
    deleteNote,
    pinNote,
    moveNoteBefore,
  };
};
