/**
 * תוכן פתק כפי ששכבת הנתונים מחזירה אותו: גולמי, מפוענח ומרונדר.
 *
 * הפענוח עצמו הוא המראות (`templateContent.ts`, `render.ts`), כדי שהשרת
 * יראה כל פתק בדיוק כמו האפליקציה. מה שנוסף כאן הוא שמירת שדות לא
 * מוכרים (mcp-plan §4.2): המפענחים של האפליקציה מחזירים רק את השדות
 * שהם מכירים (review D-3), ולכן כל פריט מקבל כאן גם `extra` - מה שהיה
 * בפריט הגולמי ולא נכנס לפריט המנורמל. `serializeContent` כותב את שניהם,
 * כך שפענוח ואחריו כתיבה לא מוחקים מידע של גרסה אחרת של האפליקציה
 * (למשל `category` ישן ברשימת קניות).
 *
 * לא משנים את המראות עצמן: הן חייבות להישאר זהות למקור כדי שבדיקת
 * ההשוואה תהיה בעלת משמעות.
 */

import { renderNoteContent } from './render';
import {
  parseAccounting,
  parseChecklist,
  parseRecipe,
  parseShopping,
  parseWorkPlan,
  type ParseResult,
} from './templateContent';
import type {
  AccountingRow,
  ChecklistItem,
  RecipeData,
  ShoppingItem,
  TemplateType,
  WorkPlanSection,
} from './types';

export type { AccountingRow, ChecklistItem, RecipeData, ShoppingItem, TemplateType, WorkPlanSection };

/** שדות מהמסמך הגולמי שאין להם מקום בטיפוס המנורמל */
export type Extra = Record<string, unknown>;

export type WithExtra<T> = T & { extra: Extra };

export type ParsedContent =
  | { kind: 'plain'; text: string }
  | { kind: 'checklist'; items: WithExtra<ChecklistItem>[] }
  | { kind: 'shopping'; items: WithExtra<ShoppingItem>[] }
  | { kind: 'workplan'; sections: WithExtra<WorkPlanSection>[] }
  | { kind: 'accounting'; rows: WithExtra<AccountingRow>[] }
  | { kind: 'recipe'; recipe: WithExtra<RecipeData> }
  /**
   * התוכן לא מתאים לתבנית הרשומה (או שהתבנית לא מוכרת). `raw` הוא
   * הנתון היחיד שאפשר לסמוך עליו, ואין מה לכתוב בחזרה.
   */
  | { kind: 'unparsed' };

export interface NoteContent {
  templateType: string;
  /** המחרוזת כפי שהיא ב-Firestore */
  raw: string;
  parsed: ParsedContent;
  /** Markdown קריא - אותו טקסט שהאפליקציה מציגה בהיסטוריה ובגיבוי */
  text: string;
}

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * השדות הגולמיים שהערך המנורמל לא נושא. כולל שדה מוכר שהמפענח השמיט
 * (למשל `repeat` עם ערך שהגרסה הזו לא מכירה), כדי שגם הוא יישמר.
 */
const extraOf = (raw: unknown, normalized: object): Extra => {
  if (!isObject(raw)) return {};
  const known = normalized as JsonObject;
  return Object.fromEntries(Object.entries(raw).filter(([key]) => known[key] === undefined));
};

/** המערך הגולמי, אחרי שהמראה כבר אישרה שהוא מערך אובייקטים (או ריק) */
const rawRows = (content: string): unknown[] => {
  if (content.trim() === '') return [];
  const parsed: unknown = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : [];
};

const withExtras = <T extends object>(
  content: string,
  result: ParseResult<T[]>
): WithExtra<T>[] | null => {
  if (!result.ok) return null;
  const raws = rawRows(content);
  return result.value.map((item, index) => ({ ...item, extra: extraOf(raws[index], item) }));
};

const parseStructured = (templateType: string, content: string): ParsedContent => {
  switch (templateType) {
    case 'plain':
      return { kind: 'plain', text: content };
    case 'checklist': {
      const items = withExtras(content, parseChecklist(content));
      return items ? { kind: 'checklist', items } : { kind: 'unparsed' };
    }
    case 'shopping': {
      const items = withExtras(content, parseShopping(content));
      return items ? { kind: 'shopping', items } : { kind: 'unparsed' };
    }
    case 'workplan': {
      const sections = withExtras(content, parseWorkPlan(content));
      return sections ? { kind: 'workplan', sections } : { kind: 'unparsed' };
    }
    case 'accounting': {
      const rows = withExtras(content, parseAccounting(content));
      return rows ? { kind: 'accounting', rows } : { kind: 'unparsed' };
    }
    case 'recipe': {
      const result = parseRecipe(content);
      if (!result.ok) return { kind: 'unparsed' };
      const raw: unknown = content.trim() === '' ? {} : JSON.parse(content);
      return { kind: 'recipe', recipe: { ...result.value, extra: extraOf(raw, result.value) } };
    }
    default:
      // תבנית שהוסרה (למשל `aisummary`) - אין פענוח שאפשר לכתוב בחזרה
      return { kind: 'unparsed' };
  }
};

export const parseContent = (templateType: string, content: string): NoteContent => ({
  templateType,
  raw: content,
  parsed: parseStructured(templateType, content),
  text: renderNoteContent({ content, templateType: templateType as TemplateType }),
});

/** השדות המוגדרים בלבד - שדה אופציונלי חסר לא נכתב כ-`undefined` */
const definedOnly = (value: object): JsonObject =>
  Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined));

const serializeItem = <T extends object>({ extra, ...item }: WithExtra<T>): JsonObject => ({
  ...extra,
  ...definedOnly(item),
});

/**
 * התוכן בחזרה כמחרוזת, עם השדות הלא מוכרים במקומם.
 * `null` עבור `unparsed`: אין ממה לבנות, והקורא חייב להשאיר את `raw`.
 */
export const serializeContent = (parsed: ParsedContent): string | null => {
  switch (parsed.kind) {
    case 'plain':
      return parsed.text;
    case 'checklist':
    case 'shopping':
      return JSON.stringify(parsed.items.map(serializeItem));
    case 'workplan':
      return JSON.stringify(parsed.sections.map(serializeItem));
    case 'accounting':
      return JSON.stringify(parsed.rows.map(serializeItem));
    case 'recipe':
      return JSON.stringify(serializeItem(parsed.recipe));
    case 'unparsed':
      return null;
  }
};
