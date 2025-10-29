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
  orderBy,
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
    const categoryData = {
      ...getDefaultCategory(userId, name),
      ...(color && { color }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, CATEGORIES_COLLECTION), categoryData);
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
      where('userId', '==', userId),
      orderBy('order', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Category));
  } catch (error: any) {
    console.error('Error getting categories:', error);
    throw new Error('Failed to get categories');
  }
};

/**
 * Subscribe to categories changes (real-time)
 */
export const subscribeToCategories = (
  userId: string,
  callback: (categories: Category[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, CATEGORIES_COLLECTION),
    where('userId', '==', userId),
    orderBy('order', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const categories = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Category));
      callback(categories);
    },
    (error) => {
      console.error('Error in categories subscription:', error);
    }
  );
};
