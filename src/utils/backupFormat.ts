/**
 * בניית קבצי הגיבוי - Markdown קריא ו-JSON מלא
 *
 * שני הפורמטים משלימים זה את זה: ה-Markdown נועד לעיניים (אפשר לפתוח
 * אותו בכל עורך טקסט גם אם האפליקציה לא זמינה), וה-JSON שומר את כל
 * השדות הגולמיים כך שאפשר לשחזר ממנו במדויק.
 *
 * תוכן הפתק נשמר ב-Firestore כמחרוזת - טקסט חופשי בתבניות הפשוטות
 * ו-JSON בתבניות המובנות. כאן הוא מפוענח ומוצג כטקסט קריא.
 */

import { Timestamp } from 'firebase/firestore';
import type { Note, TemplateType } from '@/types/note';
import type { Category } from '@/types';
import { byPinnedThenOrder } from '@/services/api/mappers';
import { getTemplateIcon, getTemplateLabel } from './templates';

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

const formatDateTime = (value: Timestamp | Date | null | undefined): string =>
  value
    ? new Intl.DateTimeFormat('he-IL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(value instanceof Timestamp ? value.toDate() : value)
    : '';

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

  // הפריטים נשמרים כרשימה שטוחה עם שדה קטגוריה; בגיבוי נוח יותר
  // לראות אותם מקובצים, כפי שהם מוצגים באפליקציה.
  const groups = new Map<string, string[]>();

  for (const item of parsed) {
    const group = asText(item.category) || 'אחר';
    const quantity = asText(item.quantity);
    const line = `- [${item.checked ? 'x' : ' '}] ${singleLine(asText(item.name))}${
      quantity ? ` — ${singleLine(quantity)}` : ''
    }`;

    const existing = groups.get(group);
    if (existing) existing.push(line);
    else groups.set(group, [line]);
  }

  return Array.from(groups.entries())
    .map(([group, lines]) => `**${group}**\n${lines.join('\n')}`)
    .join('\n\n');
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
export const renderNoteContent = (note: Note): string => {
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

// ---------------------------------------------------------------------------
// מסמך ה-Markdown
// ---------------------------------------------------------------------------

const noteToMarkdown = (note: Note): string => {
  const title = singleLine(note.title) || '(ללא כותרת)';

  const badges = [
    getTemplateLabel(note.templateType),
    note.isPinned ? '📌 מוצמד' : '',
    note.tags.length > 0 ? `תגיות: ${note.tags.join(', ')}` : '',
    `נוצר: ${formatDateTime(note.createdAt)}`,
    `עודכן: ${formatDateTime(note.updatedAt)}`,
  ].filter(Boolean);

  return [
    `### ${getTemplateIcon(note.templateType)} ${title}`,
    '',
    `_${badges.join(' · ')}_`,
    '',
    renderNoteContent(note),
  ].join('\n');
};

/** קיבוץ פתקים לפי קטגוריה, בסדר התצוגה של האפליקציה */
const groupByCategory = (
  notes: Note[],
  categories: Category[]
): { title: string; notes: Note[] }[] => {
  const ordered = [...categories].sort((a, b) => a.order - b.order);
  const groups: { title: string; notes: Note[] }[] = [];

  for (const category of ordered) {
    const inCategory = notes
      .filter((note) => note.categoryId === category.id)
      .sort(byPinnedThenOrder);

    if (inCategory.length > 0) {
      groups.push({
        title: `${category.icon ?? '📁'} ${category.name}`,
        notes: inCategory,
      });
    }
  }

  // פתקים שהקטגוריה שלהם נמחקה - אחרת הם היו נעלמים מהגיבוי בשקט
  const known = new Set(categories.map((category) => category.id));
  const orphans = notes.filter((note) => !known.has(note.categoryId)).sort(byPinnedThenOrder);
  if (orphans.length > 0) {
    groups.push({ title: '❓ ללא קטגוריה', notes: orphans });
  }

  return groups;
};

const groupsToMarkdown = (groups: { title: string; notes: Note[] }[]): string[] =>
  groups.flatMap((group) => [
    `## ${group.title}`,
    '',
    ...group.notes.flatMap((note) => [noteToMarkdown(note), '']),
    '---',
    '',
  ]);

export interface BackupMeta {
  /** כתובת האימייל של המשתמש שעבורו נוצר הגיבוי */
  userEmail: string;
  userId: string;
  /** גרסת האפליקציה שיצרה את הגיבוי */
  appVersion: string;
  createdAt: Date;
}

/**
 * בניית קובץ Markdown קריא מכל הפתקים
 */
export const buildMarkdownBackup = (
  notes: Note[],
  categories: Category[],
  meta: BackupMeta
): string => {
  const active = notes.filter((note) => !note.isArchived);
  const archived = notes.filter((note) => note.isArchived);

  const lines = [
    '# גיבוי הפתקים שלי',
    '',
    `**נוצר בתאריך:** ${formatDateTime(meta.createdAt)}`,
    `**משתמש:** ${meta.userEmail}`,
    `**גרסת האפליקציה:** ${meta.appVersion}`,
    `**סה"כ פתקים:** ${notes.length} (${active.length} פעילים, ${archived.length} בארכיון)`,
    '',
    '---',
    '',
    ...groupsToMarkdown(groupByCategory(active, categories)),
  ];

  if (archived.length > 0) {
    lines.push('# 🗄️ ארכיון', '', ...groupsToMarkdown(groupByCategory(archived, categories)));
  }

  return lines.join('\n');
};

// ---------------------------------------------------------------------------
// מסמך ה-JSON
// ---------------------------------------------------------------------------

/**
 * גרסת מבנה קובץ הגיבוי.
 *
 * קוד שחזור עתידי יצטרך לדעת באיזה מבנה נכתב הקובץ שהמשתמש מעלה,
 * גם אם המבנה השתנה מאז.
 */
export const BACKUP_FORMAT_VERSION = 1;

/** חותמות זמן מומרות ל-ISO כדי שיישארו קריאות ובלתי תלויות ב-Firebase */
const isoOrNull = (timestamp: Timestamp | null | undefined): string | null =>
  timestamp ? timestamp.toDate().toISOString() : null;

/**
 * בניית קובץ JSON עם כל הנתונים הגולמיים, לשחזור מדויק
 */
export const buildJsonBackup = (
  notes: Note[],
  categories: Category[],
  meta: BackupMeta
): string =>
  JSON.stringify(
    {
      backupFormatVersion: BACKUP_FORMAT_VERSION,
      appVersion: meta.appVersion,
      exportedAt: meta.createdAt.toISOString(),
      user: { uid: meta.userId, email: meta.userEmail },
      categories: categories.map((category) => ({
        ...category,
        createdAt: isoOrNull(category.createdAt),
        updatedAt: isoOrNull(category.updatedAt),
      })),
      notes: notes.map((note) => ({
        ...note,
        createdAt: isoOrNull(note.createdAt),
        updatedAt: isoOrNull(note.updatedAt),
        archivedAt: isoOrNull(note.archivedAt),
      })),
    },
    null,
    2
  );

/** שם קובץ עם חותמת תאריך, כדי שגיבויים עוקבים לא ידרסו זה את זה */
export const backupFileName = (extension: 'md' | 'json', createdAt: Date): string => {
  const stamp = createdAt.toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  return `notes-backup_${stamp}.${extension}`;
};
