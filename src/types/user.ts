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

export const DEFAULT_USER_SETTINGS: UserSettings = {
  language: 'he',
  defaultCategoryColor: '#3B82F6',
  theme: 'light',
  encryptionEnabled: false,
  encryptionLevel: 'none',
};
