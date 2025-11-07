/**
 * הגדרות Firebase
 * צריך להגדיר משתני סביבה ב-.env.local
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// בדיקת משתני סביבה
const requiredEnvVars = {
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
};

// בדיקה אם כל משתני הסביבה קיימים
export const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value || value === 'your-api-key' || value === 'your-project-id' || value.includes('your-'))
  .map(([key]) => key);

export const isFirebaseConfigured = missingVars.length === 0;

// הדפסת הודעת שגיאה אם יש משתנים חסרים (אך לא לזרוק שגיאה)
if (!isFirebaseConfigured) {
  const errorMessage = `
🔥 Firebase Configuration Missing! 🔥

Please create a .env.local file in the root directory with your Firebase credentials:

Missing or invalid variables:
${missingVars.map(v => `  - ${v}`).join('\n')}

Steps to fix:
1. Copy .env.example to .env.local
2. Go to Firebase Console: https://console.firebase.google.com/
3. Select your project (or create one)
4. Go to Project Settings > General
5. Copy your Firebase config values
6. Paste them into .env.local
7. Restart the dev server (npm run dev)

Example .env.local:
VITE_FIREBASE_API_KEY=AIzaSyC...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
`;

  console.error(errorMessage);
}

// אתחול Firebase רק אם כל המשתנים קיימים
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

// ייצוא שירותים (יכולים להיות null אם Firebase לא מוגדר)
export { auth, db, storage };
export default app;
