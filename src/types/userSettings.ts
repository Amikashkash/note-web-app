/**
 * User Settings Types
 */

export interface UserSettings {
  userId: string;
  geminiApiKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserSettingsInput = Omit<UserSettings, 'createdAt' | 'updatedAt'>;
