/**
 * שורת המצב של העורך (צעד 6 בסבב 2): "נשמר" / "שומר…" / "ממתין לחיבור" /
 * "לא נשמר". המשתמש צריך לדעת שנשמר לפני שמורידים את כפתורי השמירה (צעד 7).
 * טהור: הקלט מגיע מ-`useNoteSync`.
 *
 * הכלל: **"נשמר" רק כשהשרת אישר את מה שמוצג.** כל ספק - לא "נשמר".
 */

export type SaveStatusKind = 'saved' | 'saving' | 'offline' | 'unsaved';

export interface SaveStatusInput {
  /** יש משהו שהשרת עוד לא אישר: טיוטה ששונה מהבסיס, או שמירה שיצאה */
  unconfirmed: boolean;
  /** התנגשות שממתינה לבחירה */
  conflict: boolean;
  /** `minClientVersion`: הגרסה הזו לא שומרת */
  writesBlocked: boolean;
  /** השמירה האחרונה נכשלה (לא דחייה של התנגשות - שגיאה) */
  failed: boolean;
  /** אין חיבור: ה-snapshot מה-cache, או שהדפדפן מדווח offline */
  offline: boolean;
  /** השמירה לא אושרה כבר כמה שניות - כנראה אין חיבור, גם אם לא דווח */
  slow: boolean;
  /** הרשומה ב-`draftJournal` לא נשמרה במכשיר (אחסון מלא או חסום) */
  notOnDevice: boolean;
}

export interface SaveStatus {
  kind: SaveStatusKind;
  label: string;
  /** הסבר קצר, ל-title ולקוראי מסך */
  detail: string;
}

export const saveStatus = (input: SaveStatusInput): SaveStatus => {
  if (input.conflict) {
    return { kind: 'unsaved', label: 'לא נשמר', detail: 'הפתק השתנה במקום אחר. בחרו איזו גרסה לשמור' };
  }
  if (input.writesBlocked) {
    return { kind: 'unsaved', label: 'לא נשמר', detail: 'יש גרסה חדשה של האפליקציה. רעננו כדי לשמור' };
  }
  if (input.failed) {
    return { kind: 'unsaved', label: 'לא נשמר', detail: 'השמירה נכשלה. השינוי הבא ינסה שוב' };
  }
  if (!input.unconfirmed) {
    return { kind: 'saved', label: 'נשמר', detail: 'כל השינויים נשמרו' };
  }
  if (input.offline || input.slow) {
    return input.notOnDevice
      ? { kind: 'offline', label: 'ממתין לחיבור', detail: 'השינויים לא נשמרו במכשיר. העתיקו אותם לפני שסוגרים' }
      : { kind: 'offline', label: 'ממתין לחיבור', detail: 'השינויים שמורים במכשיר ויישלחו כשהחיבור יחזור' };
  }
  return { kind: 'saving', label: 'שומר…', detail: 'שומר את השינויים' };
};
