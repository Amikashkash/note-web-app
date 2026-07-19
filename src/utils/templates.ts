/**
 * מרשם התבניות - מקור אמת יחיד
 *
 * כל תווית, אייקון או רשימת תבניות באפליקציה נגזרת מכאן.
 * הוספת תבנית חדשה = הוספת רשומה אחת כאן בלבד.
 */

import type { TemplateType } from '@/types/note';

export interface TemplateMeta {
  /** שם התבנית לתצוגה */
  label: string;
  /** אייקון קצר (אמוג'י) */
  icon: string;
  /** האם התבנית מוצגת בבורר התבניות של טופס פתק חדש */
  selectable: boolean;
  /** האם התוכן נערך כטקסט חופשי (ולא ע"י קומפוננטת תבנית ייעודית) */
  freeText: boolean;
}

export const TEMPLATES: Record<TemplateType, TemplateMeta> = {
  aisummary: { label: 'סיכום AI', icon: '🤖', selectable: true, freeText: false },
  plain: { label: 'טקסט חופשי', icon: '📝', selectable: true, freeText: true },
  checklist: { label: 'רשימת משימות', icon: '✅', selectable: true, freeText: false },
  shopping: { label: 'רשימת קניות', icon: '🛒', selectable: true, freeText: false },
  workplan: { label: 'תכנית עבודה', icon: '📋', selectable: true, freeText: false },
  accounting: { label: 'חשבונאות', icon: '💰', selectable: true, freeText: false },
  // מתכון הוסר מהבורר - ה-AI מסדר מתכונים היטב כטקסט חופשי.
  // הערך נשמר כדי שפתקים ישנים מסוג זה ימשיכו להיפתח כרגיל.
  recipe: { label: 'מתכון', icon: '🍳', selectable: false, freeText: false },
};

/** ברירת מחדל לסוג תבנית שלא מוכר (למשל פתק שנוצר בגרסה עתידית) */
const FALLBACK: TemplateMeta = {
  label: 'פתק',
  icon: '📝',
  selectable: false,
  freeText: true,
};

export const getTemplateMeta = (type: TemplateType | string): TemplateMeta =>
  TEMPLATES[type as TemplateType] ?? FALLBACK;

export const getTemplateLabel = (type: TemplateType | string): string =>
  getTemplateMeta(type).label;

export const getTemplateIcon = (type: TemplateType | string): string =>
  getTemplateMeta(type).icon;

/** התבניות שניתן לבחור בטופס פתק חדש, לפי סדר התצוגה */
export const SELECTABLE_TEMPLATES = (
  Object.entries(TEMPLATES) as [TemplateType, TemplateMeta][]
)
  .filter(([, meta]) => meta.selectable)
  .map(([value, meta]) => ({ value, ...meta }));
