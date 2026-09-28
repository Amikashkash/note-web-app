/**
 * עריכות של Claude בפתק קיים (שלב 2ב-lite): בניית השינוי, טהור.
 *
 * כל עריכה היא `NoteEdit`: פונקציה שמוחלת **על הגרסה העדכנית** של הפתק,
 * בתוך ה-transaction של `UserScope.editNote`. היא לא מקבלת תוכן מ-Claude
 * ולא מחליפה אותו - רק משנה את החלק שנתבקש:
 * - `update_checklist_item`: שדות של משימה אחת. שאר הפריטים, וכל שדה
 *   שהגרסה הזו לא מכירה, נשארים כמו שהם (עובדים על השורות הגולמיות).
 * - `append_to_text_note`: הוספה בסוף. הטקסט הקיים לא משתנה, גם לא רווחים.
 *
 * מזהי משימות: `get_note` מציג לכל משימה את ה-`id` השמור שלה, ולמשימה
 * ישנה בלי `id` - `item-<מיקום>`, בדיוק כמו המפענח באפליקציה והטריגר של
 * התזכורות. בעריכה הראשונה המזהים האלה **נשמרים** בפתק (רק השדה `id` נוסף),
 * ומאז הם יציבים גם אם הסדר משתנה. פתקים שלא נערכו לא נוגעים בהם.
 */

import { createHash } from 'node:crypto';
import { InvalidError } from '../notesCore/errors';
import type { NoteEdit } from '../notesCore/store';
import { validateTiming } from './dates';

type Row = Record<string, unknown>;

export const EDIT_LIMITS = {
  itemText: 500,
  appendText: 10_000,
  /** אותה תקרה כמו לתוכן מלא (mcp-plan §3.3) */
  noteContent: 100 * 1024,
} as const;

const oneLine = (value: string): string => value.replace(/\s+/g, ' ').trim();

/** המזהה ש-`get_note` מציג למשימה: השמור, או לפי המיקום */
export const shownItemId = (row: Row, index: number): string =>
  typeof row.id === 'string' && row.id !== '' ? row.id : `item-${index}`;

/** השורות הגולמיות של רשימה, או `null` כשהתוכן לא רשימה */
export const checklistRows = (content: string): Row[] | null => {
  if (content.trim() === '') return [];
  try {
    const parsed: unknown = JSON.parse(content);
    return Array.isArray(parsed) && parsed.every((row) => row && typeof row === 'object' && !Array.isArray(row))
      ? (parsed as Row[])
      : null;
  } catch {
    return null;
  }
};

export interface ChecklistItemChange {
  itemId: string;
  text?: string;
  completed?: boolean;
  /** `null` מוחק את התאריך, ואיתו את השעה והחזרה */
  dueDate?: string | null;
  /** `null` מוחק את השעה, ואיתה את החזרה */
  dueTime?: string | null;
  /** `null` - בלי חזרה */
  repeat?: string | null;
}

const describeChange = (before: Row, after: Row): string => {
  const parts: string[] = [];
  if (before.completed !== after.completed) parts.push(after.completed ? 'סומנה כבוצעה' : 'סומנה כלא בוצעה');
  if (before.text !== after.text) parts.push('הטקסט עודכן');
  const when = (row: Row) => [row.dueDate, row.dueTime].filter(Boolean).join(' ');
  if (when(before) !== when(after)) parts.push(when(after) ? `מועד: ${when(after)}` : 'המועד הוסר');
  if ((before.repeat ?? null) !== (after.repeat ?? null)) parts.push(after.repeat ? `חוזרת: ${String(after.repeat)}` : 'בלי חזרה');
  return `משימה "${String(after.text ?? '')}": ${parts.join(', ')}`;
};

const sameRow = (a: Row, b: Row) => JSON.stringify(a) === JSON.stringify(b);

