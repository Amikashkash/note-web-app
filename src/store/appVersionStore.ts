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
 *
 * `rawMinClientVersion` ו-`lastCheck`: לאבחון במכשיר (שורת הגרסה ב"מה
 * חדש"). בפרודקשן אין לוגים, וזו הדרך היחידה לראות מה האפליקציה קראה ומתי.
 */

import { create } from 'zustand';
import { isBelowMinimum } from '@/utils/appVersion';
import { stashUnsaved } from '@/utils/unsavedStash';

export interface UnsavedText {
  noteId: string;
  title: string;
  content: string;
}

export interface MinVersionCheckResult {
  ok: boolean;
  at: number;
}

interface AppVersionState {
  /** המינימום האחרון שנקרא, או `null` כשאין (אין מסמך, או עוד לא נקרא) */
  minClientVersion: string | null;
  /** הערך כפי שנקרא, גם כשאינו תקין (`"1.33.1"` עם מירכאות, מספר) - `undefined` כשאין */
  rawMinClientVersion: unknown;
  /** הקריאה האחרונה מהשרת: הצליחה או נכשלה, ומתי. `null` - עוד לא הייתה */
  lastCheck: MinVersionCheckResult | null;
  writesBlocked: boolean;
  unsaved: Record<string, UnsavedText>;
  setMinClientVersion: (value: unknown) => void;
  recordCheck: (result: MinVersionCheckResult) => void;
  /** נקרא לפני כל כתיבה; `useMinClientVersion` מחבר אותו לבדיקה מהשרת */
  onWriteAttempt: () => void;
  holdUnsaved: (text: UnsavedText) => void;
}

export const useAppVersionStore = create<AppVersionState>((set) => ({
  minClientVersion: null,
  rawMinClientVersion: undefined,
  lastCheck: null,
  writesBlocked: false,
  unsaved: {},

  setMinClientVersion: (value) =>
    set({
      minClientVersion: typeof value === 'string' ? value : null,
      rawMinClientVersion: value,
      writesBlocked: isBelowMinimum(__APP_VERSION__, value),
    }),

  recordCheck: (result) => set({ lastCheck: result }),

  onWriteAttempt: () => {},

  holdUnsaved: (text) => {
    // גם במכשיר, מיד: אם האפליקציה תיסגר בלי רענון, הטקסט לא נעלם
    stashUnsaved([text]);
    set((state) => ({ unsaved: { ...state.unsaved, [text.noteId]: text } }));
  },
}));

/** לשכבת ה-API, מחוץ ל-React */
export const writesBlocked = (): boolean => useAppVersionStore.getState().writesBlocked;
