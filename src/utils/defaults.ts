/**
 * ערכי ברירת מחדל לאפליקציה
 */

import { DEFAULT_COLORS, TEMPLATE_TYPES } from './constants';
import type { UserSettings } from '@/types';

// הגדרות משתמש ברירת מחדל
export const DEFAULT_USER_SETTINGS: UserSettings = {
  language: 'he',
  defaultCategoryColor: DEFAULT_COLORS.category,
  theme: 'light',
  encryptionEnabled: false,
  encryptionLevel: 'none',
};

// ערכי ברירת מחדל לקטגוריה חדשה
export const getDefaultCategory = (userId: string, name: string) => ({
  name,
  color: DEFAULT_COLORS.category,
  icon: null,
  order: 0,
  userId,
  sharedWith: [],
});

// ערכי ברירת מחדל לפתק חדש
export const getDefaultNote = (userId: string, categoryId: string, title: string) => ({
  title,
  content: '',
  categoryId,
  templateType: TEMPLATE_TYPES.PLAIN as 'plain',
  tags: [],
  color: DEFAULT_COLORS.note,
  order: 0,
  userId,
  sharedWith: [],
  isPinned: false,
});
