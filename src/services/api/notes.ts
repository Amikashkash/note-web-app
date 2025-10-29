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
  orderBy,
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
      where('categoryId', '==', categoryId),
      orderBy('order', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Note));
  } catch (error) {
    console.error('Error getting notes by category:', error);
    throw error;
  }
};

/**
 * מנוי לשינויים בפתקים של משתמש ספציפי
 */
export const subscribeToNotes = (
  userId: string,
  callback: (notes: Note[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, NOTES_COLLECTION),
    where('userId', '==', userId),
    orderBy('categoryId', 'asc'),
    orderBy('order', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const notes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Note));
      callback(notes);
    },
    (error) => {
      console.error('Error in notes subscription:', error);
    }
  );
};

/**
 * מנוי לשינויים בפתקים של קטגוריה ספציפית
 */
export const subscribeToNotesByCategory = (
  categoryId: string,
  callback: (notes: Note[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, NOTES_COLLECTION),
    where('categoryId', '==', categoryId),
    orderBy('order', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const notes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Note));
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
