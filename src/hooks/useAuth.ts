/**
 * Custom Hook לניהול אימות
 * מספק גישה נוחה לפעולות אימות ומצב המשתמש
 */

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import * as authService from '@/services/firebase/auth';

export const useAuth = () => {
  const {
    firebaseUser,
    user,
    isLoading,
    error,
    setError,
    initialize,
    reset,
  } = useAuthStore();

  /**
   * אתחול המאזין למצב האימות
   */
  useEffect(() => {
    const unsubscribe = initialize();
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * רישום עם אימייל וסיסמה
   */
  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      setError(null);
      await authService.signUpWithEmail(email, password, displayName);
    } catch (error: any) {
      setError(error.message);
      throw error;
    }
  };

  /**
   * התחברות עם אימייל וסיסמה
   */
  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      await authService.signInWithEmail(email, password);
    } catch (error: any) {
      setError(error.message);
      throw error;
    }
  };

  /**
   * התחברות עם Google
   */
  const signInWithGoogle = async () => {
    try {
      setError(null);
      await authService.signInWithGoogle();
    } catch (error: any) {
      setError(error.message);
      throw error;
    }
  };

  /**
   * התנתקות
   */
  const signOut = async () => {
    try {
      setError(null);
      await authService.signOut();
      reset();
    } catch (error: any) {
      setError(error.message);
      throw error;
    }
  };

  /**
   * איפוס סיסמה
   */
  const resetPassword = async (email: string) => {
    try {
      setError(null);
      await authService.resetPassword(email);
    } catch (error: any) {
      setError(error.message);
      throw error;
    }
  };

  return {
    // State
    firebaseUser,
    user,
    isLoading,
    error,
    isAuthenticated: !!firebaseUser,

    // Actions
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
  };
};
