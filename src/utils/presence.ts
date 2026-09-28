/**
 * "הפתק פתוח גם במקום אחר" - החלקים הטהורים (סימון נוכחות, כמו ב-Google Sheets).
 *
 * כל עורך פתוח כותב סימון קצר-מועד (`notes/{id}/presence/{sessionId}`):
 * מי, מאיזה סוג מכשיר, ומתי רוענן (זמן השרת). סימון שלא רוענן 60 שניות
 * נחשב סגור, גם אם לא נמחק (טאב שנהרג, סוללה שנגמרה).
 *
 * זו **נוחות**, לא הגנה: ההגנה מדריסה היא ה-revision (C-1), שעובדת גם
 * כשאין סימון, או כשהוא ישן.
 */

/** כל כמה זמן עורך פתוח מרענן את הסימון שלו */
export const PRESENCE_REFRESH_MS = 30_000;

/** אחרי כמה זמן בלי רענון הסימון נחשב סגור. זהה לבדיקה בשרת */
export const PRESENCE_TTL_MS = 60_000;

export interface PresenceEntry {
  sessionId: string;
  uid: string;
  device: string;
  /** זמן השרת של הרענון האחרון; `null` עד שהשרת אישר */
  refreshedAt: Date | null;
}

/** העורכים הפתוחים האחרים: לא הסימון שלנו, ורק כאלה שרוענו לאחרונה */
export const activeOthers = (entries: PresenceEntry[], mySessionId: string, now: number): PresenceEntry[] =>
  entries.filter(
    (entry) =>
      entry.sessionId !== mySessionId &&
      entry.refreshedAt !== null &&
      now - entry.refreshedAt.getTime() < PRESENCE_TTL_MS
  );

/**
 * סוג המכשיר, גס בכוונה: מספיק כדי לומר "פתוח גם בטלפון שלך", בלי
 * לשמור טביעת אצבע של הדפדפן.
 */
export const deviceLabel = (userAgent: string): string => {
  if (/iPad/i.test(userAgent)) return 'iPad';
  if (/iPhone|iPod/i.test(userAgent)) return 'iPhone';
  if (/Android/i.test(userAgent)) return /Mobile/i.test(userAgent) ? 'טלפון Android' : 'טאבלט Android';
  if (/Windows/i.test(userAgent)) return 'מחשב Windows';
  if (/Macintosh|Mac OS X/i.test(userAgent)) return 'Mac';
  if (/Linux/i.test(userAgent)) return 'מחשב Linux';
  return 'מכשיר אחר';
};

/** המשפט שמוצג בפתק, לפי מי עוד פתח אותו */
export const presenceMessage = (others: PresenceEntry[], myUid: string): string | null => {
  if (others.length === 0) return null;
  const mine = others.filter((entry) => entry.uid === myUid);
  const someoneElse = others.some((entry) => entry.uid !== myUid);
  const devices = [...new Set(mine.map((entry) => entry.device))].join(', ');

  if (mine.length > 0 && someoneElse) return `הפתק פתוח גם ב${devices} שלך, וגם אצל משתמש אחר שהוא משותף איתו.`;
  if (mine.length > 0) return `הפתק פתוח גם ב${devices} שלך.`;
  return 'הפתק פתוח גם אצל משתמש אחר שהוא משותף איתו.';
};
