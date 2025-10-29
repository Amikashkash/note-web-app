/**
 * Zustand Store לניהול מצב האימות
 */

import { create } from 'zustand';
import { User as FirebaseUser, getRedirectResult } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/services/firebase/config';
import { onAuthChange } from '@/services/firebase/auth';
import type { User, UserSettings } from '@/types';

interface AuthState {
  // State
  firebaseUser: FirebaseUser | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  initialized: boolean;

  // Actions
  setFirebaseUser: (user: FirebaseUser | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  loadUserData: (uid: string) => Promise<void>;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  initialize: () => () => void;
  reset: () => void;
}

/**
 * Store אימות ראשי
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  // State ראשוני
  firebaseUser: null,
  user: null,
  isLoading: true,
  error: null,
  initialized: false,

  /**
   * הגדרת משתמש Firebase
   */
  setFirebaseUser: (firebaseUser) => {
    set({ firebaseUser });
  },

  /**
   * הגדרת נתוני משתמש מלאים
   */
  setUser: (user) => {
    set({ user });
  },

  /**
   * הגדרת מצב טעינה
   */
  setLoading: (isLoading) => {
    set({ isLoading });
  },

  /**
   * הגדרת שגיאה
   */
  setError: (error) => {
    set({ error });
  },

  /**
   * טעינת נתוני משתמש מ-Firestore
   */
  loadUserData: async (uid: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        // Batch state update to prevent re-renders
        set({ user: userData, isLoading: false, error: null });
      } else {
        // User document doesn't exist - this is OK, it will be created
        console.warn('User document not found in Firestore');
        set({ error: null, isLoading: false });
      }
    } catch (error: any) {
      console.error('Error loading user data:', error);
      // Don't block login if Firestore read fails
      set({ error: null, isLoading: false });
    }
  },

  /**
   * עדכון הגדרות משתמש
   */
  updateSettings: async (newSettings: Partial<UserSettings>) => {
    try {
      const { user } = get();
      if (!user) {
        throw new Error('משתמש לא מחובר');
      }

      const userRef = doc(db, 'users', user.uid);
      const updatedSettings = { ...user.settings, ...newSettings };

      await updateDoc(userRef, {
        settings: updatedSettings,
      });

      set({
        user: {
          ...user,
          settings: updatedSettings,
        },
      });
    } catch (error: any) {
      console.error('Error updating settings:', error);
      set({ error: error.message });
      throw error;
    }
  },

  /**
   * אתחול המאזין למצב האימות
   * מחזיר פונקציה לביטול המאזין
   */
  initialize: () => {
    // Check for redirect result first (Google Sign In)
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          // User signed in via redirect
          const userRef = doc(db, 'users', result.user.uid);
          const userDoc = await getDoc(userRef);

          if (!userDoc.exists()) {
            // Create user document
            const userData = {
              uid: result.user.uid,
              email: result.user.email || '',
              displayName: result.user.displayName || '',
              photoURL: result.user.photoURL,
              settings: {
                language: 'he',
                defaultCategoryColor: '#3B82F6',
                theme: 'light',
                encryptionEnabled: false,
                encryptionLevel: 'none',
              },
            };

            await setDoc(userRef, {
              ...userData,
              createdAt: serverTimestamp(),
            });
          }
        }
      })
      .catch((error) => {
        console.error('Error handling redirect result:', error);
      });

    // Set up auth state listener
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        // משתמש מחובר - טען את הנתונים
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userRef);

          if (!userDoc.exists()) {
            // User document doesn't exist - create it
            const userData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              photoURL: firebaseUser.photoURL,
              settings: {
                language: 'he',
                defaultCategoryColor: '#3B82F6',
                theme: 'light',
                encryptionEnabled: false,
                encryptionLevel: 'none',
              },
            };

            await setDoc(userRef, {
              ...userData,
              createdAt: serverTimestamp(),
            });

            // Batch state update to prevent re-renders
            set({
              firebaseUser,
              user: userData as any,
              isLoading: false
            });
          } else {
            // Load existing user data
            const userData = userDoc.data() as User;
            // Batch state update to prevent re-renders
            set({
              firebaseUser,
              user: userData,
              isLoading: false
            });
          }
        } catch (error) {
          console.error('Error in initialize:', error);
          set({ firebaseUser, isLoading: false });
        }
      } else {
        // משתמש התנתק - batch update
        set({ firebaseUser: null, user: null, isLoading: false });
      }
    });

    return unsubscribe;
  },

  /**
   * איפוס ה-Store
   */
  reset: () => {
    set({
      initialized: false,
      firebaseUser: null,
      user: null,
      isLoading: false,
      error: null,
    });
  },
}));
