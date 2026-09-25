/**
 * פענוח והמרה של תוכן התבניות
 *
 * תוכן פתק מובנה נשמר כמחרוזת JSON. עד עכשיו כל תבנית פענחה אותו
 * בעצמה, ופענוח שנכשל החזיר רשימה ריקה - שהתבנית "איתחלה" מיד בשורה
 * חדשה וכך מחקה את התוכן המקורי. פתק טקסט שהוגדר כרשימת משימות איבד
 * את כל הטקסט ברגע שנכנסו לעריכה.
 *
 * הכלל כאן: פענוח שנכשל מחזיר `{ ok: false }` ולא ערך ריק, והקורא
 * מחליט מה להציג. מחרוזת ריקה היא התוכן היחיד שנחשב "ריק" ומותר לאתחל.
 *
 * טהור - בלי React ובלי Firebase.
 */

import type { TemplateType } from '@/types/note';
import type {
  AccountingRow,
  ChecklistItem,
  RecipeData,
  RepeatRule,
  ShoppingItem,
  WorkPlanSection,
} from '@/types/template';

export type ParseResult<T> = { ok: true; value: T } | { ok: false };

type JsonObject = Record<string, unknown>;

const FAILED = { ok: false } as const;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

const REPEAT_RULES = new Set<string>(['daily', 'weekly', 'monthly', 'yearly']);

const parseJson = (value: string): ParseResult<unknown> => {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return FAILED;
  }
};

/**
 * מערך שכל איבריו אובייקטים. מחרוזת ריקה היא רשימה ריקה.
 * כל דבר אחר - טקסט חופשי, מספר, אובייקט, מערך עם `null` - הוא כישלון.
 */
const parseObjectArray = (value: string): ParseResult<JsonObject[]> => {
  if (value.trim() === '') return { ok: true, value: [] };

  const parsed = parseJson(value);
  if (!parsed.ok || !Array.isArray(parsed.value) || !parsed.value.every(isObject)) {
    return FAILED;
  }
  return { ok: true, value: parsed.value };
};

const mapRows = <T>(value: string, toRow: (row: JsonObject, index: number) => T): ParseResult<T[]> => {
  const rows = parseObjectArray(value);
  return rows.ok ? { ok: true, value: rows.value.map(toRow) } : FAILED;
};

// מזהה הנגזר מהמיקום ברשימה - יציב בין פענוחים של אותו תוכן,
// בניגוד ל-Date.now() שהופך את הפענוח ללא-דטרמיניסטי
const rowId = (row: JsonObject, index: number): string => asText(row.id) || `item-${index}`;

export const parseChecklist = (value: string): ParseResult<ChecklistItem[]> =>
  mapRows(value, (item, index) => ({
    id: rowId(item, index),
    text: asText(item.text),
    completed: item.completed === true,
    dueDate: asText(item.dueDate) || undefined,
    dueTime: asText(item.dueTime) || undefined,
    repeat: REPEAT_RULES.has(asText(item.repeat)) ? (item.repeat as RepeatRule) : undefined,
  }));

// שדה `category` של רשימות ישנות פשוט לא נקרא - הסיווג הידני הוסר מהתבנית
export const parseShopping = (value: string): ParseResult<ShoppingItem[]> =>
  mapRows(value, (item, index) => ({
    id: rowId(item, index),
    name: asText(item.name),
    quantity: asText(item.quantity),
    checked: item.checked === true,
  }));

export const parseWorkPlan = (value: string): ParseResult<WorkPlanSection[]> =>
  mapRows(value, (section, index) => ({
    id: rowId(section, index),
    header: asText(section.header),
    content: asText(section.content),
  }));

// סכום שנשמר כמחרוזת בגרסאות ישנות היה משורשר ליתרה במקום להתחבר אליה
export const parseAccounting = (value: string): ParseResult<AccountingRow[]> =>
  mapRows(value, (row, index) => {
    const amount = typeof row.amount === 'number' ? row.amount : Number(row.amount);
    return {
      id: rowId(row, index),
      description: asText(row.description),
      amount: Number.isFinite(amount) ? amount : 0,
      date: asText(row.date),
    };
  });

export const EMPTY_RECIPE: RecipeData = {
  servings: '',
  prepTime: '',
  cookTime: '',
  ingredients: [''],
  instructions: [''],
};

/** מספר נשמר כטקסט - מתכונים מה-AI מגיעים לעיתים עם `servings: 4` */
const asRecipeText = (value: unknown): string | null =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : null;

/**
 * רשימת שורות. `undefined` - אין רשימה (נופלים לברירת מחדל).
 * `null` - יש רשימה אבל עם ערכים שאינם טקסט, למשל אובייקטים; עריכה
 * שלה הייתה מאבדת אותם, ולכן המתכון כולו נחשב כלא-מפוענח.
 */
