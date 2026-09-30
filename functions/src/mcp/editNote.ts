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
import { findUnique, replaceRange } from './textMatch';

type Row = Record<string, unknown>;

export const EDIT_LIMITS = {
  itemText: 500,
  appendText: 10_000,
  replaceText: 20_000,
  sectionHeader: 200,
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

// ---------------------------------------------------------------------------
// תכנית עבודה: סעיפים `{ id, header, content }`
// ---------------------------------------------------------------------------

/** הסעיפים הגולמיים של תכנית עבודה, או שגיאה שאומרת מה לעשות */
const workplanSections = (content: string, templateType: string): Row[] => {
  if (templateType !== 'workplan') {
    throw new InvalidError(`this note is not a work plan (it is "${templateType}")`);
  }
  const rows = checklistRows(content);
  if (!rows) throw new InvalidError('the work plan content could not be read. Ask the user to open the note in the app');
  return rows;
};

/** הסעיף לפי המזהה ש-`get_note` מציג, והרשימה עם המזהים שנשמרים */
const findSection = (rows: Row[], sectionId: string): { index: number; withIds: Row[] } => {
  const ids = rows.map(shownItemId);
  const matches = ids.flatMap((id, index) => (id === sectionId ? [index] : []));
  if (matches.length === 0) {
    throw new InvalidError(`there is no section with id "${sectionId}" in this note. Call get_note to see the current section ids`);
  }
  if (matches.length > 1) {
    throw new InvalidError(`several sections share the id "${sectionId}". Ask the user to change this section in the app`);
  }
  // המזהים שהוצגו נשמרים, כמו במשימות
  const withIds = rows.map((row, position) => (row.id === ids[position] ? row : { ...row, id: ids[position] }));
  return { index: matches[0], withIds };
};

const sectionLabel = (row: Row): string => {
  const header = oneLine(String(row.header ?? ''));
  return header ? `"${header}"` : 'ללא כותרת';
};

const tooLong = () => new InvalidError('the note would become too long. Ask the user whether to start a new work plan');

/** טקסט להוספה: בלי רווחים בסוף, לא ריק, לא ארוך מדי */
const cleanAddition = (rawText: string, field = 'text'): string => {
  const text = rawText.replace(/\s+$/, '');
  if (!text.trim()) throw new InvalidError(`${field} is empty`);
  if (text.length > EDIT_LIMITS.appendText) {
    throw new InvalidError(`${field} is ${text.length} characters; the limit is ${EDIT_LIMITS.appendText}. Split it`);
  }
  return text;
};

/** הוספה בסוף, בשורה חדשה. הקיים לא משתנה, גם לא רווחים בסופו */
const appendAfter = (existing: string, text: string): string =>
  `${existing}${existing === '' || existing.endsWith('\n') ? '' : '\n'}${text}`;

/**
 * `append_text`: הוספה בסוף פתק טקסט, או בסוף התוכן של סעיף בתכנית עבודה.
 * אותו טקסט לאותו מקום בתוך 10 דקות לא נוסף פעמיים (retry אחרי timeout).
 */
export const buildAppendEdit = (rawText: string, sectionId?: string): NoteEdit => {
  const text = cleanAddition(rawText);

  return {
    action: sectionId === undefined ? 'note.append' : 'workplan_section.append',
    fingerprint: createHash('sha256').update(`append\n${sectionId ?? ''}\n${text}`).digest('hex'),
    apply: (note) => {
      if (note.templateType === 'workplan') {
        if (sectionId === undefined) {
          throw new InvalidError('this note is a work plan. Give sectionId (from get_note) to add text to one of its sections');
        }
        const { index, withIds } = findSection(workplanSections(note.content, note.templateType), sectionId);
        const before = withIds[index];
        const after = { ...before, content: appendAfter(String(before.content ?? ''), text) };
        const content = JSON.stringify(withIds.map((row, position) => (position === index ? after : row)));
        if (content.length > EDIT_LIMITS.noteContent) throw tooLong();
        return {
          content,
          description: `נוסף טקסט לסעיף ${sectionLabel(before)} (${text.length} תווים)`,
          before: { sectionId, contentLength: String(before.content ?? '').length },
          after: { sectionId, contentLength: String(after.content).length, appended: text },
        };
      }

      if (note.templateType !== 'plain') {
        throw new InvalidError(`this note is a ${note.templateType}. append_text works on text notes and work plans`);
      }
      if (sectionId !== undefined) throw new InvalidError('sectionId is only for work plans. This is a text note');
      const content = appendAfter(note.content, text);
      if (content.length > EDIT_LIMITS.noteContent) throw tooLong();
      return {
        content,
        description: `נוסף טקסט בסוף הפתק (${text.length} תווים)`,
        before: { contentLength: note.content.length },
        after: { contentLength: content.length, appended: text },
      };
    },
  };
};

export interface AddSectionInput {
  header: string;
  content: string;
  /** הסעיף שאחריו. חסר - בסוף */
  afterSectionId?: string;
}

/** `add_workplan_section`: סעיף חדש בסוף, או אחרי סעיף נתון */
export const buildAddSectionEdit = (input: AddSectionInput, now: Date): NoteEdit => {
  const header = oneLine(input.header);
  if (header.length > EDIT_LIMITS.sectionHeader) {
    throw new InvalidError(`header is ${header.length} characters; the limit is ${EDIT_LIMITS.sectionHeader}`);
  }
  const content = input.content.replace(/\s+$/, '');
  if (content.length > EDIT_LIMITS.appendText) {
    throw new InvalidError(`content is ${content.length} characters; the limit is ${EDIT_LIMITS.appendText}. Split it`);
  }
  if (!header && !content.trim()) throw new InvalidError('the section is empty. Give a header, content or both');

  return {
    action: 'workplan_section.add',
    fingerprint: createHash('sha256')
      .update(`add-section\n${input.afterSectionId ?? ''}\n${header}\n${content}`)
      .digest('hex'),
    apply: (note) => {
      const rows = workplanSections(note.content, note.templateType);
      const ids = rows.map(shownItemId);
      let withIds = rows.map((row, position) => (row.id === ids[position] ? row : { ...row, id: ids[position] }));
      let at = withIds.length;
      if (input.afterSectionId !== undefined) {
        const found = findSection(rows, input.afterSectionId);
        withIds = found.withIds;
        at = found.index + 1;
      }
      const section = { id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`, header, content };
      const next = [...withIds.slice(0, at), section, ...withIds.slice(at)];
      const serialized = JSON.stringify(next);
      if (serialized.length > EDIT_LIMITS.noteContent) throw tooLong();
      return {
        content: serialized,
        description: `נוסף סעיף ${sectionLabel(section)}`,
        before: { sectionCount: rows.length, afterSectionId: input.afterSectionId ?? null },
        after: section,
      };
    },
  };
};

/** `remove_workplan_section`: הסעיף כולו. הגרסה הקודמת נשמרת בהיסטוריה */
export const buildRemoveSectionEdit = (sectionId: string): NoteEdit => ({
  action: 'workplan_section.remove',
  apply: (note) => {
    const { index, withIds } = findSection(workplanSections(note.content, note.templateType), sectionId);
    const removed = withIds[index];
    return {
      content: JSON.stringify(withIds.filter((_, position) => position !== index)),
      description: `הוסר הסעיף ${sectionLabel(removed)}`,
      before: removed,
      after: null,
    };
  },
});

export interface ReplaceInput {
  oldText: string;
  newText: string;
  /** בתכנית עבודה: הסעיף */
  sectionId?: string;
  /** בתכנית עבודה: הכותרת או התוכן של הסעיף. ברירת מחדל: התוכן */
  field?: 'header' | 'content';
}

const whereLabel = (sectionId: string | undefined, field: 'header' | 'content') =>
  sectionId === undefined ? 'the note' : `the ${field} of section "${sectionId}"`;

/**
 * `edit_note_text`: החלפה של קטע אחד מדויק (str_replace), בפתק טקסט או
 * בכותרת/תוכן של סעיף. הקטע חייב להופיע בדיוק פעם אחת - אחרת אין החלפה.
 * ההשוואה (סופי שורה, סימני כיוון, ניקוד, רווחים) ב-`textMatch.ts`.
 * `newText` ריק מוחק את הקטע.
 */
export const buildReplaceEdit = (input: ReplaceInput): NoteEdit => {
  const field = input.field ?? 'content';
  if (!input.oldText.trim()) throw new InvalidError('oldText is empty. Copy the exact text to replace from get_note');
  if (input.oldText.length > EDIT_LIMITS.replaceText || input.newText.length > EDIT_LIMITS.replaceText) {
    throw new InvalidError(`oldText and newText are limited to ${EDIT_LIMITS.replaceText} characters each`);
  }
  if (field === 'header' && /[\r\n]/.test(input.newText)) {
    throw new InvalidError('a section header is one line. newText must not contain line breaks');
  }
  if (input.sectionId === undefined && input.field !== undefined) {
    throw new InvalidError('field is only for work plan sections. Give sectionId too');
  }

  const replaceIn = (text: string): { text: string; tolerant: boolean } => {
    const match = findUnique(text, input.oldText);
    if (!match.ok) {
      throw new InvalidError(
        match.count === 0
          ? `oldText was not found in ${whereLabel(input.sectionId, field)}. Call get_note again and copy the fragment ` +
              'exactly, including punctuation. Nothing was changed'
          : `oldText appears ${match.count} times in ${whereLabel(input.sectionId, field)}. Include more of the surrounding ` +
              'text so it appears exactly once. Nothing was changed'
      );
    }
    return { text: replaceRange(text, match.start, match.end, input.newText), tolerant: match.tolerant };
  };

  return {
    action: 'note.replace',
    apply: (note) => {
      if (note.templateType === 'workplan') {
        if (input.sectionId === undefined) {
          throw new InvalidError('this note is a work plan. Give sectionId (and field, header or content) from get_note');
        }
        const { index, withIds } = findSection(workplanSections(note.content, note.templateType), input.sectionId);
        const before = withIds[index];
        const original = String(before[field] ?? '');
        const replaced = replaceIn(original);
        if (replaced.text === original) return null;
        const after = { ...before, [field]: replaced.text };
        const content = JSON.stringify(withIds.map((row, position) => (position === index ? after : row)));
        if (content.length > EDIT_LIMITS.noteContent) throw tooLong();
        return {
          content,
          description: `${input.newText ? 'הוחלף טקסט' : 'נמחק קטע'} ב${field === 'header' ? 'כותרת' : 'תוכן'} של הסעיף ${sectionLabel(before)}`,
          before: { sectionId: input.sectionId, field, text: input.oldText },
          after: { sectionId: input.sectionId, field, text: input.newText, tolerantMatch: replaced.tolerant },
        };
      }

      if (note.templateType !== 'plain') {
        throw new InvalidError(
          `this note is a ${note.templateType}. edit_note_text works on text notes and work plan sections; ` +
            'for checklist tasks use update_checklist_item'
        );
      }
      if (input.sectionId !== undefined) throw new InvalidError('sectionId is only for work plans. This is a text note');
      const replaced = replaceIn(note.content);
      if (replaced.text === note.content) return null;
      if (replaced.text.length > EDIT_LIMITS.noteContent) throw tooLong();
      return {
        content: replaced.text,
        description: input.newText ? 'הוחלף טקסט בפתק' : 'נמחק קטע מהפתק',
        before: { text: input.oldText },
        after: { text: input.newText, tolerantMatch: replaced.tolerant },
      };
    },
  };
};
