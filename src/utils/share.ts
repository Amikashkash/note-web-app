/**
 * המרת פתק לטקסט ושיתופו בערוצים חיצוניים
 */

import type { Note } from '@/types/note';
import type { AccountingRow, WorkPlanSection } from '@/types/template';
import { getTemplateIcon, getTemplateLabel } from './templates';
import { logger } from './logger';

/** רוחב קו המפריד בטבלת החשבונאות */
const TABLE_WIDTH = 45;
const DESCRIPTION_WIDTH = 25;

/**
 * ניסיון לפרש תוכן כ-JSON של תבנית.
 * מחזיר `null` אם התוכן אינו JSON תקין - ואז מוצג הטקסט הגולמי.
 */
const parseTemplateContent = <T>(content: string): T | null => {
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as T) : null;
  } catch {
    return null;
  }
};

/**
 * המרת טבלת חשבונאות לטקסט קריא
 */
const formatAccountingContent = (content: string): string => {
  const rows = parseTemplateContent<AccountingRow[]>(content);
  if (!rows) return content;

  const divider = '─'.repeat(TABLE_WIDTH);
  const lines = [
    '📊 טבלת חשבונאות:',
    divider,
    'תאריך       | תיאור                    | סכום',
    divider,
  ];

  let total = 0;
  for (const row of rows) {
    total += row.amount;
    const date = row.date.padEnd(12);
    const description = row.description.padEnd(DESCRIPTION_WIDTH).slice(0, DESCRIPTION_WIDTH);
    const amount = row.amount.toFixed(2).padStart(9);
    lines.push(`${date}| ${description}| ${amount}`);
  }

  lines.push(divider, `💵 סה"כ: ${total.toFixed(2)} ₪`);
  return lines.join('\n') + '\n';
};

/**
 * המרת תכנית עבודה לטקסט מעוצב
 */
const formatWorkPlanContent = (content: string): string => {
  const sections = parseTemplateContent<WorkPlanSection[]>(content);
  if (!sections) return content;

  return sections
    .map((section) => {
      const header = section.header || 'ללא כותרת';
      const underline = '─'.repeat(Math.min(header.length, 40));
      const body = section.content || '(אין תוכן)';
      return `\n▸ ${header}\n${underline}\n${body}\n`;
    })
    .join('\n');
};

/**
 * המרת פתק לטקסט לשיתוף
 */
export const formatNoteForSharing = (note: Note): string => {
  const parts = [`${note.title}`, '='.repeat(note.title.length), ''];

  parts.push(`${getTemplateIcon(note.templateType)} סוג: ${getTemplateLabel(note.templateType)}`);

  const date = note.updatedAt.toDate().toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  parts.push(`📅 תאריך: ${date}`, '');

  if (note.templateType === 'accounting') {
    parts.push(formatAccountingContent(note.content));
  } else if (note.templateType === 'workplan') {
    parts.push(formatWorkPlanContent(note.content));
  } else {
    parts.push(note.content);
  }

  if (note.tags.length > 0) {
    parts.push('', `🏷️ תגיות: ${note.tags.map((tag) => `#${tag}`).join(' ')}`);
  }

  return parts.join('\n');
};

/**
 * שיתוף בוואטסאפ
 */
export const shareViaWhatsApp = (note: Note): void => {
  const url = `https://wa.me/?text=${encodeURIComponent(formatNoteForSharing(note))}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

/**
 * שיתוף באימייל
 */
export const shareViaEmail = (note: Note): void => {
  const subject = encodeURIComponent(note.title);
  const body = encodeURIComponent(formatNoteForSharing(note));
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
};

/**
 * העתקת תוכן הפתק ללוח
 */
export const copyToClipboard = async (note: Note): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(formatNoteForSharing(note));
    return true;
  } catch (error) {
    logger.error('Failed to copy to clipboard:', error);
    return false;
  }
};

/**
 * שיתוף דרך Web Share API של המכשיר.
 *
 * מחזיר `false` אם ה-API לא נתמך או שהמשתמש ביטל - ואז הקורא
 * מציג את תפריט השיתוף הפנימי כחלופה.
 */
export const shareViaNative = async (note: Note): Promise<boolean> => {
  if (!navigator.share) return false;

  try {
    await navigator.share({
      title: note.title,
      text: formatNoteForSharing(note),
    });
    return true;
  } catch (error) {
    // ביטול ע"י המשתמש מגיע כ-AbortError ואינו תקלה
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      logger.error('Share failed:', error);
    }
    return false;
  }
};
