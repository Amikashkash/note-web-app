/**
 * Firestore API for Categories
 * CRUD operations for category management
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import { getDefaultCategory } from '@/utils/defaults';
import type { Category, CategoryInput } from '@/types';

const CATEGORIES_COLLECTION = 'categories';

/**
 * Create a new category
 */
export const createCategory = async (
  userId: string,
  name: string,
  color?: string
): Promise<string> => {
  try {
    console.log('Creating category:', { userId, name, color });
    const categoryData = {
      ...getDefaultCategory(userId, name),
      ...(color && { color }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    console.log('Category data:', categoryData);
    const docRef = await addDoc(collection(db, CATEGORIES_COLLECTION), categoryData);
    console.log('Category created with ID:', docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error('Error creating category:', error);
    throw new Error('Failed to create category');
  }
};

/**
 * Update an existing category
 */
export const updateCategory = async (
  categoryId: string,
  updates: Partial<CategoryInput>
): Promise<void> => {
  try {
    const categoryRef = doc(db, CATEGORIES_COLLECTION, categoryId);
    await updateDoc(categoryRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error updating category:', error);
    throw new Error('Failed to update category');
  }
};

/**
 * Delete a category
 */
export const deleteCategory = async (categoryId: string): Promise<void> => {
  try {
    const categoryRef = doc(db, CATEGORIES_COLLECTION, categoryId);
    await deleteDoc(categoryRef);
  } catch (error: any) {
    console.error('Error deleting category:', error);
    throw new Error('Failed to delete category');
  }
};

/**
 * Get all categories for a user (one-time fetch)
 */
export const getUserCategories = async (userId: string): Promise<Category[]> => {
  try {
    const q = query(
      collection(db, CATEGORIES_COLLECTION),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Category))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (error: any) {
    console.error('Error getting categories:', error);
    throw new Error('Failed to get categories');
  }
};

/**
 * Subscribe to categories changes (real-time)
 * Includes both owned categories and categories shared with the user
 */
export const subscribeToCategories = (
  userId: string,
  callback: (categories: Category[]) => void
): Unsubscribe => {
  console.log('Setting up categories subscription for user:', userId);

  // Query for owned categories
  const ownedQuery = query(
    collection(db, CATEGORIES_COLLECTION),
    where('userId', '==', userId)
  );

  // Query for shared categories
  const sharedQuery = query(
    collection(db, CATEGORIES_COLLECTION),
    where('sharedWith', 'array-contains', userId)
  );

  // We need to combine both queries
  // Firestore doesn't support OR queries directly, so we'll use two listeners
  let ownedCategories: Category[] = [];
  let sharedCategories: Category[] = [];

  const mergeAndCallback = () => {
    // Combine and deduplicate
    const allCategories = [...ownedCategories, ...sharedCategories];
    const uniqueCategories = Array.from(
      new Map(allCategories.map(cat => [cat.id, cat])).values()
    ).sort((a, b) => (a.order || 0) - (b.order || 0));

    console.log('Merged categories:', uniqueCategories.length);
    callback(uniqueCategories);
  };

  const unsubscribeOwned = onSnapshot(
    ownedQuery,
    (snapshot) => {
      console.log('Owned categories subscription fired, doc count:', snapshot.docs.length);
      ownedCategories = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Category));
      mergeAndCallback();
    },
    (error) => {
      console.error('Error in owned categories subscription:', error);
    }
  );

  const unsubscribeShared = onSnapshot(
    sharedQuery,
    (snapshot) => {
      console.log('Shared categories subscription fired, doc count:', snapshot.docs.length);
      sharedCategories = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Category));
      mergeAndCallback();
    },
    (error) => {
      console.error('Error in shared categories subscription:', error);
    }
  );

  // Return a combined unsubscribe function
  return () => {
    unsubscribeOwned();
    unsubscribeShared();
  };
};

/**
 * Share a category with another user by email
 */
export const shareCategoryWithUser = async (
  categoryId: string,
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

    // Update category to add user to sharedWith array
    const categoryRef = doc(db, CATEGORIES_COLLECTION, categoryId);
    const categorySnapshot = await getDocs(query(collection(db, CATEGORIES_COLLECTION), where('__name__', '==', categoryId)));

    if (categorySnapshot.empty) {
      throw new Error('קטגוריה לא נמצאה');
    }

    const categoryData = categorySnapshot.docs[0].data() as Category;
    const currentSharedWith = categoryData.sharedWith || [];

    if (currentSharedWith.includes(targetUserId)) {
      throw new Error('הקטגוריה כבר משותפת עם משתמש זה');
    }

    // Share the category
    await updateDoc(categoryRef, {
      sharedWith: [...currentSharedWith, targetUserId],
      updatedAt: serverTimestamp(),
    });

    // Share all notes in this category
    const notesRef = collection(db, 'notes');
    const notesQuery = query(notesRef, where('categoryId', '==', categoryId));
    const notesSnapshot = await getDocs(notesQuery);

    console.log(`Sharing ${notesSnapshot.size} notes in category ${categoryId} with user ${targetUserId}`);

    // Update all notes in this category to add the user to sharedWith
    const updatePromises = notesSnapshot.docs.map(async (noteDoc) => {
      const noteData = noteDoc.data();
      const noteSharedWith = noteData.sharedWith || [];

      if (!noteSharedWith.includes(targetUserId)) {
        const noteRef = doc(db, 'notes', noteDoc.id);
        await updateDoc(noteRef, {
          sharedWith: [...noteSharedWith, targetUserId],
          updatedAt: serverTimestamp(),
        });
      }
    });

    await Promise.all(updatePromises);
    console.log(`Successfully shared category and all notes with ${userEmail}`);
  } catch (error: any) {
    console.error('Error sharing category:', error);
    throw error;
  }
};

/**
 * Remove a user from shared category
 */
export const unshareCategoryWithUser = async (
  categoryId: string,
  userId: string
): Promise<void> => {
  try {
    const categoryRef = doc(db, CATEGORIES_COLLECTION, categoryId);
    const categorySnapshot = await getDocs(query(collection(db, CATEGORIES_COLLECTION), where('__name__', '==', categoryId)));

    if (categorySnapshot.empty) {
      throw new Error('קטגוריה לא נמצאה');
    }

    const categoryData = categorySnapshot.docs[0].data() as Category;
    const currentSharedWith = categoryData.sharedWith || [];

    // Unshare the category
    await updateDoc(categoryRef, {
      sharedWith: currentSharedWith.filter((id: string) => id !== userId),
      updatedAt: serverTimestamp(),
    });

    // Unshare all notes in this category
    const notesRef = collection(db, 'notes');
    const notesQuery = query(notesRef, where('categoryId', '==', categoryId));
    const notesSnapshot = await getDocs(notesQuery);

    console.log(`Unsharing ${notesSnapshot.size} notes in category ${categoryId} from user ${userId}`);

    // Update all notes in this category to remove the user from sharedWith
    const updatePromises = notesSnapshot.docs.map(async (noteDoc) => {
      const noteData = noteDoc.data();
      const noteSharedWith = noteData.sharedWith || [];

      if (noteSharedWith.includes(userId)) {
        const noteRef = doc(db, 'notes', noteDoc.id);
        await updateDoc(noteRef, {
          sharedWith: noteSharedWith.filter((id: string) => id !== userId),
          updatedAt: serverTimestamp(),
        });
      }
    });

    await Promise.all(updatePromises);
    console.log(`Successfully unshared category and all notes from user ${userId}`);
  } catch (error: any) {
    console.error('Error unsharing category:', error);
    throw new Error('Failed to remove user from category');
  }
};