const recipeLines = (value: unknown): string[] | null | undefined => {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const lines = value.map(asRecipeText);
  return lines.every((line): line is string => line !== null) ? lines : null;
};

export const parseRecipe = (value: string): ParseResult<RecipeData> => {
  if (value.trim() === '') return { ok: true, value: EMPTY_RECIPE };

  const parsed = parseJson(value);
  if (!parsed.ok || !isObject(parsed.value)) return FAILED;

  const recipe = parsed.value;
  const ingredients = recipeLines(recipe.ingredients);
  // ה-AI מחזיר לעיתים `steps` במקום `instructions`
  const instructions =
    recipe.instructions !== undefined
      ? recipeLines(recipe.instructions)
      : recipeLines(recipe.steps);

  if (ingredients === null || instructions === null) return FAILED;

  return {
    ok: true,
    value: {
      servings: asRecipeText(recipe.servings) ?? '',
      prepTime: asRecipeText(recipe.prepTime) ?? '',
      cookTime: asRecipeText(recipe.cookTime) ?? '',
      ingredients: ingredients ?? [''],
      instructions: instructions ?? [''],
    },
  };
};

// ---------------------------------------------------------------------------
// המרה בין תבניות
//
// ההמרה עוברת דרך שורות טקסט: כל תבנית שיודעת להפוך את התוכן שלה לשורות,
// ולבנות תוכן משורות, ניתנת להמרה לכל תבנית אחרת כזו. חשבונאות ומתכון
// אינן כאלה - אין דרך סבירה לנחש סכומים או להפריד מצרכים מהוראות.
// ---------------------------------------------------------------------------

/** סימני רשימה בתחילת שורה: "- ", "* ", "• ", "1. ", "- [ ] ", "[x] " */
const LIST_MARKER = /^\s*(?:[-*•]\s+|\d+[.)]\s+)?(?:\[[ xX]\]\s+)?/;

const textToLines = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.replace(LIST_MARKER, '').trim())
    .filter((line) => line.length > 0);

/**
 * התוכן כשורות טקסט, או `null` אם התבנית לא ניתנת להמרה.
 * תוכן שלא מתפרסר לפי התבנית שלו מטופל כטקסט חופשי - כך בדיוק הוא
 * נראה למשתמש, ועדיף להמיר אותו מאשר לזרוק.
 */
const contentToLines = (content: string, from: TemplateType): string[] | null => {
  switch (from) {
    case 'checklist': {
      const items = parseChecklist(content);
      return items.ok ? items.value.map((item) => item.text.trim()).filter(Boolean) : textToLines(content);
    }
    case 'shopping': {
      const items = parseShopping(content);
      return items.ok
        ? items.value
            .map((item) => [item.name, item.quantity].map((part) => part.trim()).filter(Boolean).join(' '))
            .filter(Boolean)
        : textToLines(content);
    }
    case 'workplan': {
      const sections = parseWorkPlan(content);
      return sections.ok
        ? sections.value.flatMap((section) => textToLines(`${section.header}\n${section.content}`))
        : textToLines(content);
    }
    case 'plain':
      return textToLines(content);
    default:
      return null;
  }
};

const linesToContent = (lines: string[], to: TemplateType): string | null => {
  // מזהה ייחודי גם בתוך אותה המרה - Date.now() לבדו חוזר על עצמו
  const stamp = Date.now();
  const newId = (index: number) => `${stamp}-${index}`;

  switch (to) {
    case 'plain':
      return lines.join('\n');
    case 'checklist':
      return JSON.stringify(
        lines.map((text, index): ChecklistItem => ({ id: newId(index), text, completed: false }))
      );
    case 'shopping':
      return JSON.stringify(
        lines.map(
          (name, index): ShoppingItem => ({ id: newId(index), name, quantity: '', checked: false })
        )
      );
    case 'workplan':
      return JSON.stringify([{ id: newId(0), header: '', content: lines.join('\n') }]);
    default:
      return null;
  }
};

export type ConversionResult = { ok: true; content: string } | { ok: false };

/**
 * המרת תוכן בעת החלפת תבנית.
 * `{ ok: false }` פירושו שאין המרה אוטומטית והקורא צריך להזהיר.
 */
export const convertContent = (
  content: string,
  from: TemplateType,
  to: TemplateType
): ConversionResult => {
  if (from === to) return { ok: true, content };
  if (content.trim() === '') return { ok: true, content: '' };

  const lines = contentToLines(content, from);
  if (lines === null) return FAILED;
  if (lines.length === 0) return { ok: true, content: '' };

  const converted = linesToContent(lines, to);
  return converted === null ? FAILED : { ok: true, content: converted };
};
