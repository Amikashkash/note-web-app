/**
 * נמען שמסיר את עצמו משיתוף של פתק (SH-1), עם אישור. משותף לכרטיסים
 * (`NoteCardList`) ול"שותף איתי"; בתוך הפתק `NoteView` עושה אותו דבר
 * ועוצר קודם את השמירה שממתינה.
 */

import { leaveSharedNote } from '@/services/api/notes';
import { getErrorMessage } from '@/utils/errors';
import type { Note } from '@/types/note';

export const confirmLeaveSharedNote = async (note: Pick<Note, 'id' | 'title'>): Promise<void> => {
  if (
    !window.confirm(
      `להסיר אותך מהשיתוף של "${note.title || 'ללא כותרת'}"?

הפתק יפסיק להופיע אצלך. הבעלים יוכל לשתף אותו איתך שוב.`
    )
  ) {
    return;
  }
  try {
    await leaveSharedNote(note.id);
  } catch (error) {
    window.alert(getErrorMessage(error));
  }
};
