/**
 * `create_note`: ולידציה ובניית הפתק, טהור (mcp-plan שלב 2א).
 *
 * הקלט מגיע מ-Claude. כל שגיאה היא `InvalidError` עם הודעה ש-Claude יכול
 * לפעול לפיה: מה לא בסדר, באיזה פריט, ומה לעשות במקום.
 *
 * זמנים: `dueDate` + `dueTime` הם שעון ישראל (Asia/Jerusalem), בדיוק כמו
 * באפליקציה. הטריגר הקיים (`onNoteWritten`) קורא את הפריטים ויוצר את
 * התזכורות - לא נוגעים בו.
 *
 * מניעת כפילויות: `fingerprint` הוא hash של מה שהמשתמש ביקש (קטגוריה,
 * סוג, כותרת, פריטים), בלי המזהים והזמנים שנוצרים כאן. בקשה חוזרת זהה
 * (retry אחרי timeout) נותנת אותו fingerprint, ו-`UserScope.createNote`
 * מחזיר את הפתק הקיים. ראו תיאור ה-PR להשוואה עם request id.
 */

import { createHash } from 'node:crypto';
import { InvalidError } from '../notesCore/errors';
import type { NoteDraft } from '../notesCore/store';
import { MAX_YEARS_AHEAD, validateTiming } from './dates';

export const CREATE_LIMITS = {
  /** כמו `LENGTH_LIMITS.NOTE_TITLE` באפליקציה */
  title: 50,
  text: 20_000,
  items: 100,
  itemText: 500,
  quantity: 50,
  maxYearsAhead: MAX_YEARS_AHEAD,
} as const;

export type CreateType = 'text' | 'checklist' | 'shopping';

export interface CreateItemInput {
  text: string;
  dueDate?: string;
  dueTime?: string;
  repeat?: string;
  quantity?: string;
}

export interface CreateNoteInput {
  categoryId: string;
  title: string;
  type: CreateType;
  text?: string;
  items?: CreateItemInput[];
}

export interface ScheduledReminder {
  text: string;
  dueDate: string;
  dueTime: string;
  repeat: string | null;
  /** המועד הראשון שבו התזכורת תישלח */
  firstAt: Date;
}

export interface BuiltNote {
  draft: NoteDraft;
  reminders: ScheduledReminder[];
}

const TEMPLATE: Record<CreateType, NoteDraft['templateType']> = {
  text: 'plain',
  checklist: 'checklist',
  shopping: 'shopping',
};

const oneLine = (value: string): string => value.replace(/\s+/g, ' ').trim();

const invalid = (message: string) => new InvalidError(message);

const validateItemTiming = (item: CreateItemInput, label: string, now: Date): ScheduledReminder | null => {
  const firstAt = validateTiming(item, label, now);
  if (!firstAt) return null;
  return {
    text: oneLine(item.text),
    dueDate: item.dueDate as string,
    dueTime: item.dueTime as string,
    repeat: item.repeat ?? null,
    firstAt,
  };
};

/**
 * הפתק המוכן ליצירה, או `InvalidError`. `now` - לבדיקת "עבר" ולמזהי הפריטים.
 */
export const buildNote = (input: CreateNoteInput, now: Date): BuiltNote => {
  const title = oneLine(input.title);
  if (!title) throw invalid('title is empty. Give the note a short title');
  if (title.length > CREATE_LIMITS.title) {
    throw invalid(`title is ${title.length} characters; the limit is ${CREATE_LIMITS.title}. Shorten it`);
  }

  const reminders: ScheduledReminder[] = [];
  let content: string;
  let canonical: unknown;
  let itemCount = 0;

  if (input.type === 'text') {
    if (input.items !== undefined) throw invalid('items are for checklist and shopping notes. For a text note use text');
    const text = (input.text ?? '').trim();
    if (!text) throw invalid('text is empty. A text note needs text');
    if (text.length > CREATE_LIMITS.text) {
      throw invalid(`text is ${text.length} characters; the limit is ${CREATE_LIMITS.text}. Shorten it or split it into several notes`);
    }
    content = text;
    canonical = text;
  } else {
    if (input.text !== undefined) throw invalid(`text is only for text notes. For a ${input.type} use items`);
    const items = input.items ?? [];
    if (items.length === 0) throw invalid(`a ${input.type} needs at least one item`);
    if (items.length > CREATE_LIMITS.items) {
      throw invalid(`${items.length} items; the limit is ${CREATE_LIMITS.items}. Split the list into several notes`);
    }
    itemCount = items.length;

    const stamp = now.getTime();
    const rows = items.map((item, index) => {
      const label = `item ${index + 1}`;
      const text = oneLine(item.text ?? '');
      if (!text) throw invalid(`${label} is empty`);
      if (text.length > CREATE_LIMITS.itemText) {
        throw invalid(`${label} is ${text.length} characters; the limit is ${CREATE_LIMITS.itemText}`);
      }

      if (input.type === 'shopping') {
        if (item.dueDate !== undefined || item.dueTime !== undefined || item.repeat !== undefined) {
          throw invalid(`${label}: dates, times and repeat are for checklist items. A shopping list has none`);
        }
        const quantity = oneLine(item.quantity ?? '');
        if (quantity.length > CREATE_LIMITS.quantity) throw invalid(`${label}: quantity is too long`);
        return { id: `${stamp}-${index}`, name: text, quantity, checked: false };
      }

      if (item.quantity !== undefined) throw invalid(`${label}: quantity is for shopping lists`);
      const reminder = validateItemTiming(item, label, now);
      if (reminder) reminders.push(reminder);
      return {
        id: `${stamp}-${index}`,
        text,
        completed: false,
        ...(item.dueDate !== undefined && { dueDate: item.dueDate }),
        ...(item.dueTime !== undefined && { dueTime: item.dueTime }),
        ...(item.repeat !== undefined && { repeat: item.repeat }),
      };
    });

    content = JSON.stringify(rows);
    // בלי ה-id שנוצר כאן: שתי בקשות זהות חייבות לתת אותו fingerprint
    canonical = rows.map(({ id: _id, ...rest }) => rest);
  }

  const templateType = TEMPLATE[input.type];
  const fingerprint = createHash('sha256')
    .update(JSON.stringify([input.categoryId, templateType, title, canonical]))
    .digest('hex');

  return {
    draft: {
      categoryId: input.categoryId,
      title,
      templateType,
      content,
      fingerprint,
      summary: { title, templateType, categoryId: input.categoryId, itemCount, reminderCount: reminders.length },
    },
    reminders,
  };
};

/** "2026-10-05 09:30" לתצוגה, מתוך מה שהמשתמש ביקש (שעון ישראל) */
export const describeReminder = (reminder: ScheduledReminder): string =>
  `${reminder.text} - ${reminder.dueDate} ${reminder.dueTime}${reminder.repeat ? `, repeats ${reminder.repeat}` : ''}`;
