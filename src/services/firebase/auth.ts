/**
 * שירותי אימות Firebase
 * כולל Google Auth, Email/Password Auth
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';
import { DEFAULT_USER_SETTINGS } from '@/utils/defaults';
import type { User } from '@/types';

/**
 * רישום משתמש חדש עם אימייל וסיסמה
 */
export const signUpWithEmail = async (
  email: string,
  password: string,
  displayName: string
): Promise<FirebaseUser> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // עדכון שם המשתמש
    await updateProfile(user, { displayName });

    // שליחת אימייל אימות
    await sendEmailVerification(user);

    // יצירת מסמך משתמש ב-Firestore
    await createUserDocument(user);

    return user;
  } catch (error: any) {
    console.error('Error signing up with email:', error);
    throw new Error(getAuthErrorMessage(error.code));
  }
};

/**
 * התחברות עם אימייל וסיסמה
 */
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<FirebaseUser> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    console.error('Error signing in with email:', error);
    throw new Error(getAuthErrorMessage(error.code));
  }
};

/**
 * התחברות עם Google - using popup (more reliable)
 */
export const signInWithGoogle = async (): Promise<void> => {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account',
    });

    // Use popup instead of redirect - more reliable and easier to debug
    const { signInWithPopup } = await import('firebase/auth');
    const result = await signInWithPopup(auth, provider);

    console.log('✅ Google sign-in successful:', result.user.email);

    // Note: User document creation is handled by onAuthStateChanged in authStore
    // No need to create it here to avoid race conditions
  } catch (error: any) {
    console.error('❌ Error signing in with Google:', error);

    // Don't throw error if user closed the popup
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      console.log('User cancelled Google sign-in');
      return;
    }

    throw new Error(getAuthErrorMessage(error.code));
  }
};

/**
 * התנתקות
 */
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error: any) {
    console.error('Error signing out:', error);
    throw new Error('שגיאה בהתנתקות');
  }
};

/**
 * שליחת אימייל לאיפוס סיסמה
 */
export const resetPassword = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    console.error('Error sending password reset email:', error);
    throw new Error(getAuthErrorMessage(error.code));
  }
};

/**
 * יצירת מסמך משתמש ב-Firestore
 */
const createUserDocument = async (firebaseUser: FirebaseUser): Promise<void> => {
  const userRef = doc(db, 'users', firebaseUser.uid);

  const userData: Omit<User, 'createdAt'> = {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || '',
    photoURL: firebaseUser.photoURL,
    settings: DEFAULT_USER_SETTINGS,
  };

  await setDoc(userRef, {
    ...userData,
    createdAt: serverTimestamp(),
  });
};

/**
 * האזנה לשינויים במצב האימות
 */
export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * המרת קוד שגיאה להודעה בעברית
 */
const getAuthErrorMessage = (errorCode: string): string => {
  const errorMessages: Record<string, string> = {
    'auth/email-already-in-use': 'כתובת האימייל כבר בשימוש',
    'auth/invalid-email': 'כתובת אימייל לא תקינה',
    'auth/operation-not-allowed': 'הפעולה לא מורשית',
    'auth/weak-password': 'הסיסמה חלשה מדי (לפחות 6 תווים)',
    'auth/user-disabled': 'המשתמש חסום',
    'auth/user-not-found': 'משתמש לא נמצא',
    'auth/wrong-password': 'סיסמה שגויה',
    'auth/invalid-credential': 'פרטי התחברות שגויים',
    'auth/popup-closed-by-user': 'החלון נסגר על ידי המשתמש',
    'auth/cancelled-popup-request': 'הבקשה בוטלה',
    'auth/network-request-failed': 'שגיאת רשת - בדוק את החיבור לאינטרנט',
  };

  return errorMessages[errorCode] || 'שגיאה לא צפויה. נסה שוב.';
};
