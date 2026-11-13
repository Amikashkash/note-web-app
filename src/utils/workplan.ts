/**
 * תכנית עבודה (v1.44.0): עריכה של הסעיפים, טהור.
 *
 * **כל עריכה עובדת על השורות הגולמיות**, ומשנה רק את מה שנתבקש: שדה שהגרסה
 * הזו לא מכירה (מגרסה עתידית, או מהשרת) נשאר. עד 1.43 העורך בנה את המערך
 * מחדש מהמפענח, וכל שדה לא מוכר נמחק בשמירה הראשונה.
 *
 * כל שינוי בסעיף קובע לו `updatedAt` - משם "לפני כמה זמן" בשורה המקופלת,
 * ולא מפענוח תאריכים מהטקסט.
 *
 * מזהים: כמו במשימות ובשרת (`editNote.ts`), לסעיף בלי `id` המזהה הוא
 * `item-<מיקום>`, והוא נשמר בעריכה הראשונה.
 */

import type { SectionStatus } from '@/types/template';

type Row = Record<string, unknown>;

/** השורות הגולמיות, עם המזהה שמוצג לכל סעיף. `null` - התוכן לא רשימה */
const rowsWithShownIds = (value: string): Row[] | null => {
  if (value.trim() === '') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || !parsed.every((row) => row && typeof row === 'object' && !Array.isArray(row))) {
    return null;
  }
  return (parsed as Row[]).map((row, index) =>
    typeof row.id === 'string' && row.id !== '' ? row : { ...row, id: `item-${index}` }
  );
};

const serialize = (rows: Row[]): string => JSON.stringify(rows);

export type SectionPatch = Partial<{ header: string; content: string; state: string; status: SectionStatus }>;

/**
 * שינוי שדות של סעיף אחד. `null` - אין סעיף כזה, או שאין שינוי בפועל.
 * `updatedAt` נקבע רק כשמשהו השתנה.
 */
export const patchSection = (value: string, id: string, patch: SectionPatch, now: number): string | null => {
  const rows = rowsWithShownIds(value);
  if (!rows) return null;
  const index = rows.findIndex((row) => row.id === id);
  if (index === -1) return null;
  const changed = Object.entries(patch).some(([key, next]) => (rows[index][key] ?? '') !== next);
  if (!changed) return null;
  const next = rows.map((row, position) => (position === index ? { ...row, ...patch, updatedAt: now } : row));
  return serialize(next);
};

/** סעיף חדש בסוף. מחזיר גם את המזהה, כדי לפתוח אותו מיד */
export const addSection = (value: string, now: number): { value: string; id: string } | null => {
  const rows = rowsWithShownIds(value);
  if (!rows) return null;
  const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;
  return { value: serialize([...rows, { id, header: '', content: '', updatedAt: now }]), id };
};

export const removeSection = (value: string, id: string): string | null => {
  const rows = rowsWithShownIds(value);
  if (!rows || !rows.some((row) => row.id === id)) return null;
  return serialize(rows.filter((row) => row.id !== id));
};

/** גרירה: `activeId` עובר למקום של `overId`. `null` - אין שינוי */
export const moveSection = (value: string, activeId: string, overId: string): string | null => {
  const rows = rowsWithShownIds(value);
  if (!rows || activeId === overId) return null;
  const from = rows.findIndex((row) => row.id === activeId);
  const to = rows.findIndex((row) => row.id === overId);
  if (from === -1 || to === -1) return null;
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return serialize(next);
};

// ---------------------------------------------------------------------------
// תצוגה
// ---------------------------------------------------------------------------

/** השורה האחרונה שאינה ריקה ביומן, בלי סימני רשימה ועיצוב בתחילתה */
export const latestLogLine = (log: string): string => {
  const lines = log.split('\n').map((line) => line.trim()).filter(Boolean);
  const last = lines.at(-1) ?? '';
  return last.replace(/^(\d+\.|[*-])\s+/, '').replace(/\*\*/g, '');
};

const DAY = 24 * 60 * 60 * 1000;

/** "היום", "אתמול", "לפני 3 ימים"... לפי ימים בלוח השנה המקומי, לא לפי 24 שעות */
export const timeAgo = (at: number, now: number): string => {
  const startOfDay = (ms: number) => {
    const date = new Date(ms);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  };
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
  if (days <= 0) return 'היום';
  if (days === 1) return 'אתמול';
  if (days < 7) return `לפני ${days} ימים`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return weeks === 1 ? 'לפני שבוע' : weeks === 2 ? 'לפני שבועיים' : `לפני ${weeks} שבועות`;
  const months = Math.floor(days / 30);
  if (days < 365) return months === 1 ? 'לפני חודש' : months === 2 ? 'לפני חודשיים' : `לפני ${months} חודשים`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'לפני שנה' : years === 2 ? 'לפני שנתיים' : `לפני ${years} שנים`;
};

/** התאריך של רשומת יומן, כמו שהמשתמש כותב: "13/11" (יום/חודש, בלי אפסים) */
export const logDate = (date: Date): string => `${date.getDate()}/${date.getMonth() + 1}`;

/**
 * "+ רשומה היום": שורה חדשה בסוף היומן עם התאריך של היום ורווח, והמקום של
 * הסמן בסופה - מוכן להקלדה.
 */
export const appendTodayEntry = (log: string, today: Date): { log: string; cursor: number } => {
  const trimmed = log.replace(/\s+$/, '');
  const next = `${trimmed}${trimmed ? '\n' : ''}${logDate(today)} `;
  return { log: next, cursor: next.length };
};

/** כמה סעיפים הושלמו, מתוך כמה. סעיף בלי סטטוס הוא "פתוח" */
export const sectionProgress = (sections: { status?: SectionStatus }[]): { done: number; total: number } => ({
  done: sections.filter((section) => section.status === 'done').length,
  total: sections.length,
});

export const STATUS_LABELS: Record<SectionStatus, string> = {
  open: 'פתוח',
  active: 'בעבודה',
  done: 'הושלם',
};

/** צבעי הסטטוס: אותו סימן בשורה ובגיליון, ביום ובלילה */
export const STATUS_TONE: Record<SectionStatus, string> = {
  open: 'bg-raised-light dark:bg-raised-dark text-ink-2-light dark:text-ink-2-dark border-hairline-light dark:border-hairline-dark',
  active: 'bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-100 border-amber-300 dark:border-amber-800',
  done: 'bg-success/10 text-success dark:text-success-dark border-success/30',
};
