/**
 * שירות API לניהול פתקים ב-Firestore
 */

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  Timestamp,
  Unsubscribe,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Note, NoteInput } from '@/types/note';

const NOTES_COLLECTION = 'notes';

/**
 * יצירת פתק חדש
 */
export const createNote = async (noteInput: NoteInput): Promise<string> => {
  try {
    const noteData = {
      ...noteInput,
      isArchived: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, NOTES_COLLECTION), noteData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating note:', error);
    throw error;
  }
};

/**
 * עדכון פתק קיים
 */
export const updateNote = async (
  noteId: string,
  updates: Partial<NoteInput>
): Promise<void> => {
  try {
    const noteRef = doc(db, NOTES_COLLECTION, noteId);
    await updateDoc(noteRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating note:', error);
    throw error;
  }
};

/**
 * מחיקת פתק
 */
export const deleteNote = async (noteId: string): Promise<void> => {
  try {
    const noteRef = doc(db, NOTES_COLLECTION, noteId);
    await deleteDoc(noteRef);
  } catch (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
};

/**
 * קבלת כל הפתקים של קטגוריה ספציפית
 */
export const getNotesByCategory = async (categoryId: string): Promise<Note[]> => {
  try {
    const q = query(
      collection(db, NOTES_COLLECTION),
      where('categoryId', '==', categoryId)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Note))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (error) {
    console.error('Error getting notes by category:', error);
    throw error;
  }
};

/**
 * מנוי לשינויים בפתקים של משתמש ספציפי (ללא מאורכבים)
 */
export const subscribeToNotes = (
  userId: string,
  callback: (notes: Note[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, NOTES_COLLECTION),
    where('userId', '==', userId),
    where('isArchived', '==', false)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const notes = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Note))
        .sort((a, b) => {
          // Sort by categoryId first, then by order
          if (a.categoryId !== b.categoryId) {
            return a.categoryId.localeCompare(b.categoryId);
          }
          return (a.order || 0) - (b.order || 0);
        });
      callback(notes);
    },
    (error) => {
      console.error('Error in notes subscription:', error);
    }
  );
};

/**
 * מנוי לשינויים בפתקים של קטגוריה ספציפית (ללא מאורכבים)
 */
export const subscribeToNotesByCategory = (
  categoryId: string,
  callback: (notes: Note[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, NOTES_COLLECTION),
    where('categoryId', '==', categoryId),
    where('isArchived', '==', false)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const notes = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Note))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      callback(notes);
    },
    (error) => {
      console.error('Error in category notes subscription:', error);
    }
  );
};

/**
 * עדכון סדר פתק (לגרירה)
 */
export const reorderNote = async (
  noteId: string,
  newOrder: number
): Promise<void> => {
  return updateNote(noteId, { order: newOrder });
};

/**
 * הצמדת/ביטול הצמדת פתק
 */
export const togglePinNote = async (
  noteId: string,
  isPinned: boolean
): Promise<void> => {
  return updateNote(noteId, { isPinned });
};

/**
 * העברת פתק לארכיון (מחיקה רכה)
 */
export const archiveNote = async (noteId: string): Promise<void> => {
  try {
    const noteRef = doc(db, NOTES_COLLECTION, noteId);
    await updateDoc(noteRef, {
      isArchived: true,
      archivedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error archiving note:', error);
    throw error;
  }
};

/**
 * שחזור פתק מהארכיון
 */
export const restoreNote = async (noteId: string): Promise<void> => {
  try {
    const noteRef = doc(db, NOTES_COLLECTION, noteId);
    await updateDoc(noteRef, {
      isArchived: false,
      archivedAt: null,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error restoring note:', error);
    throw error;
  }
};

/**
 * מחיקה סופית של פתק
 */
export const permanentlyDeleteNote = async (noteId: string): Promise<void> => {
  return deleteNote(noteId);
};

/**
 * מנוי לפתקים מאורכבים של משתמש
 */
export const subscribeToArchivedNotes = (
  userId: string,
  callback: (notes: Note[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, NOTES_COLLECTION),
    where('userId', '==', userId),
    where('isArchived', '==', true)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const notes = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Note))
        .sort((a, b) => {
          // Sort by archivedAt descending (newest first)
          const aTime = a.archivedAt?.toMillis() || 0;
          const bTime = b.archivedAt?.toMillis() || 0;
          return bTime - aTime;
        });
      callback(notes);
    },
    (error) => {
      console.error('Error in archived notes subscription:', error);
    }
  );
};
