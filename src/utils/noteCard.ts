/**
 * מה שכרטיס פתק מציג (סבב 3, v1.41.0): תקציר של שורה-שתיים, ותג התקדמות
 * לרשימות. הכל נגזר מהתוכן בזמן התצוגה - לא נשמר, ולכן תמיד נכון.
 */

import { getNotePreview } from './notePreview';
import { parseChecklist, parseShopping } from './templateContent';

interface CardSource {
  content: string;
  templateType: string;
}

/** כמה תווים לכל היותר נכנסים לתקציר. שתי שורות בכרטיס ברוחב מלא */
const PREVIEW_LIMIT = 220;

const collapse = (text: string): string => text.replace(/\s+/g, ' ').trim();

const limit = (text: string): string =>
  text.length > PREVIEW_LIMIT ? `${text.slice(0, PREVIEW_LIMIT).trimEnd()}…` : text;

/**
 * פריטי רשימה (משימות או קניות), אם התוכן הוא רשימה. `null` - לא רשימה, או
 * תוכן שלא פוענח (ואז לא ממציאים התקדמות).
 */
const listItems = (note: CardSource): { text: string; done: boolean }[] | null => {
  if (note.templateType === 'checklist') {
    const parsed = parseChecklist(note.content);
    return parsed.ok ? parsed.value.map((item) => ({ text: item.text, done: item.completed })) : null;
  }
  if (note.templateType === 'shopping') {
    const parsed = parseShopping(note.content);
    return parsed.ok ? parsed.value.map((item) => ({ text: item.name, done: item.checked })) : null;
  }
  return null;
};

/** "3/8": כמה בוצעו מתוך כמה. `null` לפתק שאינו רשימה, או לרשימה ריקה */
export const listProgress = (note: CardSource): { done: number; total: number } | null => {
  const items = listItems(note)?.filter((item) => item.text.trim() !== '');
  if (!items || items.length === 0) return null;
  return { done: items.filter((item) => item.done).length, total: items.length };
};

/**
 * התקציר בכרטיס. ברשימה - המשימות הפתוחות (מה שנשאר לעשות), ולא הראשונות
 * ברשימה. בשאר הסוגים - התצוגה המקדימה הקיימת, בשורה אחת רציפה.
 */
export const cardPreview = (note: CardSource): string => {
  const items = listItems(note);
  if (items) {
    const filled = items.filter((item) => item.text.trim() !== '');
    if (filled.length === 0) return '';
    const open = filled.filter((item) => !item.done);
    if (open.length === 0) return 'הכל בוצע';
    return limit(open.map((item) => collapse(item.text)).join(' · '));
  }
  if (note.templateType === 'plain') return limit(collapse(note.content));
  return limit(collapse(getNotePreview(note.content).replace(/\n/g, ' · ')));
};
