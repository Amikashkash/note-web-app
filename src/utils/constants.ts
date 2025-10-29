/**
 * קבועים גלובליים לאפליקציה
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

// סוגי תבניות
export const TEMPLATE_TYPES = {
  PLAIN: 'plain',
  CHECKLIST: 'checklist',
  RECIPE: 'recipe',
  SHOPPING: 'shopping',
  IDEA: 'idea',
} as const;

// שמות תבניות בעברית
export const TEMPLATE_NAMES_HE = {
  plain: 'טקסט חופשי',
  checklist: 'רשימת משימות',
  recipe: 'מתכון בישול',
  shopping: 'רשימת קניות',
  idea: 'רעיון מהיר',
} as const;

// שמות תבניות באנגלית
export const TEMPLATE_NAMES_EN = {
  plain: 'Plain Text',
  checklist: 'Checklist',
  recipe: 'Cooking Recipe',
  shopping: 'Shopping List',
  idea: 'Quick Idea',
} as const;
