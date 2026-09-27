/**
 * יומן הפעולות של Claude (mcp-plan §6).
 *
 * כל כתיבה דרך MCP נרשמת כאן, **באותו transaction** של הכתיבה: אם הרישום
 * נכשל, הכתיבה נכשלת. אין כתיבה בלי תיעוד.
 *
 * המסמך נקרא רק ע"י הבעלים ("פעילות Claude" בהגדרות) ונכתב רק בשרת.
 * הוא מחזיק את הכותרת ואת סוג הפתק - לא את התוכן - כדי לענות על "מה
 * Claude יצר" בלי לשכפל את הפתק.
 */

/** 180 יום (החלטה ב-mcp-plan §6), דרך TTL על `expiresAt` */
export const AUDIT_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

/** מי כתב: המשתמש, דרך איזה חיבור ואיזה tool */
export interface WriteActor {
  uid: string;
  grantId: string;
  clientId: string;
  clientName: string;
  tool: string;
}

export interface NoteCreatedSummary {
  title: string;
  templateType: string;
  categoryId: string;
  categoryName: string;
  itemCount: number;
  reminderCount: number;
}

export interface AuditEntry {
  uid: string;
  /** למי שייך הפתק. היום זהה ל-`uid` (יצירה רק בקטגוריה בבעלות) */
  noteOwnerId: string;
  grantId: string;
  clientId: string;
  clientName: string;
  source: 'mcp';
  tool: string;
  action: 'note.create';
  target: { collection: 'notes'; id: string };
  summary: NoteCreatedSummary;
}

export const noteCreatedEntry = (actor: WriteActor, noteId: string, summary: NoteCreatedSummary): AuditEntry => ({
  uid: actor.uid,
  noteOwnerId: actor.uid,
  grantId: actor.grantId,
  clientId: actor.clientId,
  clientName: actor.clientName,
  source: 'mcp',
  tool: actor.tool,
  action: 'note.create',
  target: { collection: 'notes', id: noteId },
  summary,
});
