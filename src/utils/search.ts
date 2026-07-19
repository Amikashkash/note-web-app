/**
 * חיפוש בפתקים
 */

import type { Note } from '@/types/note';

/**
 * סינון פתקים לפי מחרוזת חיפוש - בכותרת, בתוכן ובתגיות.
 * מחרוזת ריקה מחזירה את הרשימה כמות שהיא.
 */
export const filterNotesByQuery = (notes: Note[], query: string): Note[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return notes;

  return notes.filter(
    (note) =>
      note.title.toLowerCase().includes(normalized) ||
      note.content.toLowerCase().includes(normalized) ||
      note.tags.some((tag) => tag.toLowerCase().includes(normalized))
  );
};
