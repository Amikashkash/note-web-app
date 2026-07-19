/**
 * Hook לניהול אימות
 *
 * קריאה בלבד למצב + עטיפה לפעולות האימות. הקמת המאזין נעשית פעם אחת
 * ב-`App` דרך `useAuthStore.initialize()`, ולא כאן - אחרת כל קומפוננטה
 * שמשתמשת ב-hook הייתה מקימה מאזין נוסף.
 */

import { useAuthStore } from '@/store/authStore';
import * as authService from '@/services/firebase/auth';
import { getErrorMessage } from '@/utils/errors';

export const useAuth = () => {
  const firebaseUser = useAuthStore((state) => state.firebaseUser);
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const setError = useAuthStore((state) => state.setError);

  /**
   * מריץ פעולת אימות, שומר את הודעת השגיאה במצב ומעביר אותה הלאה.
   */
  const run = async <T>(action: () => Promise<T>): Promise<T> => {
    setError(null);
    try {
      return await action();
    } catch (error) {
      setError(getErrorMessage(error));
      throw error;
    }
  };

  return {
    firebaseUser,
    user,
    isLoading,
    error,
    isAuthenticated: !!firebaseUser,

    signUp: (email: string, password: string, displayName: string) =>
      run(() => authService.signUpWithEmail(email, password, displayName)),

    signIn: (email: string, password: string) =>
      run(() => authService.signInWithEmail(email, password)),

    signInWithGoogle: () => run(() => authService.signInWithGoogle()),

    // ניקוי המצב נעשה ע"י המאזין ב-`authStore` כשמתקבל משתמש `null`,
    // וה-hooks של הפתקים והקטגוריות סוגרים את המנויים שלהם בתגובה.
    signOut: () => run(() => authService.signOut()),

    resetPassword: (email: string) => run(() => authService.resetPassword(email)),
  };
};
