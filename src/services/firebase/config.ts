/**
 * הגדרות Firebase
 * צריך להגדיר משתני סביבה ב-.env.local
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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
const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value || value === 'your-api-key' || value === 'your-project-id' || value.includes('your-'))
  .map(([key]) => key);

if (missingVars.length > 0) {
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
  throw new Error('Firebase configuration is missing or invalid. Check the console for details.');
}

// הגדרות Firebase - יגיעו ממשתני סביבה
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// אתחול Firebase
const app = initializeApp(firebaseConfig);

// ייצוא שירותים
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
