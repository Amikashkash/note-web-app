/**
 * Zustand Store לניהול מצב הפתקים
 *
 * ניהול המנוי:
 * הרבה קומפוננטות (כל `CategoryItem`, וכן דפים שונים) צורכות את אותה רשימת
 * פתקים. לכן המנוי ל-Firestore הוא יחיד וגלובלי, עם ספירת מנויים: המאזין
 * נפתח כשהצרכן הראשון נרשם ונסגר רק כשהאחרון עוזב. בלי זה כל קומפוננטה
 * הייתה סוגרת את המאזין המשותף ומרוקנת את הרשימה לכולם.
 */

import { create } from 'zustand';
import { Unsubscribe } from 'firebase/firestore';
import { Note, NoteInput } from '@/types/note';
import * as noteAPI from '@/services/api/notes';
import { getErrorMessage, loadErrorMessage } from '@/utils/errors';
import { logger } from '@/utils/logger';

interface NoteState {
  // מצב
  notes: Note[];
  isLoading: boolean;
  /** האם התקבלה תשובה ראשונה מהמאזין (נתונים או שגיאה) */
  hasLoaded: boolean;
  /** שגיאת טעינה מהמאזין. נפרד מ-`error`, ששייך לפעולות כתיבה */
  loadError: string | null;
  error: string | null;

  // ניהול מנוי פנימי - לא לשימוש ישיר מקומפוננטות
  _unsubscribe: Unsubscribe | null;
  _subscribedUserId: string | null;
  _subscriberCount: number;

  // מנוי
  subscribe: (userId: string) => void;
  unsubscribe: () => void;
  /** הקמה מחדש של המאזין אחרי שגיאת טעינה */
  retry: () => void;

  // פעולות
  createNote: (noteInput: NoteInput) => Promise<string>;
  updateNote: (noteId: string, updates: Partial<NoteInput>) => Promise<void>;
  archiveNote: (noteId: string) => Promise<void>;
  reorderNotes: (orderedIds: string[]) => Promise<void>;
  togglePinNote: (noteId: string, isPinned: boolean) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export const useNoteStore = create<NoteState>((set, get) => {
  /**
   * עוטף פעולת כתיבה: מנקה שגיאה קודמת, ובכישלון שומר הודעה קריאה
   * ומעביר את השגיאה הלאה כדי שהקורא יוכל להגיב.
   */
  const runWrite = async <T>(action: () => Promise<T>): Promise<T> => {
    set({ error: null });
    try {
      return await action();
    } catch (error) {
      set({ error: getErrorMessage(error) });
      throw error;
    }
  };

  /**
   * מקים את המאזין. המאזין הקודם, אם יש, נסגר ע"י הקורא.
   *
   * שגיאה לא מרוקנת את הרשימה: אם רק אחד משני המאזינים (בבעלות /
   * משותפים) נכשל, מה שכן נטען נשאר מוצג, יחד עם הודעת השגיאה.
   */
  const startListener = (userId: string) => {
    set({ isLoading: true, hasLoaded: false, loadError: null });

    const unsubscribe = noteAPI.subscribeToNotes(
      userId,
      (notes) => {
        set((state) => ({ notes, isLoading: false, hasLoaded: true, loadError: state.loadError }));
      },
      (error) => {
        set({ isLoading: false, hasLoaded: true, loadError: loadErrorMessage('הפתקים', error) });
      }
    );

    set({ _unsubscribe: unsubscribe });
  };

  return {
    notes: [],
    isLoading: false,
    hasLoaded: false,
    loadError: null,
    error: null,

    _unsubscribe: null,
    _subscribedUserId: null,
    _subscriberCount: 0,

    subscribe: (userId: string) => {
      const { _subscribedUserId, _subscriberCount, _unsubscribe } = get();

      // כבר מנויים לאותו משתמש - רק מעדכנים את מונה הצרכנים
      if (_subscribedUserId === userId && _unsubscribe) {
        set({ _subscriberCount: _subscriberCount + 1 });
        return;
      }

      // החליף משתמש (התחברות מחדש) - סוגרים את המאזין הישן
      if (_unsubscribe) {
        _unsubscribe();
      }

      logger.debug('Subscribing to notes for user:', userId);
      set({
        notes: [],
        _subscribedUserId: userId,
        _subscriberCount: 1,
      });

      startListener(userId);
    },

    retry: () => {
      const { _subscribedUserId, _unsubscribe } = get();
      if (!_subscribedUserId) return;

      if (_unsubscribe) _unsubscribe();
      startListener(_subscribedUserId);
    },

    unsubscribe: () => {
      const { _subscriberCount, _unsubscribe } = get();
      const remaining = Math.max(0, _subscriberCount - 1);

      if (remaining > 0) {
        set({ _subscriberCount: remaining });
        return;
      }

      // הצרכן האחרון עזב - סוגרים את המאזין בפועל
      if (_unsubscribe) {
        logger.debug('Last subscriber left, closing notes subscription');
        _unsubscribe();
      }

      set({
        notes: [],
        isLoading: false,
        hasLoaded: false,
        loadError: null,
        _unsubscribe: null,
        _subscribedUserId: null,
        _subscriberCount: 0,
      });
    },

    createNote: (noteInput) => runWrite(() => noteAPI.createNote(noteInput)),

    updateNote: (noteId, updates) => runWrite(() => noteAPI.updateNote(noteId, updates)),

    archiveNote: (noteId) => runWrite(() => noteAPI.archiveNote(noteId)),

    reorderNotes: (orderedIds) => runWrite(() => noteAPI.reorderNotes(orderedIds)),

    togglePinNote: (noteId, isPinned) =>
      runWrite(() => noteAPI.togglePinNote(noteId, isPinned)),

    clearError: () => set({ error: null }),

    reset: () => {
      const { _unsubscribe } = get();
      if (_unsubscribe) _unsubscribe();
      set({
        notes: [],
        isLoading: false,
        hasLoaded: false,
        loadError: null,
        error: null,
        _unsubscribe: null,
        _subscribedUserId: null,
        _subscriberCount: 0,
      });
    },
  };
});
