/**
 * שירותי אימות Firebase
 * כולל Google Auth ו-Email/Password Auth
 */

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, db } from './config';
import { cancelLocalDataClear, clearLocalData, requestLocalDataClear } from './localData';
import { unregisterDeviceForPush } from '@/services/notifications/fcmService';
import { logger } from '@/utils/logger';
import { getFirebaseErrorCode } from '@/utils/errors';

/**
 * המרת קוד שגיאה של Firebase להודעה בעברית
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
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
  'auth/too-many-requests': 'יותר מדי ניסיונות. נסה שוב בעוד מספר דקות.',
};

const toAuthError = (error: unknown): Error => {
  const code = getFirebaseErrorCode(error);
  const message = (code && AUTH_ERROR_MESSAGES[code]) || 'שגיאה לא צפויה. נסה שוב.';
  return new Error(message, { cause: error });
};

/**
 * רישום משתמש חדש עם אימייל וסיסמה.
 *
 * מסמך המשתמש ב-Firestore נוצר ע"י המאזין ב-`authStore` ולא כאן,
 * כדי שתהיה נקודה אחת בלבד שאחראית עליו.
 */
export const signUpWithEmail = async (
  email: string,
  password: string,
  displayName: string
): Promise<FirebaseUser> => {
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(user, { displayName });
    await sendEmailVerification(user);

    return user;
  } catch (error) {
    logger.error('Error signing up with email:', error);
    throw toAuthError(error);
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
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    return user;
  } catch (error) {
    logger.error('Error signing in with email:', error);
    throw toAuthError(error);
  }
};

/**
 * התחברות עם Google (popup)
 */
export const signInWithGoogle = async (): Promise<void> => {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    await signInWithPopup(auth, provider);
  } catch (error) {
    const code = getFirebaseErrorCode(error);

    // סגירת החלון ע"י המשתמש היא ביטול, לא שגיאה
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      logger.debug('User cancelled Google sign-in');
      return;
    }

    logger.error('Error signing in with Google:', error);
    throw toAuthError(error);
  }
};

/**
 * התנתקות
 *
 * רישום ההתראות של המכשיר מבוטל לפני ההתנתקות עצמה, כדי שמכשיר משותף
 * לא ימשיך לקבל את התזכורות של המשתמש שיצא. הביטול לא חוסם התנתקות
 * אם נכשל - עדיף להתנתק בלי לנקות מאשר לא להתנתק כלל.
 *
 * הנתונים המקומיים (persistence, v1.35.0) נמחקים אחרי ההתנתקות, והדף
 * נטען מחדש - המופע של Firestore מת במחיקה. `keepLocalData`: המשתמש בחר
 * להשאיר אותם, כי יש כתיבות שעוד לא הגיעו לשרת (`localData.ts`). הקורא
 * אחראי לבדוק את זה לפני (`pendingWritesSettle`) - כאן לא שואלים.
 */
export const signOut = async (options: { keepLocalData?: boolean } = {}): Promise<void> => {
  const userId = auth.currentUser?.uid;
  const clear = !options.keepLocalData;

  if (userId) {
    await unregisterDeviceForPush(userId);
  }

  if (clear) requestLocalDataClear();
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    if (clear) cancelLocalDataClear();
    logger.error('Error signing out:', error);
    throw new Error('שגיאה בהתנתקות', { cause: error });
  }

  if (clear) {
    await clearLocalData(db);
    // אותה כתובת: מסלול מוגן מפנה ל-login, עם חזרה לכאן אחרי ההתחברות
    window.location.reload();
  }
};

/**
 * שליחת אימייל לאיפוס סיסמה
 */
export const resetPassword = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    logger.error('Error sending password reset email:', error);
    throw toAuthError(error);
  }
};

/**
 * האזנה לשינויים במצב האימות
 */
export const onAuthChange = (callback: (user: FirebaseUser | null) => void) =>
  onAuthStateChanged(auth, callback);
