/**
 * טיפוסים הקשורים למשתמשים
 */

import { Timestamp } from 'firebase/firestore';

export interface UserSettings {
  language: 'he' | 'en';
  defaultCategoryColor: string;
  theme: 'light' | 'dark';
  encryptionEnabled: boolean;
  encryptionLevel: 'none' | 'content' | 'full';
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  createdAt: Timestamp;
  settings: UserSettings;
}

// ערכי ברירת המחדל עצמם נמצאים ב-`utils/defaults.ts` -
// קובץ טיפוסים לא אמור להחזיק ערכים בזמן ריצה.
