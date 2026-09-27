/**
 * ⚠️ MIRROR - אל תערכו כאן בלבד.
 *
 * מקור: `src/utils/backupFormat.ts`, מ-`type Unknown` ועד סוף
 * `renderNoteContent` (האפליקציה). אותה החלטה כמו ב-`templateContent.ts`:
 * העתק מילה במילה, חוץ מההערה הזו, מהייבוא, ומהטיפוס של הפרמטר
 * (`RenderableNote` במקום `Note` - אותם שני שדות, בלי Timestamp של Firebase).
 * `formatDateTime` הושמט: הוא משמש רק את קובצי הגיבוי, לא את המציגים.
 *
 * הבדיקה `tests/mirrors/notesCore.mirror.test.ts` משווה את הפלט לשל המקור.
 */

import type { TemplateType } from './types';

/** מה שהמציג צריך מפתק: התוכן והתבנית המוצהרת */
export interface RenderableNote {
  content: string;
  templateType: TemplateType;
}

/** ערך שהתקבל מפענוח JSON - מבנהו אינו מובטח */
type Unknown = Record<string, unknown>;

const isObject = (value: unknown): value is Unknown =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

const asAmount = (value: unknown): number => (typeof value === 'number' ? value : 0);

/** מערך אובייקטים שכל אחד מהם מכיל את כל המפתחות שנדרשו */
const isRowsWith = (value: unknown, ...keys: string[]): value is Unknown[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((item) => isObject(item) && keys.every((key) => key in item));

/** כותרת בשורה אחת - כותרת רב-שורתית שוברת את מבנה ה-Markdown */
const singleLine = (text: string): string => text.replace(/\s*\n\s*/g, ' ').trim();

/** תא בטבלת Markdown - קו אנכי בתוך התוכן היה מפצל את התא */
const tableCell = (text: string): string => singleLine(text).replace(/\|/g, '\\|');

// ---------------------------------------------------------------------------
// מציגי תוכן לפי תבנית
//
// כל מציג מקבל את ה-JSON המפוענח ומחזיר Markdown, או `null` אם המבנה
// אינו מתאים לו. הזיהוי נעשה לפי צורת הנתונים ולא רק לפי `templateType`,
// כי פתקים שעברו המרה בין תבניות עלולים להחזיק תוכן שלא תואם לסוג הרשום.
// ---------------------------------------------------------------------------

type Renderer = (parsed: unknown) => string | null;

const renderChecklist: Renderer = (parsed) => {
  if (!isRowsWith(parsed, 'text')) return null;

  return parsed
    .map((item) => {
      const due = [asText(item.dueDate), asText(item.dueTime)].filter(Boolean).join(' ');
      const suffix = due ? ` _(יעד: ${due})_` : '';
      return `- [${item.completed ? 'x' : ' '}] ${singleLine(asText(item.text))}${suffix}`;
    })
    .join('\n');
};

const renderShopping: Renderer = (parsed) => {
  if (!isRowsWith(parsed, 'name')) return null;

  // רשימה שטוחה, כפי שהיא מוצגת באפליקציה. בעבר הפריטים קובצו כאן לפי
  // שדה `category`, אבל הסיווג הידני הוסר מהתבנית - רשימות ישנות עדיין
  // מכילות את השדה, והוא פשוט לא נקרא.
  return parsed
    .map((item) => {
      const quantity = asText(item.quantity);
      return `- [${item.checked ? 'x' : ' '}] ${singleLine(asText(item.name))}${
        quantity ? ` — ${singleLine(quantity)}` : ''
      }`;
    })
    .join('\n');
};

const renderWorkPlan: Renderer = (parsed) => {
  if (!isRowsWith(parsed, 'header', 'content')) return null;

  return parsed
    .map((section) => {
      const header = singleLine(asText(section.header)) || 'סעיף';
      return `#### ${header}\n\n${asText(section.content)}`;
    })
    .join('\n\n');
};

const renderAccounting: Renderer = (parsed) => {
  if (!isRowsWith(parsed, 'description', 'amount')) return null;

  let balance = 0;
  const rows = parsed.map((row) => {
    const amount = asAmount(row.amount);
    balance += amount;
    return `| ${tableCell(asText(row.date))} | ${tableCell(asText(row.description))} | ${amount.toFixed(
      2
    )} | ${balance.toFixed(2)} |`;
  });

  return [
    '| תאריך | תיאור | סכום | יתרה |',
    '| --- | --- | ---: | ---: |',
    ...rows,
    '',
    `**יתרה סופית: ₪${balance.toFixed(2)}**`,
  ].join('\n');
};

const renderRecipe: Renderer = (parsed) => {
  if (!isObject(parsed)) return null;

  // ה-AI מחזיר לעיתים `steps` במקום `instructions`, כמו בקומפוננטת המתכון
  const ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : null;
  const instructions = Array.isArray(parsed.instructions)
    ? parsed.instructions
    : Array.isArray(parsed.steps)
      ? parsed.steps
      : null;

  if (!ingredients && !instructions) return null;

  const header = [
    ['מנות', asText(parsed.servings)],
    ['זמן הכנה', asText(parsed.prepTime)],
    ['זמן בישול', asText(parsed.cookTime)],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `**${label}:** ${value}`)
    .join(' · ');

  const sections: string[] = [];
  if (header) sections.push(header);

  const ingredientLines = (ingredients ?? []).map(asText).filter(Boolean);
  if (ingredientLines.length > 0) {
    sections.push(`**מצרכים:**\n${ingredientLines.map((line) => `- ${line}`).join('\n')}`);
  }

  const instructionLines = (instructions ?? []).map(asText).filter(Boolean);
  if (instructionLines.length > 0) {
    sections.push(
      `**אופן ההכנה:**\n${instructionLines.map((line, index) => `${index + 1}. ${line}`).join('\n')}`
    );
  }

  return sections.length > 0 ? sections.join('\n\n') : null;
};

/** מציג ייעודי לכל תבנית מובנית; תבניות טקסט חופשי אינן מופיעות כאן */
const RENDERERS: Partial<Record<TemplateType, Renderer>> = {
  checklist: renderChecklist,
  shopping: renderShopping,
  workplan: renderWorkPlan,
  accounting: renderAccounting,
  recipe: renderRecipe,
};

/** סדר הניסיון כשהתוכן אינו תואם ל-`templateType` הרשום */
const FALLBACK_RENDERERS: Renderer[] = [
  renderChecklist,
  renderWorkPlan,
  renderAccounting,
  renderShopping,
  renderRecipe,
];

/**
 * ממיר את תוכן הפתק ל-Markdown קריא.
 *
 * אם התוכן הוא JSON שאף מציג לא זיהה, הוא נכתב כבלוק קוד גולמי - עדיף
 * טקסט פחות יפה מאשר גיבוי שמאבד מידע.
 */
export const renderNoteContent = (note: RenderableNote): string => {
  const trimmed = note.content.trim();
  if (!trimmed) return '_(פתק ריק)_';

  const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');
  if (!looksLikeJson) return trimmed;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // לא JSON תקין - זהו טקסט חופשי שבמקרה מתחיל בסוגר
    return trimmed;
  }

  const declared = RENDERERS[note.templateType]?.(parsed);
  if (declared) return declared;

  for (const renderer of FALLBACK_RENDERERS) {
    const rendered = renderer(parsed);
    if (rendered) return rendered;
  }

  return `\`\`\`json\n${trimmed}\n\`\`\``;
};