export const buildChecklistItemEdit = (change: ChecklistItemChange, now: Date): NoteEdit => {
  const { itemId } = change;
  const fields = ['text', 'completed', 'dueDate', 'dueTime', 'repeat'] as const;
  if (!fields.some((field) => change[field] !== undefined)) {
    throw new InvalidError('nothing to change. Give text, completed, dueDate, dueTime or repeat');
  }
  const text = change.text === undefined ? undefined : oneLine(change.text);
  if (text !== undefined && !text) throw new InvalidError('text is empty. To remove a task, ask the user to do it in the app');
  if (text !== undefined && text.length > EDIT_LIMITS.itemText) {
    throw new InvalidError(`text is ${text.length} characters; the limit is ${EDIT_LIMITS.itemText}`);
  }
  const timingChanged = change.dueDate !== undefined || change.dueTime !== undefined || change.repeat !== undefined;

  return {
    action: 'checklist_item.update',
    apply: (note) => {
      if (note.templateType !== 'checklist') {
        throw new InvalidError(`this note is not a checklist (it is "${note.templateType}"). Only checklist items can be updated`);
      }
      const rows = checklistRows(note.content);
      if (!rows) {
        throw new InvalidError('the checklist content could not be read. Ask the user to open the note in the app');
      }

      const ids = rows.map(shownItemId);
      const matches = ids.flatMap((id, index) => (id === itemId ? [index] : []));
      if (matches.length === 0) {
        throw new InvalidError(`there is no item with id "${itemId}" in this note. Call get_note to see the current item ids`);
      }
      if (matches.length > 1) {
        throw new InvalidError(`several items share the id "${itemId}". Ask the user to change this item in the app`);
      }
      const index = matches[0];

      // המזהים שהוצגו נשמרים. שורה עם id שמור לא משתנה
      const withIds = rows.map((row, position) => (row.id === ids[position] ? row : { ...row, id: ids[position] }));
      const before = withIds[index];
      const after: Row = { ...before };

      if (text !== undefined) after.text = text;
      if (change.completed !== undefined) after.completed = change.completed;
      if (change.dueDate === null) {
        delete after.dueDate;
        delete after.dueTime;
        delete after.repeat;
      } else if (change.dueDate !== undefined) {
        after.dueDate = change.dueDate;
      }
      if (change.dueTime === null) {
        delete after.dueTime;
        delete after.repeat;
      } else if (change.dueTime !== undefined) {
        after.dueTime = change.dueTime;
      }
      if (change.repeat === null) delete after.repeat;
      else if (change.repeat !== undefined) after.repeat = change.repeat;

      if (timingChanged) {
        validateTiming(
          {
            dueDate: typeof after.dueDate === 'string' ? after.dueDate : undefined,
            dueTime: typeof after.dueTime === 'string' ? after.dueTime : undefined,
            repeat: typeof after.repeat === 'string' ? after.repeat : undefined,
          },
          'item',
          now,
          // משימה שבוצעה לא מקבלת תזכורת ממילא
          after.completed !== true
        );
      }

      // הערכים כבר כאלה: לא כותבים כלום (גם לא את המזהים)
      if (sameRow(before, after)) return null;

      const next = withIds.map((row, position) => (position === index ? after : row));
      return {
        content: JSON.stringify(next),
        description: describeChange(before, after),
        before: rows[index],
        after,
      };
    },
  };
};

export const buildAppendEdit = (rawText: string): NoteEdit => {
  // רווחים בסוף ההוספה לא נשמרים; בתחילתה - כן (הזחה, שורה ריקה)
  const text = rawText.replace(/\s+$/, '');
  if (!text.trim()) throw new InvalidError('text is empty');
  if (text.length > EDIT_LIMITS.appendText) {
    throw new InvalidError(`text is ${text.length} characters; the limit is ${EDIT_LIMITS.appendText}. Split it`);
  }

  return {
    action: 'note.append',
    // retry אחרי timeout לא יוסיף פעמיים
    fingerprint: createHash('sha256').update(`append\n${text}`).digest('hex'),
    apply: (note) => {
      if (note.templateType !== 'plain') {
        throw new InvalidError(
          `this note is not a text note (it is "${note.templateType}"). append_to_text_note works on text notes only`
        );
      }
      const separator = note.content === '' || note.content.endsWith('\n') ? '' : '\n';
      const content = `${note.content}${separator}${text}`;
      if (content.length > EDIT_LIMITS.noteContent) {
        throw new InvalidError('the note would become too long. Ask the user whether to create a new note instead');
      }
      return {
        content,
        description: `נוסף טקסט בסוף הפתק (${text.length} תווים)`,
        before: { contentLength: note.content.length },
        after: { contentLength: content.length, appended: text },
      };
    },
  };
};
