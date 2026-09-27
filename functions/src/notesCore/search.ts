/**
 * חיפוש בפתקים, בזיכרון.
 *
 * מבוסס על `src/utils/search.ts` באפליקציה (אותה התאמה: substring בלי
 * תלות ברישיות, בכותרת, בתוכן ובתגיות), עם הבדל אחד מכוון: התוכן הוא
 * הטקסט **המרונדר** ולא ה-JSON הגולמי (mcp-plan §5). ברשימת משימות
 * מחפשים ב-`text` של המשימות, ולא ב-`"completed"` או במזהים.
 *
 * מקבל רק פתקים שכבר עברו את `UserScope` (נגישים וגלויים), ולכן לא יכול
 * להחזיר התאמה מפתק רגיש (§3.4). אין כאן גישה ל-Firestore.
 */

import { parseContent } from './content';

export type MatchField = 'title' | 'content' | 'tags';

export interface SearchableNote {
  title: string;
  content: string;
  templateType: string;
  tags: readonly string[];
}

export interface SearchHit<T> {
  note: T;
  matchedIn: MatchField[];
}

/**
 * הטקסט שבו מחפשים בתוכן. בלי מה שהרינדור מוסיף מעצמו: פתק ריק מוצג
 * כ-"_(פתק ריק)_", ו-JSON לא מזוהה עטוף בבלוק קוד - אף אחד מהם לא נכתב
 * ע"י המשתמש, וחיפוש "פתק" או "json" לא אמור להתאים להם.
 */
const searchableContent = (note: SearchableNote): string => {
  const raw = note.content.trim();
  if (!raw) return '';
  const text = parseContent(note.templateType, note.content).text;
  return text === `\`\`\`json\n${raw}\n\`\`\`` ? raw : text;
};

/** השדות שבהם השאילתה מופיעה. ריק = אין התאמה */
export const matchNote = (note: SearchableNote, query: string): MatchField[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const matched: MatchField[] = [];
  if (note.title.toLowerCase().includes(normalized)) matched.push('title');
  if (searchableContent(note).toLowerCase().includes(normalized)) matched.push('content');
  if (note.tags.some((tag) => tag.toLowerCase().includes(normalized))) matched.push('tags');
  return matched;
};

/**
 * הפתקים שמתאימים לשאילתה, לפי הסדר שבו התקבלו. שאילתה ריקה לא מחזירה
 * כלום (בניגוד לאפליקציה, שבה היא מציגה הכל): "חפש כלום" אינו בקשה לרשימה.
 */
export const searchNotes = <T extends SearchableNote>(notes: readonly T[], query: string): SearchHit<T>[] =>
  notes.flatMap((note) => {
    const matchedIn = matchNote(note, query);
    return matchedIn.length > 0 ? [{ note, matchedIn }] : [];
  });
