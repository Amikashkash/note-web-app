/**
 * מרשם התבניות - מקור אמת יחיד
 *
 * כל תווית, אייקון או רשימת תבניות באפליקציה נגזרת מכאן.
 * הוספת תבנית חדשה = הוספת רשומה אחת כאן בלבד.
 */

import {
  ChefHat,
  ClipboardList,
  FileText,
  ListChecks,
  ShoppingCart,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { TemplateType } from '@/types/note';

export interface TemplateMeta {
  /** שם התבנית לתצוגה */
  label: string;
  /**
   * אמוג'י לשימוש בטקסט בלבד - ייצוא Markdown ושיתוף.
   * קובץ טקסט לא יכול לרנדר רכיב, ושם אמוג'י הוא הייצוג הנכון.
   * בממשק משתמשים ב-`Icon`.
   */
  icon: string;
  /** אייקון לממשק */
  Icon: LucideIcon;
  /** האם התבנית מוצגת בבורר התבניות של טופס פתק חדש */
  selectable: boolean;
  /** האם התוכן נערך כטקסט חופשי (ולא ע"י קומפוננטת תבנית ייעודית) */
  freeText: boolean;
}

export const TEMPLATES: Record<TemplateType, TemplateMeta> = {
  plain: { label: 'טקסט חופשי', icon: '📝', Icon: FileText, selectable: true, freeText: true },
  checklist: { label: 'רשימת משימות', icon: '✅', Icon: ListChecks, selectable: true, freeText: false },
  shopping: { label: 'רשימת קניות', icon: '🛒', Icon: ShoppingCart, selectable: true, freeText: false },
  workplan: { label: 'תכנית עבודה', icon: '📋', Icon: ClipboardList, selectable: true, freeText: false },
  accounting: { label: 'חשבונאות', icon: '💰', Icon: Wallet, selectable: true, freeText: false },
  // מתכון הוסר מהבורר - ה-AI מסדר מתכונים היטב כטקסט חופשי.
  // הערך נשמר כדי שפתקים ישנים מסוג זה ימשיכו להיפתח כרגיל.
  recipe: { label: 'מתכון', icon: '🍳', Icon: ChefHat, selectable: false, freeText: false },
};

/**
 * ברירת מחדל לסוג תבנית שלא מוכר.
 *
 * חלה גם על פתקים ישנים מסוג `aisummary`, שהתבנית שלהם הוסרה: הם
 * נפתחים כטקסט חופשי במקום לקרוס, והתוכן שלהם נשאר כפי שהוא.
 */
const FALLBACK: TemplateMeta = {
  label: 'פתק',
  icon: '📝',
  Icon: FileText,
  selectable: false,
  freeText: true,
};

export const getTemplateMeta = (type: TemplateType | string): TemplateMeta =>
  TEMPLATES[type as TemplateType] ?? FALLBACK;

export const getTemplateLabel = (type: TemplateType | string): string =>
  getTemplateMeta(type).label;

/** אמוג'י לטקסט - ייצוא ושיתוף. בממשק יש להשתמש ב-`getTemplateMeta(...).Icon`. */
export const getTemplateIcon = (type: TemplateType | string): string =>
  getTemplateMeta(type).icon;

/** התבניות שניתן לבחור בטופס פתק חדש, לפי סדר התצוגה */
export const SELECTABLE_TEMPLATES = (
  Object.entries(TEMPLATES) as [TemplateType, TemplateMeta][]
)
  .filter(([, meta]) => meta.selectable)
  .map(([value, meta]) => ({ value, ...meta }));
