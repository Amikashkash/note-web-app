/**
 * `minClientVersion` (D4a): האם הגרסה הרצה עדיין רשאית לכתוב.
 *
 * `config/app.minClientVersion` נקבע ע"י הבעלים לפני שינוי פורמט. גרסה
 * נמוכה ממנו לא מבינה את הפורמט החדש, ולכן **מפסיקה לכתוב** - כתיבה שלה
 * הייתה דורסת אותו. ההחלטה עצמה ב-`utils/appVersion.ts`; הקריאה של
 * ה-config ב-`hooks/useMinClientVersion.ts`; האכיפה ב-`services/api/writeGate.ts`.
 *
 * `unsaved`: טקסט שהמשתמש כתב ולא נשמר כי הכתיבה נחסמה. נשמר כאן ולא
 * רק בעורך, כדי שיישאר גלוי ואפשר יהיה להעתיק אותו גם אחרי שהפתק נסגר.
 */

import { create } from 'zustand';
import { isBelowMinimum } from '@/utils/appVersion';

export interface UnsavedText {
  noteId: string;
  title: string;
  content: string;
}

interface AppVersionState {
  /** המינימום האחרון שנקרא, או `null` כשאין (אין מסמך, או עוד לא נקרא) */
  minClientVersion: string | null;
  writesBlocked: boolean;
  unsaved: Record<string, UnsavedText>;
  setMinClientVersion: (value: unknown) => void;
  holdUnsaved: (text: UnsavedText) => void;
}

export const useAppVersionStore = create<AppVersionState>((set) => ({
  minClientVersion: null,
  writesBlocked: false,
  unsaved: {},

  setMinClientVersion: (value) =>
    set({
      minClientVersion: typeof value === 'string' ? value : null,
      writesBlocked: isBelowMinimum(__APP_VERSION__, value),
    }),

  holdUnsaved: (text) => set((state) => ({ unsaved: { ...state.unsaved, [text.noteId]: text } })),
}));

/** לשכבת ה-API, מחוץ ל-React */
export const writesBlocked = (): boolean => useAppVersionStore.getState().writesBlocked;
