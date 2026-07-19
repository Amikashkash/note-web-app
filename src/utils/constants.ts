/**
 * קבועים גלובליים לאפליקציה
 *
 * הגדרות התבניות (שמות, אייקונים) נמצאות ב-`utils/templates.ts`.
 */

// צבעים זמינים לבחירה
export const AVAILABLE_COLORS = [
  '#3B82F6', // כחול
  '#10B981', // ירוק
  '#F59E0B', // כתום
  '#EF4444', // אדום
  '#8B5CF6', // סגול
  '#EC4899', // ורוד
  '#6B7280', // אפור
  '#14B8A6', // טורקיז
] as const;

// צבעי ברירת מחדל
export const DEFAULT_COLORS = {
  category: '#3B82F6',
  note: null,
} as const;

// הגבלות אורך
export const LENGTH_LIMITS = {
  NOTE_TITLE: 50,
  CATEGORY_NAME: 30,
  TAG_NAME: 20,
} as const;

/** השהיה לפני שמירה אוטומטית בעריכה inline (מילישניות) */
export const AUTOSAVE_DELAY_MS = 600;
