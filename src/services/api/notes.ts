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
 * כולל גם פתקים משותפים
 */
export const subscribeToNotes = (
  userId: string,
  callback: (notes: Note[]) => void
): Unsubscribe => {
  // Query for owned notes
  const ownedQuery = query(
    collection(db, NOTES_COLLECTION),
    where('userId', '==', userId)
  );

  // Query for shared notes
  const sharedQuery = query(
    collection(db, NOTES_COLLECTION),
    where('sharedWith', 'array-contains', userId)
  );

  // Combine both queries using two listeners
  let ownedNotes: Note[] = [];
  let sharedNotes: Note[] = [];

  const mergeAndCallback = () => {
    // Combine and deduplicate
    const allNotes = [...ownedNotes, ...sharedNotes];
    const uniqueNotes = Array.from(
      new Map(allNotes.map(note => [note.id, note])).values()
    )
      .filter(note => !note.isArchived) // Filter archived notes
      .sort((a, b) => {
        // Sort by categoryId first, then by order
        if (a.categoryId !== b.categoryId) {
          return a.categoryId.localeCompare(b.categoryId);
        }
        return (a.order || 0) - (b.order || 0);
      });

    callback(uniqueNotes);
  };

  const unsubscribeOwned = onSnapshot(
    ownedQuery,
    (snapshot) => {
      ownedNotes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Note));
      mergeAndCallback();
    },
    (error) => {
      console.error('Error in owned notes subscription:', error);
    }
  );

  const unsubscribeShared = onSnapshot(
    sharedQuery,
    (snapshot) => {
      sharedNotes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Note));
      mergeAndCallback();
    },
    (error) => {
      console.error('Error in shared notes subscription:', error);
    }
  );

  // Return a combined unsubscribe function
  return () => {
    unsubscribeOwned();
    unsubscribeShared();
  };
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
    where('categoryId', '==', categoryId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const notes = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Note))
        .filter(note => !note.isArchived) // סינון בצד לקוח - תומך בפתקים ישנים
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

/**
 * שיתוף פתק עם משתמש אחר לפי email
 */
export const shareNoteWithUser = async (
  noteId: string,
  userEmail: string
): Promise<void> => {
  try {
    // Get user ID from email
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', userEmail));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error('משתמש לא נמצא במערכת');
    }

    const targetUserId = snapshot.docs[0].id;

    // Get current note data
    const noteRef = doc(db, NOTES_COLLECTION, noteId);
    const noteSnapshot = await getDocs(query(collection(db, NOTES_COLLECTION), where('__name__', '==', noteId)));

    if (noteSnapshot.empty) {
      throw new Error('פתק לא נמצא');
    }

    const noteData = noteSnapshot.docs[0].data() as Note;
    const currentSharedWith = noteData.sharedWith || [];

    if (currentSharedWith.includes(targetUserId)) {
      throw new Error('הפתק כבר משותף עם משתמש זה');
    }

    await updateDoc(noteRef, {
      sharedWith: [...currentSharedWith, targetUserId],
      updatedAt: Timestamp.now(),
    });
  } catch (error: any) {
    console.error('Error sharing note:', error);
    throw error;
  }
};

/**
 * הסרת משתמש משיתוף פתק
 */
export const unshareNoteWithUser = async (
  noteId: string,
  userId: string
): Promise<void> => {
  try {
    const noteRef = doc(db, NOTES_COLLECTION, noteId);
    const noteSnapshot = await getDocs(query(collection(db, NOTES_COLLECTION), where('__name__', '==', noteId)));

    if (noteSnapshot.empty) {
      throw new Error('פתק לא נמצא');
    }

    const noteData = noteSnapshot.docs[0].data() as Note;
    const currentSharedWith = noteData.sharedWith || [];

    await updateDoc(noteRef, {
      sharedWith: currentSharedWith.filter(id => id !== userId),
      updatedAt: Timestamp.now(),
    });
  } catch (error: any) {
    console.error('Error unsharing note:', error);
    throw new Error('Failed to remove user from note');
  }
};
