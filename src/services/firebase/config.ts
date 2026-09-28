/**
 * הגדרות Firebase
 * צריך להגדיר משתני סביבה ב-.env.local
 *
 * הערה על טיפוסים: `auth`, `db` ו-`storage` מיוצאים כטיפוסים לא-nullable
 * למרות שהאתחול מותנה בקיום משתני הסביבה. זה בטוח כי `FirebaseConfigCheck`
 * עוטף את כל האפליקציה וחוסם רינדור כשההגדרות חסרות - כלומר שום קוד
 * שמשתמש בשירותים האלה לא רץ לפני שהם אותחלו. אם בכל זאת מישהו יגש אליהם
 * מוקדם מדי, ה-Proxy למטה יזרוק שגיאה מפורשת במקום `undefined` מסתורי.
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { connectFunctionsEmulator, getFunctions, Functions } from 'firebase/functions';

// בדיקת משתני סביבה
const requiredEnvVars = {
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const missingVars = Object.entries(requiredEnvVars)
  .filter(([, value]) => !value || value.includes('your-'))
  .map(([key]) => key);

export const isFirebaseConfigured = missingVars.length === 0;

/**
 * ממלא מקום לשירות שלא אותחל. כל גישה אליו זורקת שגיאה ברורה,
 * כך שבעיית תצורה מתגלה מיד ובמקום הנכון.
 */
const uninitialized = <T extends object>(serviceName: string): T =>
  new Proxy({} as T, {
    get() {
      throw new Error(
        `Firebase ${serviceName} is not initialized. Missing env vars: ${missingVars.join(', ')}`
      );
    },
  });

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;
let functionsInstance: Functions | null = null;

if (isFirebaseConfigured) {
  app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });

  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
  storageInstance = getStorage(app);
  // אותו region שבו הפונקציות נפרסות (`setGlobalOptions` ב-`functions/src/index.ts`)
  functionsInstance = getFunctions(app, 'europe-west1');

  // פיתוח בלבד: האפליקציה מול ה-emulators, בלי לגעת בנתונים אמיתיים.
  // `VITE_USE_EMULATORS=true npm run dev`, עם `firebase emulators:start
  // --only auth,firestore,functions --project demo-notes-4-me`. בפרודקשן
  // `import.meta.env.DEV` הוא false, והקוד הזה נמחק מה-bundle.
  if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
    connectAuthEmulator(authInstance, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(dbInstance, '127.0.0.1', 8080);
    connectFunctionsEmulator(functionsInstance, '127.0.0.1', 5001);
  }
} else {
  console.error(
    [
      '🔥 Firebase Configuration Missing 🔥',
      '',
      'Missing or invalid variables:',
      ...missingVars.map((v) => `  - ${v}`),
      '',
      'Fix: copy .env.example to .env.local, fill in the values from',
      'https://console.firebase.google.com/ (Project Settings → General),',
      'then restart the dev server.',
    ].join('\n')
  );
}

/**
 * מפתח VAPID לזיהוי השולח מול שירות ה-push של הדפדפן.
 * מפתח ציבורי - נוצר ב-Firebase Console תחת Cloud Messaging.
 * לא נכלל ב-`requiredEnvVars` כי בלעדיו האפליקציה עובדת, רק בלי התראות.
 */
export const vapidKey: string = import.meta.env.VITE_FIREBASE_VAPID_KEY ?? '';

export const isPushConfigured = isFirebaseConfigured && vapidKey.length > 0;

export const auth: Auth = authInstance ?? uninitialized<Auth>('Auth');
export const db: Firestore = dbInstance ?? uninitialized<Firestore>('Firestore');
export const storage: FirebaseStorage =
  storageInstance ?? uninitialized<FirebaseStorage>('Storage');
export const functions: Functions = functionsInstance ?? uninitialized<Functions>('Functions');

export default app;
