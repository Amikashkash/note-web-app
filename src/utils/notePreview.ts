/**
 * יצירת תצוגה מקדימה קצרה לתוכן פתק
 *
 * תוכן הפתק נשמר כמחרוזת - טקסט חופשי בתבניות הפשוטות, ו-JSON בתבניות
 * המובנות. הקוד כאן מזהה את המבנה ומחזיר סיכום קריא לכרטיס הפתק.
 *
 * הזיהוי נעשה לפי צורת הנתונים ולא לפי `templateType`, כי פתקים שעברו
 * המרה בין תבניות עלולים להחזיק תוכן שלא תואם לסוג הרשום.
 */

const PLAIN_TEXT_LIMIT = 50;
const MAX_CHECKLIST_ITEMS = 3;
const MAX_WORKPLAN_SECTIONS = 2;
const MAX_ACCOUNTING_ROWS = 2;
const MAX_RECIPE_INGREDIENTS = 2;
const MAX_SHOPPING_ITEMS = 3;
const WORKPLAN_CONTENT_PREVIEW = 30;

/** ערך שהתקבל מפענוח JSON - מבנהו אינו מובטח */
type Unknown = Record<string, unknown>;

const isObject = (value: unknown): value is Unknown =>
  typeof value === 'object' && value !== null;

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

const asAmount = (value: unknown): number => (typeof value === 'number' ? value : 0);

const isObjectArray = (value: unknown): value is Unknown[] =>
  Array.isArray(value) && value.length > 0 && isObject(value[0]);

const hasKeys = (items: Unknown[], ...keys: string[]): boolean =>
  keys.every((key) => key in items[0]);

const truncate = (text: string, limit: number): string =>
  text.length > limit ? `${text.slice(0, limit)}...` : text;

const previewChecklist = (items: Unknown[]): string =>
  items
    .slice(0, MAX_CHECKLIST_ITEMS)
    .map((item) => `${item.completed ? '✓' : '○'} ${asText(item.text)}`)
    .join('\n');

const previewWorkPlan = (sections: Unknown[]): string =>
  sections
    .slice(0, MAX_WORKPLAN_SECTIONS)
    .map((section) => {
      const body = asText(section.content).slice(0, WORKPLAN_CONTENT_PREVIEW);
      return `▸ ${asText(section.header)}\n  ${body}...`;
    })
    .join('\n');

const previewAccounting = (rows: Unknown[]): string => {
  const total = rows.reduce((sum, row) => sum + asAmount(row.amount), 0);

  const lines = rows.slice(-MAX_ACCOUNTING_ROWS).map((row) => {
    const amount = asAmount(row.amount);
    return `${asText(row.description)}: ${amount > 0 ? '+' : ''}₪${amount}`;
  });

  return `${lines.join('\n')}\nסה"כ: ₪${total.toFixed(2)}`;
};

const previewRecipe = (recipe: Unknown): string | null => {
  const ingredients = recipe.ingredients;
  if (!Array.isArray(ingredients) || ingredients.length === 0) return null;

  return `🥘 ${ingredients.slice(0, MAX_RECIPE_INGREDIENTS).map(asText).join(', ')}`;
};

const previewShopping = (shopping: Unknown): string | null => {
  const sections = shopping.sections;
  if (!Array.isArray(sections)) return null;

  const items = sections
    .flatMap((section) => (isObject(section) && Array.isArray(section.items) ? section.items : []))
    .filter(isObject)
    .slice(0, MAX_SHOPPING_ITEMS);

  if (items.length === 0) return null;

  return items.map((item) => `${item.checked ? '✓' : '○'} ${asText(item.name)}`).join('\n');
};

/**
 * מחזיר תצוגה מקדימה לתוכן הפתק, או קיצור של הטקסט הגולמי
 * אם לא זוהה מבנה מוכר.
 */
export const getNotePreview = (content: string): string => {
  const trimmed = content.trim();
  const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');

  if (looksLikeJson) {
    try {
      const parsed: unknown = JSON.parse(trimmed);

      if (isObjectArray(parsed)) {
        if (hasKeys(parsed, 'text')) return previewChecklist(parsed);
        if (hasKeys(parsed, 'header', 'content')) return previewWorkPlan(parsed);
        if (hasKeys(parsed, 'description', 'amount')) return previewAccounting(parsed);
      }

      if (isObject(parsed)) {
        const recipe = previewRecipe(parsed);
        if (recipe) return recipe;

        const shopping = previewShopping(parsed);
        if (shopping) return shopping;
      }
    } catch {
      // לא JSON תקין - ממשיכים לתצוגת טקסט רגיל
    }
  }

  return truncate(content, PLAIN_TEXT_LIMIT);
};
