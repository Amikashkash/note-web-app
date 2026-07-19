/**
 * Zustand Store לניהול מצב האימות
 *
 * `initialize` נקרא פעם אחת מ-`App` ומקים מאזין יחיד למצב האימות.
 * הוא אידמפוטנטי: קריאה חוזרת לא תפתח מאזין נוסף, כך שגם אם קומפוננטה
 * כלשהי תקרא לו בטעות המצב יישאר עקבי.
 */

import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import { onAuthChange } from '@/services/firebase/auth';
import { upsertUserLookup } from '@/services/api/users';
import { DEFAULT_USER_SETTINGS } from '@/utils/defaults';
import { getErrorMessage } from '@/utils/errors';
import { logger } from '@/utils/logger';
import type { User, UserSettings } from '@/types';

interface AuthState {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  initialized: boolean;

  setError: (error: string | null) => void;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  initialize: () => void;
}

/** המאזין הפעיל למצב האימות - יחיד לכל אורך חיי האפליקציה */
let authUnsubscribe: (() => void) | null = null;

/**
 * מוודא שקיים מסמך משתמש ב-Firestore ומחזיר את נתוניו.
 * זו הנקודה היחידה שיוצרת מסמך משתמש - בהרשמה, בהתחברות עם Google
 * ובכל התחברות של משתמש קיים.
 */
const ensureUserDocument = async (firebaseUser: FirebaseUser): Promise<User> => {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const snapshot = await getDoc(userRef);

  const email = firebaseUser.email ?? '';
  const displayName = firebaseUser.displayName ?? '';

  if (snapshot.exists()) {
    // מרעננים את רשומת החיפוש גם למשתמשים ותיקים, כדי שיהיו ניתנים לשיתוף
    await upsertUserLookup(firebaseUser.uid, email, displayName);
    return snapshot.data() as User;
  }

  logger.debug('Creating user document for', firebaseUser.uid);

  const userData: Omit<User, 'createdAt'> = {
    uid: firebaseUser.uid,
    email,
    displayName,
    photoURL: firebaseUser.photoURL,
    settings: DEFAULT_USER_SETTINGS,
  };

  await setDoc(userRef, { ...userData, createdAt: serverTimestamp() });
  await upsertUserLookup(firebaseUser.uid, email, displayName);

  // `createdAt` נקבע בשרת; עד לרענון הבא נשתמש בערך המקומי
  return userData as User;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  firebaseUser: null,
  user: null,
  isLoading: true,
  error: null,
  initialized: false,

  setError: (error) => set({ error }),

  /**
   * עדכון הגדרות משתמש
   */
  updateSettings: async (newSettings) => {
    const { user } = get();
    if (!user) {
      throw new Error('משתמש לא מחובר');
    }

    const updatedSettings = { ...user.settings, ...newSettings };

    try {
      await updateDoc(doc(db, 'users', user.uid), { settings: updatedSettings });
      set({ user: { ...user, settings: updatedSettings } });
    } catch (error) {
      logger.error('Error updating settings:', error);
      set({ error: getErrorMessage(error) });
      throw error;
    }
  },

  /**
   * הקמת המאזין למצב האימות. בטוח לקריאה חוזרת.
   *
   * המאזין חי לכל אורך חיי האפליקציה ואינו מבוטל בהתנתקות: הוא זה
   * שמנקה את המצב כשמתקבל `null`, ומזהה התחברות חוזרת בלי רענון דף.
   */
  initialize: () => {
    if (get().initialized) return;
    set({ initialized: true });

    // הגנה מפני מאזין כפול אחרי hot-reload בפיתוח
    if (authUnsubscribe) authUnsubscribe();

    authUnsubscribe = onAuthChange(async (firebaseUser) => {
      if (!firebaseUser) {
        logger.debug('User signed out');
        set({ firebaseUser: null, user: null, isLoading: false, error: null });
        return;
      }

      logger.debug('User signed in:', firebaseUser.uid);

      try {
        const user = await ensureUserDocument(firebaseUser);
        set({ firebaseUser, user, isLoading: false, error: null });
      } catch (error) {
        logger.error('Error loading user data:', error);
        // המשתמש מאומת גם אם הקריאה ל-Firestore נכשלה - לא חוסמים אותו,
        // אבל מסמנים את השגיאה כדי שהממשק יוכל להציג התראה.
        set({
          firebaseUser,
          user: null,
          isLoading: false,
          error: 'שגיאה בטעינת נתוני המשתמש',
        });
      }
    });
  },
}));
