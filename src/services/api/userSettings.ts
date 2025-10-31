/**
 * User Settings API - Firestore operations
 */

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import type { UserSettings } from '@/types/userSettings';

const USER_SETTINGS_COLLECTION = 'userSettings';

/**
 * Get user settings
 */
export const getUserSettings = async (userId: string): Promise<UserSettings | null> => {
  const docRef = doc(db, USER_SETTINGS_COLLECTION, userId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as UserSettings;
  }

  return null;
};

/**
 * Create or update user settings
 */
export const saveUserSettings = async (
  userId: string,
  settings: Partial<UserSettings>
): Promise<void> => {
  const docRef = doc(db, USER_SETTINGS_COLLECTION, userId);
  const existingSettings = await getUserSettings(userId);

  if (existingSettings) {
    // Update existing
    await updateDoc(docRef, {
      ...settings,
      updatedAt: new Date(),
    });
  } else {
    // Create new
    await setDoc(docRef, {
      userId,
      ...settings,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
};

/**
 * Save Gemini API Key
 */
export const saveGeminiApiKey = async (userId: string, apiKey: string): Promise<void> => {
  return saveUserSettings(userId, { geminiApiKey: apiKey });
};

/**
 * Get Gemini API Key
 */
export const getGeminiApiKey = async (userId: string): Promise<string | null> => {
  const settings = await getUserSettings(userId);
  return settings?.geminiApiKey || null;
};
